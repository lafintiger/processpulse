"""
Application configuration using Pydantic Settings.
Loads from environment variables and .env file.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Application
    app_name: str = "Process Analyzer"
    app_version: str = "0.1.0"
    debug: bool = True
    log_level: str = "INFO"
    
    # Server
    host: str = "127.0.0.1"
    port: int = 8000
    reload: bool = True
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./data/process_analyzer.db"
    
    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    default_analysis_model: str = "gpt-oss:latest"
    default_embedding_model: str = "bge-m3"
    fallback_analysis_model: str = "ministral:latest"
    fallback_embedding_model: str = "nomic-embed-text"
    
    # RAG
    chroma_persist_dir: str = "./data/chroma"
    chunk_overlap: int = 1
    max_retrieval_chunks: int = 5
    
    # Assessment
    assessment_passes: int = 1
    multi_model_enabled: bool = False
    authenticity_mode: Literal["conservative", "aggressive"] = "conservative"
    
    # File Upload
    max_upload_size_mb: int = 50
    allowed_essay_extensions: str = ".txt,.docx,.pdf,.md"
    allowed_chat_extensions: str = ".json,.txt,.md"
    
    # Export
    export_dir: str = "./exports"
    
    @property
    def allowed_essay_ext_list(self) -> list[str]:
        """Parse allowed essay extensions into a list."""
        return [ext.strip() for ext in self.allowed_essay_extensions.split(",")]
    
    @property
    def allowed_chat_ext_list(self) -> list[str]:
        """Parse allowed chat extensions into a list."""
        return [ext.strip() for ext in self.allowed_chat_extensions.split(",")]
    
    @property
    def max_upload_bytes(self) -> int:
        """Convert MB to bytes."""
        return self.max_upload_size_mb * 1024 * 1024
    
    def ensure_directories(self) -> None:
        """Create required directories if they don't exist."""
        dirs = [
            Path("./data"),
            Path(self.chroma_persist_dir),
            Path(self.export_dir),
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    settings = Settings()
    settings.ensure_directories()
    return settings

