"""Ollama integration services."""

from app.services.ollama.client import (
    OllamaClient,
    OllamaModel,
    check_ollama_connection,
    list_available_models,
    generate_completion,
    generate_embeddings,
)

__all__ = [
    "OllamaClient",
    "OllamaModel",
    "check_ollama_connection",
    "list_available_models",
    "generate_completion",
    "generate_embeddings",
]




