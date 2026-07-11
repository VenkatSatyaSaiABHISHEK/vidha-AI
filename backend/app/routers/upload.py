import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from sqlalchemy.orm import Session
from pathlib import Path
from ..database import get_db
from ..models.database_models import Document, Collection
from ..models.schemas import DocumentResponse
from ..config import UPLOAD_DIR
from ..services.doc_processor import DocumentProcessor
from ..services.rag_engine import RagEngine
from ..services.llm_service import LLMService
from ..utils.logger import get_logger
from ..utils.helpers import get_readable_size, get_current_timestamp

logger = get_logger("UploadRouter")
router = APIRouter(prefix="/upload", tags=["Upload"])

def process_and_index_document(
    document_id: str, 
    file_path: Path, 
    file_type: str, 
    collection_id: str, 
    db_session_factory,
    auto_classify: bool = True
):
    """Background task processing text extraction, subject tagging, and Chroma indexing."""
    db: Session = db_session_factory()
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        logger.error(f"Background worker couldn't find Document registry ID: {document_id}")
        db.close()
        return

    try:
        # 1. Parse text
        pages_content = DocumentProcessor.process_file(file_path, file_type)
        if not pages_content:
            raise ValueError("No parseable text extracted from file.")
            
        full_text = " ".join([text for _, text in pages_content])
        doc.ocr_text = full_text[:8000] # Cap OCR storage in db
        
        active_collection_id = collection_id

        # 2. Topic classification if requested
        if auto_classify and LLMService.check_ollama_status() and len(full_text) > 100:
            logger.info("Analyzing document topic for automated collection categorization...")
            classification_prompt = (
                f"Identify the main topic or class of the following document content in 1 or 2 words. "
                f"Examples: Python, Resume, Finance, Invoice, Physics, Chemistry, Biology, History, Research.\n"
                f"Do NOT output sentences or punctuation. Return ONLY the category name.\n\n"
                f"Document snippet:\n{full_text[:6000]}\n\n"
                f"Category:"
            )
            classification_system = "You are a topic classification model. You return exactly one category name."
            try:
                class_chunks = []
                for chunk in LLMService.generate_streaming_response(classification_prompt, classification_system):
                    class_chunks.append(chunk)
                category_name = "".join(class_chunks).strip().strip("'\".").title()
                
                if category_name and len(category_name) < 25 and (category_name.count(" ") <= 1):
                    existing_col = db.query(Collection).filter(Collection.name == category_name).first()
                    if existing_col:
                        active_collection_id = existing_col.id
                        logger.info(f"Auto-categorized document '{doc.name}' to existing collection '{category_name}'")
                    else:
                        new_col_id = f"col-{uuid.uuid4().hex[:6]}"
                        new_col = Collection(
                            id=new_col_id,
                            name=category_name,
                            description=f"Auto-categorized collection for topic {category_name}.",
                            icon_type="FolderOpen"
                        )
                        db.add(new_col)
                        db.commit()
                        active_collection_id = new_col_id
                        logger.info(f"Created new auto-categorized collection '{category_name}'")
                    
                    doc.collection_id = active_collection_id
                    db.commit()
            except Exception as e:
                logger.warning(f"Ollama topic classification failed: {str(e)}")

        # 3. Auto detect tags/subject
        tags_list = DocumentProcessor.auto_detect_subject(full_text)
        doc.tags = ",".join(tags_list)
        
        # 4. Auto Generate summary
        summary = ""
        if LLMService.check_ollama_status() and len(full_text) > 100:
            logger.info("Using local Ollama to generate document summary...")
            prompt = f"Briefly summarize the following document text in 2 concise sentences:\n\n{full_text[:1500]}"
            system = "You are a helpful assistant that generates extremely concise 2-sentence summaries."
            try:
                summary_chunks = []
                for chunk in LLMService.generate_streaming_response(prompt, system):
                    summary_chunks.append(chunk)
                summary = "".join(summary_chunks)
            except Exception as e:
                logger.warning(f"Ollama summarization failed, falling back: {str(e)}")
                
        if not summary.strip():
            summary = full_text[:200] + "..." if len(full_text) > 200 else full_text
            
        doc.summary = summary
        
        # 5. Generate Embeddings & index in ChromaDB
        success = RagEngine.index_document(
            document_id=document_id,
            document_name=doc.name,
            pages_content=pages_content,
            collection_id=active_collection_id
        )
        
        if success:
            doc.status = "Indexed"
            logger.info(f"Successfully processed and indexed document: {doc.name}")
        else:
            doc.status = "Failed"
            logger.error(f"Failed embedding indexes for: {doc.name}")
            
        db.commit()
    except Exception as e:
        logger.error(f"Error in background indexing for {doc.name}: {str(e)}")
        doc.status = "Failed"
        db.commit()
    finally:
        db.close()


