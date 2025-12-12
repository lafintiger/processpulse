"""
Health check endpoints.
"""

from fastapi import APIRouter

from app.config import get_settings
from app.services.ollama import check_ollama_connection

router = APIRouter()
settings = get_settings()


@router.get("/")
async def root():
    """Root endpoint with application info."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
    }


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    # Check Ollama connection
    ollama_status = await check_ollama_connection()
    
    return {
        "status": "healthy",
        "ollama": ollama_status,
        "database": {"connected": True, "type": "sqlite" if "sqlite" in settings.database_url else "postgresql"},
    }


@router.get("/api/status")
async def api_status():
    """Detailed API status."""
    ollama_status = await check_ollama_connection()
    
    return {
        "api": {
            "name": settings.app_name,
            "version": settings.app_version,
            "debug": settings.debug,
        },
        "ollama": {
            "base_url": settings.ollama_base_url,
            "connected": ollama_status.get("connected", False),
            "model_count": ollama_status.get("model_count", 0),
            "default_analysis_model": settings.default_analysis_model,
            "default_embedding_model": settings.default_embedding_model,
        },
        "database": {
            "url_masked": settings.database_url.split("///")[0] + "///***",
            "type": "sqlite" if "sqlite" in settings.database_url else "postgresql",
        },
        "settings": {
            "max_upload_size_mb": settings.max_upload_size_mb,
            "assessment_passes": settings.assessment_passes,
            "multi_model_enabled": settings.multi_model_enabled,
            "authenticity_mode": settings.authenticity_mode,
        },
    }




