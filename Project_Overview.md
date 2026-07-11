# Vedha AI — Technical Project Overview & Architecture Guide

Vedha AI is an advanced, fully local and offline **Retrieval-Augmented Generation (RAG)** knowledge base application. It allows users to securely upload, index, scan (via OCR), search, and chat with their documents (PDFs, Images, DOCX, Text, etc.) without sending any data to external cloud servers. 

---

## 1. Technology Stack

### Frontend (Client-Side)
* **Core Framework**: React 18 with TypeScript.
* **Build System**: Vite (for fast hot-module replacement and compilation).
* **Styling**: TailwindCSS (responsive layouts, custom dark modes, glassmorphism UI elements).
* **Animation**: Framer Motion (page transitions, interactive elements, AI orb animations).
* **Iconography**: Lucide React.
* **Router**: React Router DOM (client-side routing).

### Backend (Server-Side)
* **Web Framework**: FastAPI (Python).
* **Relational Database**: SQLite (via SQLAlchemy ORM) to manage document metadata, collections, system settings, and chat history.
* **Vector Database**: ChromaDB (persistent vector store for local embeddings).
* **Text Processing & Chunking**: LangChain / LangChain Community (RecursiveCharacterTextSplitter).
* **Embeddings**: HuggingFace SentenceTransformers (`all-MiniLM-L6-v2` running entirely offline on CPU).
* **Optical Character Recognition (OCR)**: PaddleOCR (for extracting text from scanned images and layouts).
* **LLM Engine Integration**: Local Ollama server (`http://localhost:11434`), supporting local models like `qwen2.5:3b` with Server-Sent Events (SSE) response streaming.

---

## 2. Directory Structure

```text
vedha-ai/
├── backend/                       # FastAPI Backend
│   ├── app/
│   │   ├── models/                # Database schemas and models
│   │   │   ├── database_models.py # SQLAlchemy models (Collections, Documents, Logs, Chats)
│   │   │   └── schemas.py         # Pydantic validation schemas
│   │   ├── routers/               # API endpoints
│   │   │   ├── analytics.py       # DB size, memory, console log stream endpoints
│   │   │   ├── chat.py            # Session management and streaming chat endpoint
│   │   │   ├── collections.py     # Create, list, delete document directories
│   │   │   ├── documents.py       # SQLite doc registry & Chroma chunks retrieval
│   │   │   └── settings.py        # System configuration (LLM, chunk size, overlap)
│   │   ├── services/              # Core business logic handlers
│   │   │   ├── doc_processor.py   # PDF text extraction and PaddleOCR text analyzer
│   │   │   ├── llm_service.py     # Local Ollama streaming completion generator
│   │   │   ├── rag_engine.py      # Chroma client, text splitter, similarity search
│   │   │   └── system_service.py  # System memory usage and app.log console tracker
│   │   ├── config.py              # Directory constants and RAG parameters
│   │   └── database.py            # SQLite connection setup
│   ├── data/                      # Local data folders
│   │   ├── chroma/                # Persistent vector database collections
│   │   ├── uploads/               # Indexed source files storage
│   │   └── app.db                 # SQLite relational database file
│   ├── main.py                    # Server startup entry point
│   ├── requirements.txt           # Python backend dependencies
│   └── venv/                      # Local Python virtual environment
│
├── src/                           # React Frontend
│   ├── components/                # Reusable UI components
│   │   ├── AiOrb.tsx              # Interactive voice orb widget
│   │   ├── GlassCard.tsx          # Frosted glass panel styling container
│   │   └── Login.tsx              # Secure gateway login form
│   ├── context/                   # Global state providers
│   │   └── AuthContext.tsx        # Basic session gateway gatekeeper
│   ├── hooks/                     # Custom lifecycle hooks
│   │   └── useClock.ts            # Digital navbar clock hook
│   ├── layouts/                   # Outer page view structures
│   │   └── RootLayout.tsx         # Floating header navigation, clock & avatar layout
│   ├── pages/                     # Core application dashboards
│   │   ├── Home.tsx               # AI input orb, file uploader and search query page
│   │   ├── Vault.tsx              # Collections manager and directory structure
│   │   ├── Documents.tsx          # General documents manager and search list
│   │   ├── Chat.tsx               # ChatGPT-like LLM chat client with inline citations
│   │   ├── Chunks.tsx             # ChromaDB vector chunk metadata registry
│   │   ├── Analytics.tsx          # Real-time telemetry, DB allocation ring & live logs
│   │   └── Settings.tsx           # Offline models config & service connection indicators
│   ├── services/                  # Network layer client
│   │   └── api.ts                 # Fetch wrappers and SSE response stream handlers
│   ├── utils/                     # Helper functions
│   ├── App.tsx                    # React routes provider
│   ├── index.css                  # Global Tailwind imports and design presets
│   └── main.tsx                   # Frontend React root mount entry
```