@router.post("/pre-analyze")
def pre_analyze_document(
    file: UploadFile = File(...)
):
    """Saves file temporarily, parses it, scans 6000-character context with Ollama, and suggests a folder name."""
    filename = file.filename.replace(" ", "_")
    temp_id = uuid.uuid4().hex[:6]
    temp_filename = f"temp_{temp_id}_{filename}"
    save_path = UPLOAD_DIR / temp_filename
    
    # Save file locally
    try:
        with open(save_path, 'wb') as out_file:
            while content := file.file.read(1024 * 1024):
                out_file.write(content)
    except Exception as e:
        logger.error(f"Failed writing temp file {temp_filename}: {str(e)}")
        raise HTTPException(status_code=500, detail="Could not save upload file temporarily.")

    # Determine extension
    ext = filename.split(".")[-1].lower()
    doc_type = "txt"
    if ext in ["pdf"]:
        doc_type = "pdf"
    elif ext in ["doc", "docx"]:
        doc_type = "docx"
    elif ext in ["ppt", "pptx"]:
        doc_type = "ppt"
    elif ext in ["png", "jpg", "jpeg", "webp", "bmp"]:
        doc_type = "image"

    # Extract text content
    try:
        pages_content = DocumentProcessor.process_file(save_path, doc_type)
        if not pages_content:
            raise ValueError("No parseable text found in file.")
        full_text = " ".join([text for _, text in pages_content])
    except Exception as parse_err:
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(status_code=400, detail=f"Text extraction failed: {str(parse_err)}")

    suggested_category = "General"
    
    # Ask Ollama to classify topic from first 6,000 characters
    if LLMService.check_ollama_status() and len(full_text) > 100:
        classification_prompt = (
            f"Identify the main topic or class of the following document content in 1 or 2 words. "
            f"Examples: Python, Resume, Finance, Invoice, Physics, Chemistry, Biology, History, Research.\n"
            f"Do NOT output sentences or punctuation. Return ONLY the category name.\n\n"
            f"Document snippet:\n{full_text[:6000]}\n\n"
            f"Category:"
        )
        classification_system = "You are a topic classification model. You return exactly one category name."
        try:
            class_chunks = []
            for chunk in LLMService.generate_streaming_response(classification_prompt, classification_system):
                class_chunks.append(chunk)
            category_name = "".join(class_chunks).strip().strip("'\".").title()
            if category_name and len(category_name) < 25 and (category_name.count(" ") <= 1):
                suggested_category = category_name
        except Exception as e:
            logger.warning(f"Ollama pre-classification failed: {str(e)}")

    char_count = len(full_text)
    # Estimate chunk count (size: 512, overlap: 64 -> ~448 effective chars per chunk)
    estimated_chunks = max(1, char_count // 450)

    return {
        "suggested_category": suggested_category,
        "temp_file_name": temp_filename,
        "original_name": filename,
        "char_count": char_count,
        "estimated_chunks": estimated_chunks,
        "type": doc_type
    }


@router.post("/finalize", response_model=DocumentResponse)
async def finalize_document(
    background_tasks: BackgroundTasks,
    temp_file_name: str = Form(...),
    confirmed_category: str = Form(...),
    db: Session = Depends(get_db)
):
    """Renames the temporary upload file, registers in SQLite under the confirmed category, and triggers vectorization."""
    temp_path = UPLOAD_DIR / temp_file_name
    if not temp_path.exists():
        raise HTTPException(status_code=404, detail="Temporary upload file not found.")

    final_filename = temp_file_name.replace("temp_", "")
    # Remove UUID segment from final filename for clean rendering
    # format: temp_[uuid]_[filename] -> [uuid]_[filename]
    parts = final_filename.split("_", 1)
    clean_display_name = parts[1] if len(parts) > 1 else final_filename

    final_path = UPLOAD_DIR / clean_display_name
    
    # Rename temp file to final location
    try:
        temp_path.rename(final_path)
    except Exception as e:
        logger.error(f"Failed renaming temp file: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to finalize physical file placement.")

    # Match or create the collection
    existing_col = db.query(Collection).filter(Collection.name == confirmed_category).first()
    if existing_col:
        collection_id = existing_col.id
    else:
        collection_id = f"col-{uuid.uuid4().hex[:6]}"
        new_col = Collection(
            id=collection_id,
            name=confirmed_category,
            description=f"Collection for topic {confirmed_category}.",
            icon_type="FolderOpen"
        )
        db.add(new_col)
        db.commit()
        logger.info(f"Created collection folder '{confirmed_category}' during finalization.")

    # Determine extension type
    ext = clean_display_name.split(".")[-1].lower()
    doc_type = "txt"
    if ext in ["pdf"]:
        doc_type = "pdf"
    elif ext in ["doc", "docx"]:
        doc_type = "docx"
    elif ext in ["ppt", "pptx"]:
        doc_type = "ppt"
    elif ext in ["png", "jpg", "jpeg", "webp", "bmp"]:
        doc_type = "image"

    doc_id = f"doc-{uuid.uuid4().hex[:6]}"
    file_size_bytes = final_path.stat().st_size
    readable_size = get_readable_size(file_size_bytes)

    # Register document
    new_doc = Document(
        id=doc_id,
        name=clean_display_name,
        size=readable_size,
        type=doc_type,
        status="Processing",
        upload_date=get_current_timestamp(),
        collection_id=collection_id
    )

    try:
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)

        # Trigger background vector indexer (with auto_classify=False since folder is already confirmed)
        from ..database import SessionLocal
        background_tasks.add_task(
            process_and_index_document,
            new_doc.id,
            final_path,
            doc_type,
            collection_id,
            SessionLocal,
            False
        )

        return DocumentResponse(
            id=new_doc.id,
            name=new_doc.name,
            size=new_doc.size,
            type=new_doc.type,
            status=new_doc.status,
            upload_date=new_doc.upload_date,
            tags=[],
            summary="",
            collection_id=new_doc.collection_id
        )
    except Exception as e:
        db.rollback()
        if final_path.exists():
            final_path.unlink()
        logger.error(f"Failed finalizing document registration: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-questions")
