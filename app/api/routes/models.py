"""
Model management endpoints.
"""

from fastapi import APIRouter, HTTPException

from app.services.ollama import (
    check_ollama_connection,
    list_available_models,
    OllamaClient,
)
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/")
async def get_models():
    """
    List all available Ollama models.
    
    Returns:
        List of model information including name, size, and capabilities.
    """
    status = await check_ollama_connection()
    
    if not status.get("connected"):
        raise HTTPException(
            status_code=503,
            detail=f"Ollama not connected: {status.get('message')}"
        )
    
    models = await list_available_models()
    
    # Categorize models
    analysis_models = []
    embedding_models = []
    other_models = []
    
    for model in models:
        model_dict = model.to_dict()
        name_lower = model.name.lower()
        
        # Identify embedding models
        if any(x in name_lower for x in ["embed", "bge", "nomic", "e5"]):
            embedding_models.append(model_dict)
        # Identify analysis models (large language models)
        elif any(x in name_lower for x in ["qwen", "gemma", "llama", "mistral", "ministral", "phi", "deepseek"]):
            analysis_models.append(model_dict)
        else:
            other_models.append(model_dict)
    
    return {
        "total_count": len(models),
        "analysis_models": analysis_models,
        "embedding_models": embedding_models,
        "other_models": other_models,
        "defaults": {
            "analysis": settings.default_analysis_model,
            "embedding": settings.default_embedding_model,
        },
    }


@router.get("/{model_name:path}")
async def get_model_info(model_name: str):
    """
    Get detailed information about a specific model.
    
    Args:
        model_name: The model identifier (e.g., 'qwen3:32b')
    """
    status = await check_ollama_connection()
    
    if not status.get("connected"):
        raise HTTPException(
            status_code=503,
            detail=f"Ollama not connected: {status.get('message')}"
        )
    
    try:
        async with OllamaClient() as client:
            info = await client.get_model_info(model_name)
            return info
    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Model not found or error: {str(e)}"
        )


@router.post("/test/{model_name:path}")
async def test_model(model_name: str):
    """
    Test a model with a simple prompt.
    
    Args:
        model_name: The model to test
    """
    try:
        async with OllamaClient(timeout=60.0) as client:
            result = await client.generate(
                prompt="Say 'Hello, I am working!' in exactly those words.",
                model=model_name,
            )
            return {
                "model": model_name,
                "status": "success",
                "response": result.get("response", ""),
                "eval_count": result.get("eval_count"),
                "eval_duration": result.get("eval_duration"),
            }
    except TimeoutError:
        raise HTTPException(
            status_code=504,
            detail=f"Model {model_name} timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Model test failed: {str(e)}"
        )




