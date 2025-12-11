"""
Main FastAPI Application

The API backend for Process Analyzer.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import get_settings
from app.db.database import init_db


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan events."""
    # Startup
    print(f"Starting {settings.app_name} v{settings.app_version}")
    
    # Ensure directories exist
    settings.ensure_directories()
    
    # Initialize database
    await init_db()
    print("[OK] Database initialized")
    
    yield
    
    # Shutdown
    print("Shutting down...")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="AI-Assisted Writing Process Analyzer - Assess student thinking through AI chat history analysis",
        lifespan=lifespan,
    )
    
    # CORS middleware for React frontend
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Register routers
    from app.api.routes import health, models, upload, rubric, assessment, sessions
    
    application.include_router(health.router, tags=["Health"])
    application.include_router(models.router, prefix="/api/models", tags=["Models"])
    application.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
    application.include_router(rubric.router, prefix="/api/rubric", tags=["Rubric"])
    application.include_router(assessment.router, prefix="/api/assessment", tags=["Assessment"])
    application.include_router(sessions.router, tags=["Sessions"])
    
    return application


# Create the app instance
app = create_app()