def generate_questions(
    document_id: str = Form(...),
    db: Session = Depends(get_db)
):
    """Retrieves document, prompts local Ollama, and returns 5 sample questions."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document registry not found.")

    text_source = doc.ocr_text or ""
    if not text_source.strip():
        # Fall back to reading from disk
        from ..config import UPLOAD_DIR
        file_path = UPLOAD_DIR / doc.name
        if file_path.exists():
            try:
                pages = DocumentProcessor.process_file(file_path, doc.type)
                text_source = " ".join([t for _, t in pages]) if pages else ""
            except Exception:
                pass

    if not text_source.strip():
        return {"questions": [
            f"What are the main key points of {doc.name}?",
            f"What technology stack is described in {doc.name}?",
            f"Can you summarize the primary details of {doc.name}?",
            f"What is the date of creation or upload for {doc.name}?",
            f"Who is the main contact or subject of {doc.name}?"
        ]}

    if not LLMService.check_ollama_status():
        return {"questions": [
            f"What is the content summary of {doc.name}?",
            f"Identify the main topics listed in {doc.name}.",
            f"What are the primary findings in {doc.name}?",
            f"Describe the format and type of {doc.name}.",
            f"Detail any technical projects listed in {doc.name}."
        ]}

    # Ask Ollama to generate 5 questions
    prompt = (
        f"Generate exactly 5 distinct, concise questions that can be answered using this document text. "
        f"Separate each question with a newline. Do not output any intro, numbering, or surrounding explanations.\n\n"
        f"Document snippet:\n{text_source[:5000]}"
    )
    system = "You are a question generator. Output exactly 5 questions, one per line."
    
    try:
        class_chunks = []
        for chunk in LLMService.generate_streaming_response(prompt, system):
            class_chunks.append(chunk)
        raw_text = "".join(class_chunks)
        
        # Split by lines and clean
        lines = [line.strip().strip("0123456789.-* ") for line in raw_text.split("\n") if line.strip()]
        questions = [line for line in lines if line.endswith("?")][:5]
        
        # Fallback if Ollama output was irregular
        while len(questions) < 5:
            questions.append(f"Detail the core properties of {doc.name}?")
            
        return {"questions": questions}
    except Exception as err:
        logger.warning(f"Ollama question generation failed: {str(err)}")
        return {"questions": [
            f"Summarize the key information of {doc.name}?",
            f"What is the background topic of {doc.name}?",
            f"What conclusions are stated in {doc.name}?",
            f"Detail the specific context of {doc.name}?",
            f"How is the data structured in {doc.name}?"
        ]}


@router.post("", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    collection_id: str = Form(...),
    db: Session = Depends(get_db)
):
    """Fallback standard upload endpoint (backward compatibility)."""
    col = db.query(Collection).filter(Collection.id == collection_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Target collection not found.")

    filename = file.filename.replace(" ", "_")
    save_path = UPLOAD_DIR / filename
    
    try:
        async with aiofiles.open(save_path, 'wb') as out_file:
            while content := await file.read(1024 * 1024):
                await out_file.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not save file.")

    ext = filename.split(".")[-1].lower()
    doc_type = "txt"
    if ext in ["pdf"]:
        doc_type = "pdf"
    elif ext in ["doc", "docx"]:
        doc_type = "docx"
    elif ext in ["ppt", "pptx"]:
        doc_type = "ppt"
    elif ext in ["png", "jpg", "jpeg", "webp", "bmp"]:
        doc_type = "image"
        
    doc_id = f"doc-{uuid.uuid4().hex[:6]}"
    file_size_bytes = save_path.stat().st_size
    readable_size = get_readable_size(file_size_bytes)
    
    new_doc = Document(
        id=doc_id,
        name=filename,
        size=readable_size,
        type=doc_type,
        status="Processing",
        upload_date=get_current_timestamp(),
        collection_id=collection_id
    )
    
    try:
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)
        
        from ..database import SessionLocal
        background_tasks.add_task(
            process_and_index_document,
            new_doc.id,
            save_path,
            doc_type,
            collection_id,
            SessionLocal,
            True
        )
        return DocumentResponse(
            id=new_doc.id,
            name=new_doc.name,
            size=new_doc.size,
            type=new_doc.type,
            status=new_doc.status,
            upload_date=new_doc.upload_date,
            tags=[],
            summary="",
            collection_id=new_doc.collection_id
        )
    except Exception as e:
        db.rollback()
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))
