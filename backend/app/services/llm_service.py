import json
import requests
from typing import Generator, List, Dict, Any
from ..config import OLLAMA_HOST, DEFAULT_LLM_MODEL
from ..utils.logger import get_logger

logger = get_logger("LLMService")

class LLMService:
    @staticmethod
    def check_ollama_status() -> bool:
        """Verifies if the local Ollama daemon is reachable."""
        try:
            response = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=3)
            return response.status_code == 200
        except Exception:
            return False

    @staticmethod
    def get_installed_models() -> List[str]:
        """Lists all models downloaded to the local user's workstation."""
        try:
            response = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=3)
            if response.status_code == 200:
                data = response.json()
                return [m["name"] for m in data.get("models", [])]
        except Exception as e:
            logger.error(f"Failed listing Ollama models: {str(e)}")
        return []

    @classmethod
    def check_model_availability(cls, model_name: str = DEFAULT_LLM_MODEL) -> bool:
        """Checks if the required model is pulled locally."""
        installed = cls.get_installed_models()
        # Handle exact tag matches or prefix matches
        for m in installed:
            if m == model_name or m.startswith(f"{model_name}:"):
                return True
        return False

    @classmethod
    def generate_streaming_response(
        cls, 
        prompt: str, 
        system_prompt: str = "",
        model_name: str = DEFAULT_LLM_MODEL
    ) -> Generator[str, None, None]:
        """Streams response tokens from local Qwen2.5 model word-by-word."""
        url = f"{OLLAMA_HOST}/api/chat"
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": model_name,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": 0.4
            }
        }
        
        try:
            logger.info(f"Initiating Ollama generation stream with model: {model_name}")
            # Use extended timeout to give local Ollama model loading from disk to memory ample time
            response = requests.post(url, json=payload, stream=True, timeout=90)
            
            if response.status_code != 200:
                logger.error(f"Ollama returned HTTP error status: {response.status_code}")
                yield f"Error: Ollama server returned status {response.status_code}."
                return

            for line in response.iter_lines():
                if line:
                    decoded = line.decode('utf-8')
                    try:
                        data = json.loads(decoded)
                        # Extract chat delta chunk
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield content
                    except Exception as parse_err:
                        logger.error(f"Failed decoding stream payload line: {str(parse_err)}")
                        
        except requests.exceptions.ConnectionError:
            logger.error("ConnectionRefused: Local Ollama daemon is offline or running on different host port.")
            yield "Error: Could not connect to local Ollama runner. Please ensure Ollama is started."
        except Exception as e:
            logger.error(f"Unexpected error in LLM streaming generation: {str(e)}")
            yield f"Error: Streaming generation encountered an anomaly: {str(e)}."
