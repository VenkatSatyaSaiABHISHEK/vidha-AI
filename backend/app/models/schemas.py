from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

# Documents
class DocumentBase(BaseModel):
    id: str
    name: str
    size: str
    type: str
    status: str
    upload_date: str
    tags: List[str] = []
    summary: Optional[str] = None
    collection_id: Optional[str] = None

class DocumentResponse(DocumentBase):
    class Config:
        from_attributes = True

# Collections
class CollectionBase(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    icon_type: str = "BookOpen"
    created_at: str
    updated_at: str

class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon_type: Optional[str] = "BookOpen"

class CollectionUpdate(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionResponse(CollectionBase):
    documents_count: int = 0
    progress: int = 100
    class Config:
        from_attributes = True

# Chat
class MessageBase(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str
    citations: List[str] = []

    class Config:
        from_attributes = True

    @field_validator('citations', mode='before')
    @classmethod
    def parse_citations(cls, v):
        if isinstance(v, str):
            if not v.strip():
                return []
            return [c.strip() for c in v.split(",") if c.strip()]
        return v

class ChatSessionBase(BaseModel):
    id: str
    title: str
    date: str
    collection_id: Optional[str] = None

class ChatSessionResponse(ChatSessionBase):
    messages: List[MessageBase] = []
    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    session_id: str
    prompt: str
    model: Optional[str] = "qwen2.5:3b"
    collection_id: Optional[str] = None
    mode: Optional[str] = "learning"
    explain_level: Optional[str] = "intermediate"

class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Chat Thread"
    collection_id: Optional[str] = None

# Search
class SearchRequest(BaseModel):
    query: str
    collection_id: Optional[str] = None
    limit: Optional[int] = 5

class SearchResultItem(BaseModel):
    document_name: str
    content: str
    page_number: Optional[int] = 1
    score: float

# Settings
class OCRSettingsSchema(BaseModel):
    enabled: bool = True
    language: str = "ch_en" # default PaddleOCR languages

class EmbeddingSettingsSchema(BaseModel):
    model: str = "all-MiniLM-L6-v2"
    chunk_size: int = 512
    chunk_overlap: int = 64

class SystemSettingsResponse(BaseModel):
    active_model: str = "qwen2.5:3b"
    ocr_enabled: bool = True
    ocr_language: str = "ch_en"
    chunk_size: int = 512
    chunk_overlap: int = 64

# Analytics
class RecentOCRActivity(BaseModel):
    timestamp: str
    document_name: str
    status: str

class AnalyticsResponse(BaseModel):
    memory_used: float  # GB
    memory_max: float   # GB
    collections_count: int
    documents_count: int
    active_model: str
    ocr_status: str
    recent_uploads: List[DocumentResponse]
    recent_ocr: List[RecentOCRActivity]
    console_logs: List[str]
    total_chunks: int = 0
    chunk_size: int = 512
    chunk_overlap: int = 64
