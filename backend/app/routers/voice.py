from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import Response
from ..services.voice_service import VoiceService
from ..utils.logger import get_logger

logger = get_logger("VoiceRouter")
router = APIRouter(prefix="/voice", tags=["Voice"])

@router.get("/tts")
def text_to_speech(text: str = Query(...)):
    """Synthesize speech audio from text using local Kokoro-82M model or fallback wave generator."""
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text query parameter is empty")
    try:
        audio_bytes = VoiceService.synthesize_speech(text)
        return Response(content=audio_bytes, media_type="audio/wav")
    except Exception as e:
        logger.error(f"TTS synthesis API error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
