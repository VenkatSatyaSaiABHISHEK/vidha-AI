from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.database_models import SystemSettings
from ..models.schemas import SystemSettingsResponse
from ..utils.logger import get_logger

logger = get_logger("SettingsRouter")
router = APIRouter(prefix="/settings", tags=["Settings"])

def get_setting(db: Session, key: str, default: str) -> str:
    item = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not item:
        # Create default
        item = SystemSettings(key=key, value=default)
        db.add(item)
        db.commit()
    return item.value

def set_setting(db: Session, key: str, value: str):
    item = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not item:
        item = SystemSettings(key=key, value=value)
        db.add(item)
    else:
        item.value = value
    db.commit()

@router.get("", response_model=SystemSettingsResponse)
def read_settings(db: Session = Depends(get_db)):
    """Fetch current system configuration parameters."""
    return SystemSettingsResponse(
        active_model=get_setting(db, "active_model", "qwen2.5:3b"),
        ocr_enabled=get_setting(db, "ocr_enabled", "True") == "True",
        ocr_language=get_setting(db, "ocr_language", "en"),
        chunk_size=int(get_setting(db, "chunk_size", "512")),
        chunk_overlap=int(get_setting(db, "chunk_overlap", "64"))
    )

@router.post("")
def update_settings(payload: SystemSettingsResponse, db: Session = Depends(get_db)):
    """Update current system configuration parameters."""
    try:
        set_setting(db, "active_model", payload.active_model)
        set_setting(db, "ocr_enabled", "True" if payload.ocr_enabled else "False")
        set_setting(db, "ocr_language", payload.ocr_language)
        set_setting(db, "chunk_size", str(payload.chunk_size))
        set_setting(db, "chunk_overlap", str(payload.chunk_overlap))
        logger.info("System settings updated successfully.")
        return {"status": "success", "message": "Settings updated."}
    except Exception as e:
        logger.error(f"Failed updating settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
