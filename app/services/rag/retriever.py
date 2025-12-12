"""
Retriever Service

Retrieves relevant chat chunks based on semantic similarity.
Uses in-memory vector similarity for MVP (can upgrade to ChromaDB later).
"""

import math
from dataclasses import dataclass, field
from typing import Optional

from app.services.rag.chunker import ChatChunk
from app.services.rag.embeddings import embed_query


@dataclass
class RetrievalResult:
    """A retrieved chunk with similarity score."""
    chunk: ChatChunk
    score: float  # Cosine similarity score (0-1)
    rank: int
    
    def to_dict(self) -> dict:
        return {
            "chunk_id": self.chunk.chunk_id,
            "exchange_number": self.chunk.exchange_number,
            "score": round(self.score, 4),
            "rank": self.rank,
            "citation_ref": self.chunk.citation_ref,
            "student_prompt_preview": self.chunk.student_prompt[:200],
            "ai_response_preview": self.chunk.ai_response[:200],
        }


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """
    Calculate cosine similarity between two vectors.
    
    Args:
        vec1: First vector
        vec2: Second vector
        
    Returns:
        Cosine similarity (0 to 1)
    """
    if not vec1 or not vec2:
        return 0.0
    
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(b * b for b in vec2))
    
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    
    return dot_product / (magnitude1 * magnitude2)


class Retriever:
    """
    In-memory retriever for chat chunks.
    
    For MVP, stores chunks in memory with their embeddings.
    Can be upgraded to ChromaDB or FAISS for production.
    
    Usage:
        retriever = Retriever()
        retriever.add_chunks(chunks)
        results = await retriever.search("query about critical thinking", top_k=5)
    """
    
    def __init__(self, embedding_model: Optional[str] = None):
        self.chunks: list[ChatChunk] = []
        self.embedding_model = embedding_model
    
    def add_chunks(self, chunks: list[ChatChunk]) -> None:
        """
        Add chunks to the retriever index.
        
        Args:
            chunks: List of ChatChunk objects with embeddings
        """
        # Filter out chunks without embeddings
        valid_chunks = [c for c in chunks if c.embedding is not None]
        self.chunks.extend(valid_chunks)
    
    def clear(self) -> None:
        """Clear all indexed chunks."""
        self.chunks = []
    
    async def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.3,
    ) -> list[RetrievalResult]:
        """
        Search for relevant chunks using semantic similarity.
        
        Args:
            query: Search query
            top_k: Maximum number of results
            min_score: Minimum similarity score (0-1)
            
        Returns:
            List of RetrievalResult sorted by relevance
        """
        if not self.chunks:
            return []
        
        # Generate query embedding
        query_embedding = await embed_query(query, model=self.embedding_model)
        
        if not query_embedding:
            return []
        
        # Calculate similarity for all chunks
        scored_chunks = []
        for chunk in self.chunks:
            if chunk.embedding:
                score = cosine_similarity(query_embedding, chunk.embedding)
                if score >= min_score:
                    scored_chunks.append((chunk, score))
        
        # Sort by score descending
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        
        # Take top-k
        results = []
        for rank, (chunk, score) in enumerate(scored_chunks[:top_k], 1):
            results.append(RetrievalResult(
                chunk=chunk,
                score=score,
                rank=rank,
            ))
        
        return results
    
    def search_by_embedding(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        min_score: float = 0.3,
    ) -> list[RetrievalResult]:
        """
        Search using a pre-computed query embedding.
        
        Args:
            query_embedding: Pre-computed query embedding
            top_k: Maximum results
            min_score: Minimum similarity
            
        Returns:
            List of RetrievalResult
        """
        if not self.chunks or not query_embedding:
            return []
        
        scored_chunks = []
        for chunk in self.chunks:
            if chunk.embedding:
                score = cosine_similarity(query_embedding, chunk.embedding)
                if score >= min_score:
                    scored_chunks.append((chunk, score))
        
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        
        results = []
        for rank, (chunk, score) in enumerate(scored_chunks[:top_k], 1):
            results.append(RetrievalResult(
                chunk=chunk,
                score=score,
                rank=rank,
            ))
        
        return results
    
    def get_chunks_by_exchange(self, exchange_numbers: list[int]) -> list[ChatChunk]:
        """
        Get specific chunks by exchange number.
        
        Args:
            exchange_numbers: List of exchange numbers to retrieve
            
        Returns:
            Matching chunks
        """
        return [
            chunk for chunk in self.chunks
            if chunk.exchange_number in exchange_numbers
        ]
    
    def get_context_window(
        self,
        exchange_number: int,
        window_before: int = 1,
        window_after: int = 1,
    ) -> list[ChatChunk]:
        """
        Get a chunk and its surrounding context.
        
        Args:
            exchange_number: Center exchange number
            window_before: Exchanges before to include
            window_after: Exchanges after to include
            
        Returns:
            Chunks in the window, sorted by exchange number
        """
        target_range = range(
            exchange_number - window_before,
            exchange_number + window_after + 1
        )
        
        result = [
            chunk for chunk in self.chunks
            if chunk.exchange_number in target_range
        ]
        
        return sorted(result, key=lambda c: c.exchange_number)


async def retrieve_relevant_chunks(
    chunks: list[ChatChunk],
    query: str,
    top_k: int = 5,
    min_score: float = 0.3,
    embedding_model: Optional[str] = None,
) -> list[RetrievalResult]:
    """
    Convenience function to retrieve relevant chunks for a query.
    
    Args:
        chunks: List of chunks with embeddings
        query: Search query
        top_k: Maximum results
        min_score: Minimum similarity threshold
        embedding_model: Model for query embedding
        
    Returns:
        List of RetrievalResult
    """
    retriever = Retriever(embedding_model=embedding_model)
    retriever.add_chunks(chunks)
    return await retriever.search(query, top_k=top_k, min_score=min_score)


def format_retrieved_for_prompt(
    results: list[RetrievalResult],
    max_chars_per_chunk: int = 2000,
) -> str:
    """
    Format retrieved chunks for inclusion in an LLM prompt.
    
    Args:
        results: List of retrieval results
        max_chars_per_chunk: Maximum characters per chunk to include
        
    Returns:
        Formatted string for prompt inclusion
    """
    if not results:
        return "No relevant chat history found."
    
    parts = []
    for result in results:
        chunk = result.chunk
        
        # Truncate if needed
        prompt = chunk.student_prompt
        response = chunk.ai_response
        
        if len(prompt) + len(response) > max_chars_per_chunk:
            # Split budget between prompt and response
            budget = max_chars_per_chunk // 2
            if len(prompt) > budget:
                prompt = prompt[:budget] + "..."
            if len(response) > budget:
                response = response[:budget] + "..."
        
        parts.append(f"""
--- {chunk.citation_ref} (Relevance: {result.score:.2f}) ---
STUDENT PROMPT:
{prompt}

AI RESPONSE:
{response}
""")
    
    return "\n".join(parts)




