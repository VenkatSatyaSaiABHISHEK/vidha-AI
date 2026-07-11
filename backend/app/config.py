import os
from pathlib import Path

# Base workspace directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
CHROMA_DIR = DATA_DIR / "chroma"

# Ensure dirs exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

# Database Url
DATABASE_URL = f"sqlite:///{DATA_DIR}/vedha.db"

# Ollama Endpoint
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")

# Defaults
DEFAULT_EMBEDDING_MODEL = "all-MiniLM-L6-v2"
DEFAULT_LLM_MODEL = "qwen2.5:3b"

# RAG configuration defaults
DEFAULT_CHUNK_SIZE = 512
DEFAULT_CHUNK_OVERLAP = 64
