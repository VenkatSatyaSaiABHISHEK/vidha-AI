import os
import sys
import time
from pathlib import Path

# Add backend directory to path to enable direct imports
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.append(str(backend_dir))

# Reconfigure stdout to use utf-8 to prevent UnicodeEncodeError on Windows
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def run_evaluation():
    print("=" * 60)
    print("VEDHA AI — SYSTEM EVALUATION & BENCHMARK SCRIPT")
    print("=" * 60)
    
    # 1. Check Python environment and imports
    print("\n[STEP 1] Verifying System Dependencies...")
    try:
        import chromadb
        import requests
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
        except ImportError:
            from langchain.text_splitter import RecursiveCharacterTextSplitter
        from sentence_transformers import SentenceTransformer
        print("✓ Core dependencies imported successfully!")
    except ImportError as e:
        print(f"✗ Dependency check failed: {str(e)}")
        print("Please activate your virtual environment: .\\backend\\venv\\Scripts\\Activate.ps1")
        sys.exit(1)
        
    # 2. Test Local Embedding Model Latency
    print("\n[STEP 2] Evaluating local embedding model (all-MiniLM-L6-v2)...")
    try:
        from app.services.rag_engine import embedding_function
        t0 = time.time()
        test_text = "Vedha AI is an offline education assistant utilizing local LLMs and RAG."
        embedding = embedding_function.embed_query(test_text)
        t_duration = time.time() - t0
        vector_dim = len(embedding)
        print(f"✓ Embeddings running successfully on device: {embedding_function.model_kwargs.get('device', 'cpu')}")
        print(f"   - Input phrase: '{test_text}'")
        print(f"   - Generated Vector Dimensions: {vector_dim}")
        print(f"   - Generation Latency: {t_duration * 1000:.2f} ms")
        if t_duration < 0.5:
            print("   - Performance Rating: EXCELLENT (sub-500ms)")
        else:
            print("   - Performance Rating: ACCEPTABLE")
    except Exception as e:
        print(f"✗ Embedding evaluation failed: {str(e)}")

    # 3. Test Ollama Daemon Connectivity
    print("\n[STEP 3] Connecting to Local Ollama Runner...")
    from app.services.llm_service import LLMService
    from app.config import DEFAULT_LLM_MODEL, OLLAMA_HOST
    
    ollama_online = LLMService.check_ollama_status()
    if ollama_online:
        print(f"✓ Ollama service detected online at {OLLAMA_HOST}")
        installed = LLMService.get_installed_models()
        print(f"   - Installed models: {installed}")
        
        has_default = LLMService.check_model_availability(DEFAULT_LLM_MODEL)
        if has_default:
            print(f"   - Default model '{DEFAULT_LLM_MODEL}' is ready!")
        else:
            print(f"   - ⚠️ Default model '{DEFAULT_LLM_MODEL}' NOT found. Installed: {installed}")
    else:
        print(f"✗ Ollama is offline or unreachable at {OLLAMA_HOST}")
        print("   Please start Ollama and ensure the daemon is running.")
        sys.exit(1)

    # 4. Benchmarking LLM Inference Speed & Response Quality
    print(f"\n[STEP 4] Evaluating local LLM inference performance ({DEFAULT_LLM_MODEL})...")
    test_prompt = "You are a DBMS professor. Briefly define what 3NF (Third Normal Form) is in one short paragraph."
    print(f"   - Sending Prompt: '{test_prompt}'")
    
    t_start = time.time()
    response_stream = LLMService.generate_streaming_response(
        prompt=test_prompt,
        system_prompt="You are a helpful educational tutor. Keep responses concise.",
        model_name=DEFAULT_LLM_MODEL
    )
    
    tokens = []
    first_token_time = None
    
    for token in response_stream:
        if not first_token_time:
            first_token_time = time.time() - t_start
        tokens.append(token)
        
    t_end = time.time()
    total_time = t_end - t_start
    full_text = "".join(tokens)
    num_tokens = len(full_text.split())
    
    print("\n   - Inference Metrics:")
    print(f"     - Time-to-First-Token (TTFT): {first_token_time * 1000:.2f} ms" if first_token_time else "     - Time-to-First-Token (TTFT): N/A")
    print(f"     - Total Generation Time: {total_time:.2f} seconds")
    print(f"     - Estimated Words Generated: {num_tokens}")
    if total_time > 0:
        print(f"     - Generation Speed: {num_tokens / total_time:.2f} words/second")
    print(f"     - Response preview: {full_text[:150].strip()}...")
    
    # Simple semantic assertion
    if any(word in full_text.lower() for word in ["normal", "redundancy", "3nf", "database", "table", "dependency"]):
        print("✓ Response Content Check: PASSED (contains domain-relevant terminology)")
    else:
        print("⚠️ Response Content Check: WARNING (could not verify key domain terms in output)")

    # 5. Check Vector DB Collection and Chunks
    print("\n[STEP 5] Querying Chroma DB Collections metadata...")
    try:
        from app.services.rag_engine import chroma_client
        collections = chroma_client.list_collections()
        print(f"✓ ChromaDB connected successfully!")
        print(f"   - Total active vector collections: {len(collections)}")
        for col in collections:
            print(f"     * Collection: '{col.name}' (Chunks count: {col.count()})")
    except Exception as e:
        print(f"✗ ChromaDB check failed: {str(e)}")

    print("\n" + "=" * 60)
    print("EVALUATION COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_evaluation()
