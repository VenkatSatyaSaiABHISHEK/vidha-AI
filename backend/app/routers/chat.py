import json
import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db, SessionLocal
from ..models.database_models import ChatSession, ChatMessage, Document
from ..models.schemas import ChatRequest, ChatSessionResponse, ChatSessionCreate
from ..services.rag_engine import RagEngine
from ..services.llm_service import LLMService
from ..utils.logger import get_logger
from ..utils.helpers import get_current_timestamp

logger = get_logger("ChatRouter")
router = APIRouter(prefix="/chat", tags=["Chat"])

def get_message_sort_key(msg):
    # Sort messages chronologically.
    # New ID layout starts with time_ns: msg-171829283928-user
    # Old ID layout looks like: msg-user-abcde
    parts = msg.id.split("-")
    if len(parts) >= 3 and parts[1].isdigit():
        return (1, int(parts[1]))
    # Fallback for old messages
    return (0, msg.id)

@router.get("/sessions", response_model=List[ChatSessionResponse])
def get_sessions(db: Session = Depends(get_db)):
    """Retrieve all available offline chat threads sorted with newest first."""
    sessions = db.query(ChatSession).order_by(ChatSession.id.desc()).all()
    updated = False
    for s in sessions:
        s.messages.sort(key=get_message_sort_key)
        # Dynamically set title from first user message if current title is generic
        if s.title in ["New Chat Thread", "New Thread", "Active Thread"] and s.messages:
            first_user_msg = next((m for m in s.messages if m.role == "user"), None)
            if first_user_msg:
                prompt = first_user_msg.content
                s.title = prompt[:30] + "..." if len(prompt) > 30 else prompt
                updated = True
    if updated:
        try:
            db.commit()
        except Exception:
            db.rollback()
    return sessions

