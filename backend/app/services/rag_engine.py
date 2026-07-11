import chromadb
from pathlib import Path
from typing import List, Dict, Any, Tuple
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter

try:
    from langchain_community.embeddings import HuggingFaceEmbeddings
except ImportError:
    from langchain.embeddings import HuggingFaceEmbeddings

try:
    from langchain_community.vectorstores import Chroma
except ImportError:
    from langchain.vectorstores import Chroma

try:
    from langchain_core.documents import Document as LangChainDoc
except ImportError:
    from langchain.docstore.document import Document as LangChainDoc

from ..config import CHROMA_DIR, DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP
from ..utils.logger import get_logger

logger = get_logger("RagEngine")

# Initialize Embedding function
# This uses local sentence-transformers running entirely offline.
logger.info("Initializing HuggingFace SentenceTransformer embedding function...")
embedding_function = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2",
    model_kwargs={'device': 'cpu'}
)

# Persistent Chroma Client
chroma_client = chromadb.PersistentClient(path=str(CHROMA_DIR))

class RagEngine:
    @staticmethod
    def get_vectorstore(collection_name: str) -> Chroma:
        """Returns the isolated Chroma collection wrapper for a collection."""
        # Chroma collection names must start with alpha, be alphanumeric, and between 3-63 chars
        safe_name = f"col_{collection_name.replace('-', '_')}"
        if len(safe_name) < 3:
            safe_name += "_ext"
        elif len(safe_name) > 63:
            safe_name = safe_name[:63]
            
        return Chroma(
            client=chroma_client,
            collection_name=safe_name,
            embedding_function=embedding_function
        )

    @classmethod
    def index_document(
        cls, 
        document_id: str, 
        document_name: str, 
        pages_content: List[Tuple[int, str]], 
        collection_id: str,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        chunk_overlap: int = DEFAULT_CHUNK_OVERLAP
    ) -> bool:
        """Splits document text into chunks, generates embeddings, and saves to Chroma."""
        try:
            logger.info(f"Splitting document {document_name} with chunk size {chunk_size}")
            
            # Prepare LangChain docs with metadata (page numbers and source doc name)
            langchain_docs = []
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size, 
                chunk_overlap=chunk_overlap
            )
            
            for page_num, text in pages_content:
                if not text.strip():
                    continue
                # Split this page
                chunks = text_splitter.split_text(text)
                for chunk in chunks:
                    langchain_docs.append(LangChainDoc(
                        page_content=chunk,
                        metadata={
                            "document_id": document_id,
                            "document_name": document_name,
                            "page": page_num,
                            "collection_id": collection_id
                        }
                    ))
            
            if not langchain_docs:
                logger.warning(f"No parseable text chunks generated for {document_name}")
                return False
            
            # Get vectorstore and add documents
            vectorstore = cls.get_vectorstore(collection_id)
            vectorstore.add_documents(langchain_docs)
            logger.info(f"Successfully vectorized and loaded {len(langchain_docs)} chunks for {document_name}")
            return True
        except Exception as e:
            logger.error(f"Failed indexing document vectors for {document_name}: {str(e)}")
            return False

    @classmethod
    def delete_document_vectors(cls, document_id: str, collection_id: str):
        """Removes all vector nodes associated with a document ID."""
        try:
            safe_name = f"col_{collection_id.replace('-', '_')}"
            if len(safe_name) < 3:
                safe_name += "_ext"
            elif len(safe_name) > 63:
                safe_name = safe_name[:63]
            
            # Access native Chroma client to handle deletion by metadata filter
            try:
                collection = chroma_client.get_collection(name=safe_name)
                collection.delete(where={"document_id": document_id})
                logger.info(f"Cleaned native vector indexes for document ID: {document_id}")
            except Exception as native_err:
                logger.warning(f"Native Chroma delete failed: {str(native_err)}. Falling back to langchain vectorstore.")
                vectorstore = cls.get_vectorstore(collection_id)
                vectorstore.delete(where={"document_id": document_id})
        except Exception as e:
            logger.error(f"Failed clearing vector registry for document ID {document_id}: {str(e)}")

    @classmethod
    def search_similar_chunks(
        cls, 
        query: str, 
        collection_id: str, 
        limit: int = 4
    ) -> List[Dict[str, Any]]:
        """Queries vector database to extract key text blocks matching the input."""
        results = []
        try:
            vectorstore = cls.get_vectorstore(collection_id)
            # Perform similarity search with confidence scores
            # Note: Chroma distance represents L2 norm. Score translates distance to similarity score.
            raw_results = vectorstore.similarity_search_with_relevance_scores(query, k=limit)
            
            for doc, score in raw_results:
                # Convert standard score scale
                similarity = float(score)
                # Cap minimum similarity metric representation
                if similarity < 0.0:
                    similarity = 0.0
                
                results.append({
                    "document_name": doc.metadata.get("document_name", "Unknown Document"),
                    "page_number": doc.metadata.get("page", 1),
                    "content": doc.page_content,
                    "score": round(similarity * 100, 1)  # Format as percentage score
                })
        except Exception as e:
            logger.error(f"Failed querying similar vectors in {collection_id}: {str(e)}")
        return results

    @classmethod
    def get_total_chunks(cls) -> int:
        """Returns the total number of document chunks currently in all Chroma collections."""
        try:
            total = 0
            collections = chroma_client.list_collections()
            for col in collections:
                total += col.count()
            return total
        except Exception as e:
            logger.error(f"Failed getting total chunks count: {str(e)}")
            return 0
