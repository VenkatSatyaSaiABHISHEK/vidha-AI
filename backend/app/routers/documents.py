import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.database_models import Document, Collection
from ..models.schemas import DocumentResponse
from ..services.rag_engine import RagEngine
from ..services.llm_service import LLMService
from ..services.doc_processor import DocumentProcessor
from ..utils.logger import get_logger

logger = get_logger("DocumentsRouter")
router = APIRouter(prefix="/documents", tags=["Documents"])

@router.get("", response_model=List[DocumentResponse])
def list_documents(
    collection_id: Optional[str] = Query(None),
    doc_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Retrieve all indexed documents with active filters."""
    query = db.query(Document)
    
    if collection_id:
        query = query.filter(Document.collection_id == collection_id)
        
    if doc_type and doc_type != "all":
        query = query.filter(Document.type == doc_type)
        
    if search:
        query = query.filter(Document.name.contains(search))
        
    documents = query.order_by(Document.upload_date.desc()).all()
    
    response = []
    for d in documents:
        tags_list = [t.strip() for t in d.tags.split(",") if t.strip()] if d.tags else []
        response.append(DocumentResponse(
            id=d.id,
            name=d.name,
            size=d.size,
            type=d.type,
            status=d.status,
            upload_date=d.upload_date,
            tags=tags_list,
            summary=d.summary,
            collection_id=d.collection_id
        ))
    return response

@router.get("/chunks")
def get_document_chunks(
    collection_id: Optional[str] = Query(None),
    document_id: Optional[str] = Query(None),
    document_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Retrieve all text chunks/embeddings metadata from ChromaDB for inspection."""
    if document_name and not document_id:
        doc = db.query(Document).filter(Document.name == document_name).first()
        if doc:
            document_id = doc.id
    try:
        from ..services.rag_engine import chroma_client
        
        # Determine which collections to scan
        if collection_id:
            safe_name = f"col_{collection_id.replace('-', '_')}"
            collections = []
            try:
                collections = [chroma_client.get_collection(name=safe_name)]
            except Exception:
                pass
        else:
            collections = chroma_client.list_collections()
            
        chunks_list = []
        for col in collections:
            where_filter = {"document_id": document_id} if document_id else None
            data = col.get(where=where_filter, include=["documents", "metadatas"])
            
            ids = data.get("ids", []) or []
            metadatas = data.get("metadatas", []) or []
            documents = data.get("documents", []) or []
            
            for i in range(len(ids)):
                meta = metadatas[i] if i < len(metadatas) else {}
                doc_text = documents[i] if i < len(documents) else ""
                
                chunks_list.append({
                    "id": ids[i],
                    "document_id": meta.get("document_id", ""),
                    "document_name": meta.get("document_name", "Unknown Document"),
                    "page": meta.get("page", 1),
                    "collection_id": meta.get("collection_id", col.name.replace("col_", "").replace("_", "-")),
                    "content": doc_text
                })
                
        return chunks_list
    except Exception as e:
        logger.error(f"Failed retrieving Chroma chunks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Deletes an indexed document from SQLite and cleans all vector database layers."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Document not found."
        )
        
    collection_id = doc.collection_id
    
    try:
        # 1. Clean ChromaDB vectors
        RagEngine.delete_document_vectors(document_id, collection_id)
        
        # 2. Delete file from local uploads storage
        # Check if actual file path exists
        from ..config import UPLOAD_DIR
        local_file = UPLOAD_DIR / doc.name
        if local_file.exists():
            local_file.unlink()
            logger.info(f"Removed physical upload file: {doc.name}")
            
        # 3. Delete DB record
        db.delete(doc)
        db.commit()
        
        logger.info(f"Deleted document index record: {document_id}")
        return {"status": "success", "message": "Document deleted and vectorized index cleared."}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed deleting document {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-distribute")
def analyze_and_distribute_documents(db: Session = Depends(get_db)):
    """Analyze all indexed documents using Ollama and redistribute them to matching category folders."""
    if not LLMService.check_ollama_status():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama local runner is offline. Please start Ollama to enable automated document analysis."
        )

    from ..config import UPLOAD_DIR
    docs = db.query(Document).all()
    redistributed_count = 0
    created_collections = []

    for doc in docs:
        full_text = doc.ocr_text or ""
        file_path = UPLOAD_DIR / doc.name
        
        if not full_text and file_path.exists():
            try:
                pages = DocumentProcessor.process_file(file_path, doc.type)
                full_text = " ".join([t for _, text in pages]) if pages else ""
                if full_text:
                    doc.ocr_text = full_text[:8000]
                    db.commit()
            except Exception as extract_err:
                logger.warning(f"Could not extract file text during redistribution for {doc.name}: {str(extract_err)}")
                continue

        if not full_text.strip():
            continue

        # Ask Ollama for classification
        classification_prompt = (
            f"Identify the main topic or class of the following document content in 1 or 2 words. "
            f"Examples: Python, Resume, Finance, Invoice, Physics, Chemistry, Biology, History, Research.\n"
            f"Do NOT output sentences or punctuation. Return ONLY the category name.\n\n"
            f"Document snippet:\n{full_text[:1500]}\n\n"
            f"Category:"
        )
        classification_system = "You are a topic classification model. You return exactly one category name."

        try:
            class_chunks = []
            for chunk in LLMService.generate_streaming_response(classification_prompt, classification_system):
                class_chunks.append(chunk)
            category_name = "".join(class_chunks).strip().strip("'\".").title()

            # Sanity check for a clean category string
            if category_name and len(category_name) < 25 and (category_name.count(" ") <= 1):
                # Look up or create collection
                existing_col = db.query(Collection).filter(Collection.name == category_name).first()
                if existing_col:
                    new_collection_id = existing_col.id
                else:
                    new_collection_id = f"col-{uuid.uuid4().hex[:6]}"
                    new_col = Collection(
                        id=new_collection_id,
                        name=category_name,
                        description=f"Auto-categorized collection for topic {category_name}.",
                        icon_type="FolderOpen"
                    )
                    db.add(new_col)
                    db.commit()
                    created_collections.append(category_name)
                    logger.info(f"Created new auto-categorized collection folder '{category_name}'")

                # If the collection changed, move vectors
                if doc.collection_id != new_collection_id:
                    # 1. Delete existing vectors
                    try:
                        RagEngine.delete_document_vectors(doc.id, doc.collection_id)
                    except Exception as delete_vec_err:
                        logger.warning(f"Error removing vectors for migration: {str(delete_vec_err)}")

                    # 2. Re-extract pages and index under the new collection ID
                    if file_path.exists():
                        pages_content = DocumentProcessor.process_file(file_path, doc.type)
                        if pages_content:
                            RagEngine.index_document(
                                document_id=doc.id,
                                document_name=doc.name,
                                pages_content=pages_content,
                                collection_id=new_collection_id
                            )

                    # 3. Update database record
                    doc.collection_id = new_collection_id
                    db.commit()
                    redistributed_count += 1
                    logger.info(f"Moved document '{doc.name}' to collection '{category_name}'")

        except Exception as ollama_err:
            logger.error(f"Redistribution analysis failed for {doc.name}: {str(ollama_err)}")
            continue

    return {
        "status": "success",
        "redistributed_count": redistributed_count,
        "created_collections": created_collections
    }
