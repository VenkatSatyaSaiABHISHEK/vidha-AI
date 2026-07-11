from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.database_models import Collection, Document, SystemSettings
from ..models.schemas import AnalyticsResponse, DocumentResponse, RecentOCRActivity
from ..services.system_service import SystemService
from ..services.doc_processor import DocumentProcessor
from ..services.rag_engine import RagEngine
from .settings import get_setting

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("", response_model=AnalyticsResponse)
def get_analytics_metrics(db: Session = Depends(get_db)):
    """Fetch complete telemetry, recent uploads, and console log feeds."""
    telemetry = SystemService.get_telemetry_metrics()
    
    # Counts
    collections_count = db.query(Collection).count()
    documents_count = db.query(Document).count()
    
    # Active model
    active_model = get_setting(db, "active_model", "qwen2.5:3b")
    
    # OCR Engine status check
    # If the ocr initialized successfully, it is Online
    ocr_available = DocumentProcessor.initialize_ocr() is not None
    ocr_status = "Online" if ocr_available else "Offline"
    
    # Recent Uploads
    uploads = db.query(Document).order_by(Document.upload_date.desc()).limit(5).all()
    recent_uploads = []
    for u in uploads:
        tags_list = [t.strip() for t in u.tags.split(",") if t.strip()] if u.tags else []
        recent_uploads.append(DocumentResponse(
            id=u.id,
            name=u.name,
            size=u.size,
            type=u.type,
            status=u.status,
            upload_date=u.upload_date,
            tags=tags_list,
            summary=u.summary,
            collection_id=u.collection_id
        ))
        
    # Recent OCR Activity list (Extract from documents where OCR text is present)
    ocr_docs = db.query(Document).filter(Document.ocr_text != None).order_by(Document.upload_date.desc()).limit(5).all()
    recent_ocr = [
        RecentOCRActivity(
            timestamp=doc.upload_date,
            document_name=doc.name,
            status="SUCCESS" if doc.status == "Indexed" else "FAILED"
        )
        for doc in ocr_docs
    ]
    
    return AnalyticsResponse(
        memory_used=telemetry["storage_used_gb"],
        memory_max=telemetry["storage_limit_gb"],
        collections_count=collections_count,
        documents_count=documents_count,
        active_model=active_model,
        ocr_status=ocr_status,
        recent_uploads=recent_uploads,
        recent_ocr=recent_ocr,
        console_logs=SystemService.get_console_logs(),
        total_chunks=RagEngine.get_total_chunks(),
        chunk_size=int(get_setting(db, "chunk_size", "512")),
        chunk_overlap=int(get_setting(db, "chunk_overlap", "64"))
    )