@router.post("/sessions", response_model=ChatSessionResponse)
def create_session(payload: ChatSessionCreate, db: Session = Depends(get_db)):
    """Create a new chat thread session registry with a chronological ID."""
    sess_id = f"chat-{time.time_ns()}"
    from datetime import datetime
    now_str = datetime.now().strftime("%Y-%m-%d")
    
    new_sess = ChatSession(
        id=sess_id,
        title=payload.title or "New Chat Thread",
        date=now_str,
        collection_id=payload.collection_id
    )
    
    try:
        db.add(new_sess)
        db.commit()
        db.refresh(new_sess)
        logger.info(f"Created chat session: {new_sess.title} ({new_sess.id})")
        return new_sess
    except Exception as e:
        db.rollback()
        logger.error(f"Failed creating chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    """Delete a chat thread and all its message histories."""
    sess = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    try:
        db.delete(sess)
        db.commit()
        logger.info(f"Deleted chat session: {session_id}")
        return {"status": "success", "message": "Chat thread deleted."}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed deleting chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/message")
def send_chat_message(payload: ChatRequest, db: Session = Depends(get_db)):
    """Streams LLM chat response using context retrieved from document embeddings (SSE format)."""
    # 1. Verify session exists
    session = db.query(ChatSession).filter(ChatSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Chat session thread not found."
        )
        
    # Auto-associate collection_id if not already set on the session
    if payload.collection_id and not session.collection_id:
        session.collection_id = payload.collection_id

    # Check if selected collection is empty
    has_documents = True
    if payload.collection_id:
        doc_count = db.query(Document).filter(
            Document.collection_id == payload.collection_id,
            Document.status == "Indexed"
        ).count()
        if doc_count == 0:
            has_documents = False

    # 5. Save the user's message to SQLite database using chronological time_ns
    user_msg_id = f"msg-{time.time_ns()}-user"
    now_time = get_current_timestamp()
    user_chat_msg = ChatMessage(
        id=user_msg_id,
        session_id=payload.session_id,
        role="user",
        content=payload.prompt,
        timestamp=now_time.split(" ")[1]
    )
    db.add(user_chat_msg)
    
    # Auto rename default title if thread was a generic new thread
    if session.title in ["New Chat Thread", "New Thread", "Active Thread"]:
        session.title = payload.prompt[:30] + "..." if len(payload.prompt) > 30 else payload.prompt
        
    db.commit()

    # If the collection is empty, stream the "no source data" message immediately
    if not has_documents:
        def no_data_generator():
            first_payload = {
                "token": "",
                "citations": [],
                "status": "Generating"
            }
            yield f"data: {json.dumps(first_payload)}\n\n"
            
            message_text = "There is no source data. You need to add files first."
            yield f"data: {json.dumps({'token': message_text, 'citations': []})}\n\n"
            
            # Save assistant message to DB
            db_saver = SessionLocal()
            try:
                bot_msg_id = f"msg-{time.time_ns()}-assistant"
                bot_chat_msg = ChatMessage(
                    id=bot_msg_id,
                    session_id=payload.session_id,
                    role="assistant",
                    content=message_text,
                    timestamp=get_current_timestamp().split(" ")[1],
                    citations=""
                )
                db_saver.add(bot_chat_msg)
                db_saver.commit()
                logger.info(f"Saved empty collection placeholder response ({bot_msg_id}) to Chat session: {payload.session_id}")
            except Exception as save_err:
                logger.error(f"Failed writing empty collection placeholder in session {payload.session_id}: {str(save_err)}")
            finally:
                db_saver.close()
                
        return StreamingResponse(no_data_generator(), media_type="text/event-stream")

    # 2. Compile context if collection_id is provided
    context_chunks = []
    citations = []
    is_overview_query = False
    overview_context = ""
    
    if payload.collection_id:
        clean_prompt = payload.prompt.lower().strip()
        # Detect if it's asking for an overview of the source files
        if "overview" in clean_prompt and ("source" in clean_prompt or "data" in clean_prompt or "file" in clean_prompt or "collection" in clean_prompt or "document" in clean_prompt):
            is_overview_query = True
            
        if is_overview_query:
            db_docs = db.query(Document).filter(Document.collection_id == payload.collection_id).all()
            if db_docs:
                citations = list(set([d.name for d in db_docs]))
                doc_details = []
                for d in db_docs:
                    tags_str = d.tags if d.tags else "General"
                    summary_str = d.summary if d.summary else (d.ocr_text[:300] + "..." if d.ocr_text else "No content summary available")
                    doc_details.append(
                        f"Document Name: {d.name}\n"
                        f"Format/Type: {d.type.upper()}\n"
                        f"Size: {d.size}\n"
                        f"Tags: {tags_str}\n"
                        f"Summary: {summary_str}"
                    )
                overview_context = "\n---\n".join(doc_details)
            else:
                overview_context = "No documents found in the current collection. Please upload files."
        else:
            # Search vector database
            context_chunks = RagEngine.search_similar_chunks(
                query=payload.prompt,
                collection_id=payload.collection_id,
                limit=4
            )
            # Extract unique document names as citations
            citations = list(set([item["document_name"] for item in context_chunks]))

    # 3. Assemble local history for multi-turn chat prompts
    history_messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == payload.session_id
    ).all()
    # Sort messages chronologically
    history_messages.sort(key=get_message_sort_key)
    
    history_text = ""
    for msg in history_messages[-6:]: # Include last 6 messages as context window
        history_text += f"\n{msg.role.capitalize()}: {msg.content}"

    # 4. Formulate System and User Prompts
    # 4. Formulate System and User Prompts
    system_prompt = "You are Vedha AI, a secure, local offline AI learning and interview preparation assistant. "
    
    # Apply Explain Level depth guidance
    explain_level = payload.explain_level or "intermediate"
    if explain_level == "beginner":
        system_prompt += "Explain the concepts at a Beginner level: keep explanations simple, use easy analogies, avoid deep jargon, and explain concepts from scratch. "
    elif explain_level == "expert":
        system_prompt += "Explain the concepts at an Expert level: dive deep into technical implementation details, performance/Big-O complexity, advanced patterns, and theoretical constraints. "
    else:
        system_prompt += "Explain the concepts at an Intermediate level: provide balanced, structured explanations with practical examples. "

    # Apply Mode specific prompt guidelines
    mode = payload.mode or "learning"
    if mode == "interview":
        system_prompt += (
            "Act as a professional technical interviewer. Evaluate the user's answer, provide feedback, "
            "list common follow-up questions they might face, and suggest the next question. "
            "Structure your output clearly with sections: 'Answer Evaluation', 'Key Improvement Areas', 'Common Follow-up Questions', and 'Next Question'."
        )
    elif mode == "revision":
        system_prompt += (
            "Act as a notes summarizer and revision assistant. Help the user compress study materials. "
            "Structure the response into 'Summary', 'Key Topics to Remember', 'Common Exam Tips', and 'Quick Revision Notes'."
        )
    elif mode == "quiz":
        system_prompt += (
            "Act as a quiz generator. Formulate multiple-choice questions (MCQs) or short questions based on the retrieved context. "
            "Provide the correct answers hidden at the bottom of your output so the user can test themselves."
        )
    elif mode == "coding":
        system_prompt += (
            "Act as a programming and algorithm tutor. Provide clear code blocks, explain coding logic, and teach best practices. "
            "Detail performance complexities where appropriate."
        )
    else:
        # Default: learning mode
        system_prompt += (
            "Act as a friendly learning assistant. Guide the student step-by-step through topics, "
            "provide definitions, code or formulas, and offer quick exercises to practice."
        )
    
    if is_overview_query:
        system_prompt += (
            "Provide a comprehensive, high-level overview of the uploaded source files in the active collection. "
            "Explain what documents are available, their file formats, sizes, and summarize their main topics or contents."
        )
        user_prompt = (
            f"Here are the details of all uploaded files in the active collection:\n{overview_context}\n\n"
            f"Conversation History:\n{history_text}\n\n"
            f"User Question: {payload.prompt}\n"
            f"Answer:"
        )
    elif context_chunks:
        system_prompt += (
            "Use ONLY the following document context blocks to formulate your answer. "
            "If the context does not contain the answer, say that you cannot find it in the local documents. "
            "Do not make up facts."
        )
        
        context_text = "\n\n".join([
            f"Source: {item['document_name']} (Page {item['page_number']})\nSnippet: {item['content']}" 
            for item in context_chunks
        ])
        
        user_prompt = (
            f"Here is the local document context:\n{context_text}\n\n"
            f"Conversation History:\n{history_text}\n\n"
            f"User Question: {payload.prompt}\n"
            f"Answer:"
        )
    else:
        user_prompt = (
            f"Conversation History:\n{history_text}\n\n"
            f"User Question: {payload.prompt}\n"
            f"Answer:"
        )

    # 6. Stream generator wrapper
    def generator():
        assistant_chunks = []
        
        # Send first SSE packet containing the citations and active status parameters
        first_payload = {
            "token": "",
            "citations": citations,
            "status": "Generating"
        }
        yield f"data: {json.dumps(first_payload)}\n\n"
        
        # Pull tokens from local LLM
        stream = LLMService.generate_streaming_response(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model_name=payload.model or "qwen2.5:3b"
        )
        
        for token in stream:
            assistant_chunks.append(token)
            yield f"data: {json.dumps({'token': token, 'citations': []})}\n\n"
            
        # Compile full answer text to save in DB session registry
        full_answer = "".join(assistant_chunks)
        
        # Save assistant message using isolated session thread context
        db_saver = SessionLocal()
        try:
            bot_msg_id = f"msg-{time.time_ns()}-assistant"
            citations_str = ",".join(citations)
            bot_chat_msg = ChatMessage(
                id=bot_msg_id,
                session_id=payload.session_id,
                role="assistant",
                content=full_answer,
                timestamp=get_current_timestamp().split(" ")[1],
                citations=citations_str
            )
            db_saver.add(bot_chat_msg)
            db_saver.commit()
            logger.info(f"Saved generated response ({bot_msg_id}) to Chat session thread: {payload.session_id}")
        except Exception as save_err:
            logger.error(f"Failed writing assistant reply in session {payload.session_id}: {str(save_err)}")
        finally:
            db_saver.close()
            
    return StreamingResponse(generator(), media_type="text/event-stream")

@router.put("/sessions/{session_id}")
def update_session_title(session_id: str, title: str, db: Session = Depends(get_db)):
    """Update the title of an active chat session."""
    sess = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    try:
        sess.title = title
        db.commit()
        db.refresh(sess)
        logger.info(f"Renamed chat session: {session_id} to '{title}'")
        return {"status": "success", "id": session_id, "title": title}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed renaming chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
