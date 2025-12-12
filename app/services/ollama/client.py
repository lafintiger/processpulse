"""
Ollama Client

Handles all communication with the local Ollama server.
Supports:
- Connection testing
- Model listing
- Text generation (with JSON mode)
- Embedding generation
"""

import asyncio
from dataclasses import dataclass
from typing import Optional, Any

import httpx
import orjson
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings

settings = get_settings()


@dataclass
class OllamaModel:
    """Information about an available Ollama model."""
    name: str
    size: int  # Size in bytes
    size_human: str  # Human-readable size
    modified_at: str
    family: Optional[str] = None
    parameter_size: Optional[str] = None
    quantization: Optional[str] = None
    
    @classmethod
    def from_api_response(cls, data: dict) -> "OllamaModel":
        """Create from Ollama API response."""
        size = data.get("size", 0)
        details = data.get("details", {})
        
        return cls(
            name=data.get("name", ""),
            size=size,
            size_human=_format_size(size),
            modified_at=data.get("modified_at", ""),
            family=details.get("family"),
            parameter_size=details.get("parameter_size"),
            quantization=details.get("quantization_level"),
        )
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "size": self.size,
            "size_human": self.size_human,
            "modified_at": self.modified_at,
            "family": self.family,
            "parameter_size": self.parameter_size,
            "quantization": self.quantization,
        }


def _format_size(size_bytes: int) -> str:
    """Format bytes to human-readable string."""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"


class OllamaClient:
    """
    Async client for Ollama API.
    
    Usage:
        async with OllamaClient() as client:
            models = await client.list_models()
            response = await client.generate("prompt", model="qwen3:32b")
    """
    
    def __init__(self, base_url: Optional[str] = None, timeout: float = 300.0):
        self.base_url = base_url or settings.ollama_base_url
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
    
    async def __aenter__(self) -> "OllamaClient":
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(self.timeout, connect=10.0),
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.aclose()
    
    @property
    def client(self) -> httpx.AsyncClient:
        if not self._client:
            raise RuntimeError("Client not initialized. Use 'async with OllamaClient() as client:'")
        return self._client
    
    async def is_connected(self) -> bool:
        """Check if Ollama server is reachable."""
        try:
            response = await self.client.get("/api/tags")
            return response.status_code == 200
        except Exception:
            return False
    
    async def list_models(self) -> list[OllamaModel]:
        """List all available models."""
        try:
            response = await self.client.get("/api/tags")
            response.raise_for_status()
            data = response.json()
            
            models = []
            for model_data in data.get("models", []):
                models.append(OllamaModel.from_api_response(model_data))
            
            return sorted(models, key=lambda m: m.name)
        except Exception as e:
            raise ConnectionError(f"Failed to list models: {e}")
    
    async def get_model_info(self, model_name: str) -> dict:
        """Get detailed information about a specific model."""
        try:
            response = await self.client.post(
                "/api/show",
                json={"name": model_name}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            raise ConnectionError(f"Failed to get model info for {model_name}: {e}")
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        system: Optional[str] = None,
        format: Optional[str] = None,  # "json" for JSON mode
        options: Optional[dict] = None,
        stream: bool = False,
    ) -> dict:
        """
        Generate a completion from Ollama.
        
        Args:
            prompt: The prompt to send
            model: Model name (defaults to settings.default_analysis_model)
            system: System prompt
            format: Response format ("json" for structured output)
            options: Model options (temperature, top_p, etc.)
            stream: Whether to stream the response
            
        Returns:
            dict with 'response' key containing generated text
        """
        model = model or settings.default_analysis_model
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": stream,
        }
        
        if system:
            payload["system"] = system
        if format:
            payload["format"] = format
        if options:
            payload["options"] = options
        
        try:
            response = await self.client.post(
                "/api/generate",
                json=payload,
            )
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException:
            raise TimeoutError(f"Request to {model} timed out after {self.timeout}s")
        except Exception as e:
            raise RuntimeError(f"Generation failed: {e}")
    
    async def chat(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        format: Optional[str] = None,
        options: Optional[dict] = None,
        stream: bool = False,
    ) -> dict:
        """
        Chat completion with message history.
        
        Args:
            messages: List of message dicts with 'role' and 'content' keys
            model: Model name
            format: Response format
            options: Model options
            stream: Whether to stream
            
        Returns:
            dict with 'message' key containing response
        """
        model = model or settings.default_analysis_model
        
        payload = {
            "model": model,
            "messages": messages,
            "stream": stream,
        }
        
        if format:
            payload["format"] = format
        if options:
            payload["options"] = options
        
        try:
            response = await self.client.post(
                "/api/chat",
                json=payload,
            )
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException:
            raise TimeoutError(f"Chat request to {model} timed out")
        except Exception as e:
            raise RuntimeError(f"Chat failed: {e}")
    
    async def embed(
        self,
        text: str | list[str],
        model: Optional[str] = None,
    ) -> list[list[float]]:
        """
        Generate embeddings for text.
        
        Args:
            text: Single string or list of strings to embed
            model: Embedding model name
            
        Returns:
            List of embedding vectors
        """
        model = model or settings.default_embedding_model
        
        # Handle single string or list
        if isinstance(text, str):
            texts = [text]
        else:
            texts = text
        
        payload = {
            "model": model,
            "input": texts,
        }
        
        try:
            response = await self.client.post(
                "/api/embed",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("embeddings", [])
        except Exception as e:
            raise RuntimeError(f"Embedding generation failed: {e}")


# Convenience functions for module-level use

async def check_ollama_connection(base_url: Optional[str] = None) -> dict:
    """
    Check Ollama connection status.
    
    Returns:
        dict with 'connected' bool and 'message' str
    """
    try:
        async with OllamaClient(base_url=base_url) as client:
            connected = await client.is_connected()
            if connected:
                models = await client.list_models()
                return {
                    "connected": True,
                    "message": f"Connected to Ollama. {len(models)} models available.",
                    "model_count": len(models),
                }
            else:
                return {
                    "connected": False,
                    "message": "Ollama server not responding",
                }
    except Exception as e:
        return {
            "connected": False,
            "message": f"Connection failed: {str(e)}",
        }


async def list_available_models(base_url: Optional[str] = None) -> list[OllamaModel]:
    """List all available Ollama models."""
    async with OllamaClient(base_url=base_url) as client:
        return await client.list_models()


async def generate_completion(
    prompt: str,
    model: Optional[str] = None,
    system: Optional[str] = None,
    format: Optional[str] = None,
    base_url: Optional[str] = None,
) -> str:
    """Generate a completion and return just the text."""
    async with OllamaClient(base_url=base_url) as client:
        result = await client.generate(
            prompt=prompt,
            model=model,
            system=system,
            format=format,
        )
        return result.get("response", "")


async def generate_embeddings(
    texts: str | list[str],
    model: Optional[str] = None,
    base_url: Optional[str] = None,
) -> list[list[float]]:
    """Generate embeddings for text(s)."""
    async with OllamaClient(base_url=base_url) as client:
        return await client.embed(texts, model=model)