---

## 3. Core Features & Implementation Breakdown

### A. Document Upload, OCR & Vectorization Pipeline
* **User Goal**: Drag-and-drop or select any file (PDF, Docx, Image) and ingest it into a collection.
* **How It Is Achieved**:
  1. The frontend (`Home.tsx`, `Documents.tsx`) sends a multipart form request to `/api/upload`.
  2. The backend (`doc_processor.py`) reads the file. For text-based PDFs or DOCX, it extracts text directly. For images or scanned documents, it runs `PaddleOCR` to transcribe textual content.
  3. The parsed text is passed to `rag_engine.py`, where a `RecursiveCharacterTextSplitter` divides it into overlaps of text segments (e.g., `512` token blocks with `64` overlap).
  4. Embedding vectors (384 dimensions) are generated offline using `HuggingFaceEmbeddings` and stored in `ChromaDB` associated with metadata pointing to the source file name, collection, and page number.

### B. Offline Conversational AI Chat with Citations
* **User Goal**: Have multi-turn conversations with an AI model styled by a customized Persona, with direct citations link previews.
* **How It Is Achieved**:
  1. The user inputs queries in the new simplified chat page (`Chat.tsx`).
  2. The client triggers a request to `/api/chat/message` passing the active `session_id`, `prompt`, `collection_id`, and `model` (e.g. `qwen2.5:3b`).
  3. The backend (`chat.py`) queries ChromaDB via `RagEngine.search_similar_chunks` to retrieve the 4 most similar text blocks.
  4. A prompt template containing the conversation history (last 6 turns), system instructions, retrieved document snippet blocks, and user query is compiled.
  5. The backend streams tokens from the local Ollama server back to the frontend using Server-Sent Events (SSE). 
  6. The frontend renders the response in real-time. Document source links (citations) appear directly under the message bubble. Clicking them loads a context drawer showing the corresponding text snippet.

### C. Telemetry, Memory & Analytics Dashboard
* **User Goal**: Monitor vector database growth, system performance, memory usages, and categories.
* **How It Is Achieved**:
  1. The page `/analytics` fetches metrics from `/api/analytics` every 4 seconds.
  2. **Storage Allocation (Stacked Ring Chart)**: The frontend retrieves all indexed documents and groups them by type (`PDF`, `Image`, `Text`), dynamically computing percentages and drawing a multi-colored SVG ring representation.
  3. **Vector DB Growth**: Plots the real number of vectors (total chunks in Chroma DB) on a database timeline graph.
  4. **Chroma DB Chunks inspector**: A dedicated **"Inspect Database Chunks"** button redirects to `/chunks`.
  5. **Console logs**: Feeds live logging output (filtered from the local `app.log` file) to a dark terminal monitor.

### D. Vector DB Chunks Registry (`/chunks`)
* **User Goal**: Browse the raw segmented text blocks that the AI is using for context.
* **How It Is Achieved**:
  1. The user accesses `/chunks` (or clicks "Inspect Chunks" on Analytics).
  2. The page calls the backend endpoint `/api/documents/chunks` (optionally filtering by `collection_id`).
  3. The backend calls `chroma_client.get_collection().get()`, returning the original raw text fragments and metadata.
  4. The frontend renders them in a grid, allowing the user to search/filter by keyword (with highlighted text matches).

### E. Offline Service Connection Status & Helper
* **User Goal**: Configure the system and verify if local LLM/OCR connections are working.
* **How It Is Achieved**:
  1. The page `/settings` performs active health checks to `http://localhost:8000/api/settings` and the local Ollama server.
  2. If Ollama is detected as offline/unavailable, it displays a command box with setup helpers (`ollama run qwen2.5:3b`) with a clipboard copy utility.
  3. Theme customization controls were removed to stick with the premium preset aesthetic.

---

