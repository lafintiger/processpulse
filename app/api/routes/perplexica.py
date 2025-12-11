"""
Perplexica Proxy Routes

Proxies requests to local Perplexica instance to avoid CORS issues.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any
import httpx

router = APIRouter(prefix="/api/perplexica", tags=["perplexica"])

PERPLEXICA_BASE_URL = "http://localhost:3000"


class SearchRequest(BaseModel):
    query: str
    focusMode: str = "webSearch"
    optimizationMode: str = "balanced"
    history: Optional[List[List[str]]] = None
    systemInstructions: Optional[str] = None


@router.get("/status")
async def check_perplexica_status():
    """Check if Perplexica is available."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{PERPLEXICA_BASE_URL}/api/providers")
            if response.status_code == 200:
                return {"available": True, "providers": response.json().get("providers", [])}
            return {"available": False, "error": "Perplexica returned non-200 status"}
    except httpx.ConnectError:
        return {"available": False, "error": "Cannot connect to Perplexica at localhost:3000"}
    except Exception as e:
        return {"available": False, "error": str(e)}


@router.get("/providers")
async def get_providers():
    """Get available Perplexica providers and models."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{PERPLEXICA_BASE_URL}/api/providers")
            response.raise_for_status()
            return response.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Perplexica not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search(request: SearchRequest):
    """Proxy search request to Perplexica."""
    try:
        # First get providers to get model info
        async with httpx.AsyncClient(timeout=10.0) as client:
            providers_response = await client.get(f"{PERPLEXICA_BASE_URL}/api/providers")
            providers_response.raise_for_status()
            providers_data = providers_response.json()
            
        providers = providers_data.get("providers", [])
        if not providers:
            raise HTTPException(status_code=503, detail="No Perplexica providers available")
        
        # Get first available chat and embedding models
        chat_model = None
        embedding_model = None
        
        for provider in providers:
            if not chat_model and provider.get("chatModels"):
                chat_model = {
                    "providerId": provider["id"],
                    "key": provider["chatModels"][0]["key"]
                }
            if not embedding_model and provider.get("embeddingModels"):
                embedding_model = {
                    "providerId": provider["id"],
                    "key": provider["embeddingModels"][0]["key"]
                }
        
        if not chat_model or not embedding_model:
            raise HTTPException(status_code=503, detail="No chat or embedding models available")
        
        # Make search request
        search_payload = {
            "chatModel": chat_model,
            "embeddingModel": embedding_model,
            "focusMode": request.focusMode,
            "optimizationMode": request.optimizationMode,
            "query": request.query,
            "history": request.history or [],
            "stream": False,
        }
        
        if request.systemInstructions:
            search_payload["systemInstructions"] = request.systemInstructions
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{PERPLEXICA_BASE_URL}/api/search",
                json=search_payload
            )
            response.raise_for_status()
            return response.json()
            
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Perplexica not available")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Search request timed out")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

