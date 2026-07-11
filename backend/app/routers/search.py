from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.schemas import SearchRequest, SearchResultItem
from ..services.rag_engine import RagEngine
from ..utils.logger import get_logger

logger = get_logger("SearchRouter")
router = APIRouter(prefix="/search", tags=["Search"])

@router.post("", response_model=List[SearchResultItem])
def search_similar_embeddings(payload: SearchRequest, db: Session = Depends(get_db)):
    """Retrieve matching text snippets from the vector database."""
    if not payload.collection_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="collection_id parameter is required to search collections."
        )
        
    logger.info(f"Similarity query inside collection {payload.collection_id}: '{payload.query}'")
    
    try:
        results = RagEngine.search_similar_chunks(
            query=payload.query,
            collection_id=payload.collection_id,
            limit=payload.limit or 5
        )
        
        response = [
            SearchResultItem(
                document_name=item["document_name"],
                content=item["content"],
                page_number=item["page_number"],
                score=item["score"]
            )
            for item in results
        ]
        return response
    except Exception as e:
        logger.error(f"Search endpoint query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
