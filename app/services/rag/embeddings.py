"""
Embedding Service

Generates embeddings for chat chunks using Ollama embedding models.
"""

import asyncio
from dataclasses import dataclass
from typing import Optional

from app.config import get_settings
from app.services.ollama import OllamaClient
from app.services.rag.chunker import ChatChunk, get_chunk_text_for_embedding

settings = get_settings()


@dataclass
class EmbeddingResult:
    """Result of embedding generation."""
    chunk_id: str
    embedding: list[float]
    model_used: str
    text_length: int
    
    def to_dict(self) -> dict:
        return {
            "chunk_id": self.chunk_id,
            "model_used": self.model_used,
            "text_length": self.text_length,
            "embedding_dim": len(self.embedding),
        }


class EmbeddingService:
    """
    Service for generating embeddings using Ollama.
    
    Usage:
        service = EmbeddingService()
        embeddings = await service.embed_texts(["text1", "text2"])
        
    Or with context manager:
        async with EmbeddingService() as service:
            embeddings = await service.embed_texts(texts)
    """
    
    def __init__(
        self,
        model: Optional[str] = None,
        batch_size: int = 10,
    ):
        self.model = model or settings.default_embedding_model
        self.batch_size = batch_size
        self._client: Optional[OllamaClient] = None
    
    async def __aenter__(self) -> "EmbeddingService":
        self._client = OllamaClient()
        await self._client.__aenter__()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.__aexit__(exc_type, exc_val, exc_tb)
    
    async def embed_text(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector as list of floats
        """
        if not self._client:
            async with OllamaClient() as client:
                embeddings = await client.embed(text, model=self.model)
                return embeddings[0] if embeddings else []
        
        embeddings = await self._client.embed(text, model=self.model)
        return embeddings[0] if embeddings else []
    
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors
        """
        if not texts:
            return []
        
        if not self._client:
            async with OllamaClient() as client:
                return await client.embed(texts, model=self.model)
        
        return await self._client.embed(texts, model=self.model)
    
    async def embed_texts_batched(
        self,
        texts: list[str],
        show_progress: bool = False,
    ) -> list[list[float]]:
        """
        Generate embeddings in batches to manage memory and rate limits.
        
        Args:
            texts: List of texts to embed
            show_progress: Whether to print progress
            
        Returns:
            List of embedding vectors
        """
        all_embeddings = []
        total_batches = (len(texts) + self.batch_size - 1) // self.batch_size
        
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            batch_num = i // self.batch_size + 1
            
            if show_progress:
                print(f"  Embedding batch {batch_num}/{total_batches}...")
            
            batch_embeddings = await self.embed_texts(batch)
            all_embeddings.extend(batch_embeddings)
            
            # Small delay between batches to avoid overwhelming Ollama
            if i + self.batch_size < len(texts):
                await asyncio.sleep(0.1)
        
        return all_embeddings


async def embed_chunks(
    chunks: list[ChatChunk],
    model: Optional[str] = None,
    include_context: bool = False,
    show_progress: bool = False,
) -> list[ChatChunk]:
    """
    Generate embeddings for a list of chat chunks.
    
    Args:
        chunks: List of ChatChunk objects
        model: Embedding model to use (default from settings)
        include_context: Whether to embed with surrounding context
        show_progress: Whether to print progress
        
    Returns:
        Same chunks with embeddings populated
    """
    if not chunks:
        return chunks
    
    # Extract texts to embed
    texts = [
        get_chunk_text_for_embedding(chunk, include_context=include_context)
        for chunk in chunks
    ]
    
    if show_progress:
        print(f"Generating embeddings for {len(chunks)} chunks...")
    
    async with EmbeddingService(model=model) as service:
        embeddings = await service.embed_texts_batched(texts, show_progress=show_progress)
    
    # Attach embeddings to chunks
    for chunk, embedding in zip(chunks, embeddings):
        chunk.embedding = embedding
    
    if show_progress:
        print(f"  Done! Generated {len(embeddings)} embeddings.")
    
    return chunks


async def embed_query(
    query: str,
    model: Optional[str] = None,
) -> list[float]:
    """
    Generate embedding for a search query.
    
    Args:
        query: Query text
        model: Embedding model to use
        
    Returns:
        Query embedding vector
    """
    async with EmbeddingService(model=model) as service:
        return await service.embed_text(query)