## 4. Architectural Data Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as User Interface (React)
    participant API as FastAPI Backend (Uvicorn)
    database SQLite as Relational DB (app.db)
    participant RAG as RAG Service (LangChain)
    database Chroma as Vector DB (ChromaDB)
    participant Ollama as Local LLM (Ollama)

    %% Upload Flow
    rect rgb(235, 240, 255)
        note right of User: Document Ingestion Flow
        User->>API: POST /api/upload (File)
        API->>RAG: Extract Text / Run PaddleOCR (if image)
        RAG->>RAG: Split text into 512-token chunks
        RAG->>Chroma: Save vectors + source metadata
        API->>SQLite: Insert document metadata (status='Indexed')
        API-->>User: Upload successful
    end

    %% Chat Flow
    rect rgb(240, 255, 240)
        note right of User: RAG Chat Flow
        User->>API: POST /api/chat/message (Prompt + Collection)
        API->>Chroma: Similarity Search (find similar chunks)
        Chroma-->>API: Return matching text snippets
        API->>Ollama: POST /api/generate (Context + Prompt)
        Ollama-->>API: Stream response tokens
        API-->>User: Stream tokens + Citations (SSE)
        API->>SQLite: Save user & assistant messages to history
    end

    %% Telemetry Flow
    rect rgb(255, 245, 235)
        note right of User: Real-Time Analytics Flow
        User->>API: GET /api/analytics
        API->>Chroma: Get total collection chunk count
        API->>SQLite: Count collections & documents
        API-->>User: Return storage size, chunk sizes & log lines
    end
```

---

## 5. Summary of Achievements

1. **100% Offline Integrity**: Replaced all external cloud placeholders with offline Python equivalents (PaddleOCR for images, sentence-transformers for vector embeddings).
2. **Dynamic telemetry**: Replaced mock figures on the Analytics panel with real database sizes, active models, live document category ratios, and actual Chroma vector counts.
3. **Optimized Scrolling**: Removed fixed layout constraints (`h-screen overflow-hidden`) from the RootLayout shell, enabling smooth scrolling across all data-heavy dashboard sections.
4. **Transparent DB Inspecting**: Created a dedicated view to search, highlight, and verify raw text chunks inside vector collections, ensuring full database transparency.

---

## 6. Step-by-Step Rebuild & Installation Guide

This guide enables anyone to reconstruct, install, and run Vedha AI on a clean machine from scratch.

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **Python**: v3.10.x or v3.11.x (PaddleOCR requires specific C++ libraries on Windows)
* **Ollama**: Installed and running locally (get it from [ollama.com](https://ollama.com))

---

### Step 1: Clone and Set Up Codebase Structure
Create the file directory structure matching Section 2:
```bash
mkdir -p vedha-ai/backend/app/models
mkdir -p vedha-ai/backend/app/routers
mkdir -p vedha-ai/backend/app/services
mkdir -p vedha-ai/backend/data/chroma
mkdir -p vedha-ai/backend/data/uploads
mkdir -p vedha-ai/src/pages
mkdir -p vedha-ai/src/layouts
mkdir -p vedha-ai/src/components
mkdir -p vedha-ai/src/services
```

---

### Step 2: Backend Setup & Virtual Environment
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Initialize a Python virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the virtual environment:
   * **Windows (PowerShell)**: `.\venv\Scripts\Activate.ps1`
   * **macOS/Linux**: `source venv/bin/activate`
4. Install python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

### Step 3: Local LLM Configuration (Ollama)
Vedha AI expects a local LLM runner to generate responses.
1. Download Ollama and start the application.
2. In your terminal, download the default `qwen2.5:3b` model weights (runs offline on 8GB RAM laptops):
   ```bash
   ollama pull qwen2.5:3b
   ```
3. *Optional*: If running the frontend client on a separate device, start Ollama with CORS permissions:
   * **Windows**: Set user environment variable `OLLAMA_ORIGINS="*"` and restart Ollama.
   * **Linux/macOS**: `OLLAMA_ORIGINS="*" ollama serve`

---

### Step 4: Run the Backend Server
The server initializes its SQLite metadata file (`app.db`) and Chroma DB directory automatically on the first boot.
1. Ensure your virtual environment is active inside `/backend`.
2. Start the FastAPI development server using Uvicorn:
   ```bash
   python main.py
   # Or run manually via:
   # uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
3. Open `http://127.0.0.1:8000/docs` in your browser to verify the interactive Swagger API documentation is loaded.

---

### Step 5: Frontend Installation & Run
1. Navigate to the project root directory (containing `package.json`):
   ```bash
   cd ..
   ```
2. Install the node packages:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
4. Open the application in your browser at `http://localhost:5173`.
5. Enter secure credentials (default user session bypass) to enter the system.

---

### Troubleshooting & Key Verifications
* **CORS Errors**: The backend includes FastAPI CORSMiddleware configured to permit connections from `http://localhost:5173` and `http://127.0.0.1:5173`. If you host your frontend on a custom host/port, update it in `backend/app/main.py`.
* **Missing Embedding Model**: On first document ingestion, the backend downloads the sentence-transformer weights (`all-MiniLM-L6-v2`) locally to your machine (takes ~120MB). Ensure you have internet access for this initial boot setup. All future embeddings run entirely offline.
* **OCR Failures**: If PaddleOCR crashes, ensure you have the Visual C++ Redistributable tools installed (on Windows) or compile PaddleOCR dependencies accordingly.
