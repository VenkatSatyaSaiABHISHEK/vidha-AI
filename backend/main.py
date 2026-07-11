import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.config import OLLAMA_HOST
from app.utils.logger import get_logger
from app.services.llm_service import LLMService

# Import routers
from app.routers import chat, upload, documents, collections, search, settings, analytics, voice

logger = get_logger("Main")

app = FastAPI(
    title="Vedha AI Offline RAG Backend",
    description="Secure offline knowledge processing engine utilizing FastAPI, ChromaDB, and local Ollama Qwen2.5 integrations.",
    version="1.0.0"
)

# CORS configurations - Allow React dev server origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production environments if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(chat.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(collections.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(voice.router, prefix="/api")

@app.on_event("startup")
def startup_event():
    """Initializes local tables and runs health check queries."""
    logger.info("Vedha AI offline RAG backend server starting up...")
    
    # 1. SQL Database Setup
    init_db()
    logger.info("SQLite relational indices initialized successfully.")
    
    # 2. Local Ollama Runner Health Check
    ollama_running = LLMService.check_ollama_status()
    if ollama_running:
        logger.info(f"Ollama runner verified active at: {OLLAMA_HOST}")
        installed = LLMService.get_installed_models()
        logger.info(f"Available local models: {installed}")
    else:
        logger.warning(
            f"Ollama runner is not responding at: {OLLAMA_HOST}. "
            "Please ensure the Ollama desktop agent is running to enable offline text generation."
        )

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "app": "Vedha AI Local Engine",
        "offline": True
    }

if __name__ == "__main__":
    from pathlib import Path
    app_dir = Path(__file__).resolve().parent / "app"
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True, reload_dirs=[str(app_dir)])
