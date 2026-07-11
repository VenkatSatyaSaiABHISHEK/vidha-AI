import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.database_models import Collection, Document
from ..models.schemas import CollectionResponse, CollectionCreate, CollectionUpdate
from ..utils.logger import get_logger
from ..services.rag_engine import RagEngine

logger = get_logger("CollectionsRouter")
router = APIRouter(prefix="/collections", tags=["Collections"])

@router.get("", response_model=List[CollectionResponse])
def list_collections(db: Session = Depends(get_db)):
    """Retrieve all available knowledge collections."""
    collections = db.query(Collection).all()
    response = []
    for col in collections:
        docs_count = db.query(Document).filter(Document.collection_id == col.id).count()
        response.append(CollectionResponse(
            id=col.id,
            name=col.name,
            description=col.description,
            icon_type=col.icon_type,
            created_at=col.created_at,
            updated_at=col.updated_at,
            documents_count=docs_count,
            progress=100
        ))
    return response

@router.post("", response_model=CollectionResponse)
def create_collection(payload: CollectionCreate, db: Session = Depends(get_db)):
    """Create a new offline knowledge vault box."""
    # Check uniqueness
    existing = db.query(Collection).filter(Collection.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="A collection with this name already exists."
        )
        
    col_id = f"col-{uuid.uuid4().hex[:6]}"
    from datetime import datetime
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    new_col = Collection(
        id=col_id,
        name=payload.name,
        description=payload.description,
        icon_type=payload.icon_type or "BookOpen",
        created_at=now_str,
        updated_at=now_str
    )
    
    try:
        db.add(new_col)
        db.commit()
        db.refresh(new_col)
        logger.info(f"Created collection: {new_col.name} ({new_col.id})")
        return CollectionResponse(
            id=new_col.id,
            name=new_col.name,
            description=new_col.description,
            icon_type=new_col.icon_type,
            created_at=new_col.created_at,
            updated_at=new_col.updated_at,
            documents_count=0,
            progress=100
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Failed creating collection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{collection_id}")
def delete_collection(collection_id: str, db: Session = Depends(get_db)):
    """Deletes a collection. Cascades and deletes all child documents and their vector embeddings."""
    col = db.query(Collection).filter(Collection.id == collection_id).first()
    if not col:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Collection not found."
        )
        
    try:
        # Fetch child documents to clean up vector stores before deletion
        docs = db.query(Document).filter(Document.collection_id == collection_id).all()
        for doc in docs:
            # Delete Chroma vectors
            RagEngine.delete_document_vectors(doc.id, collection_id)
            
        # Delete collection record (cascade takes care of Document db records)
        db.delete(col)
        db.commit()
        logger.info(f"Deleted collection and all children: {collection_id}")
        return {"status": "success", "message": "Collection and associated documents deleted."}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed deleting collection {collection_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{collection_id}", response_model=CollectionResponse)
def update_collection(collection_id: str, payload: CollectionUpdate, db: Session = Depends(get_db)):
    """Update a collection name or description."""
    col = db.query(Collection).filter(Collection.id == collection_id).first()
    if not col:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Collection not found."
        )
        
    # If name changes, check uniqueness
    if payload.name != col.name:
        existing = db.query(Collection).filter(Collection.name == payload.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="A collection with this name already exists."
            )
            
    col.name = payload.name
    if payload.description is not None:
        col.description = payload.description
        
    from datetime import datetime
    col.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    try:
        db.commit()
        db.refresh(col)
        docs_count = db.query(Document).filter(Document.collection_id == col.id).count()
        return CollectionResponse(
            id=col.id,
            name=col.name,
            description=col.description,
            icon_type=col.icon_type,
            created_at=col.created_at,
            updated_at=col.updated_at,
            documents_count=docs_count,
            progress=100
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
