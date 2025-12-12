"""
Chat History Chunker

Chunks chat history for RAG processing.
Strategy: Each exchange (student prompt + AI response) = 1 chunk
With optional context overlap from surrounding exchanges.
"""

from dataclasses import dataclass, field
from typing import Optional

from app.services.parsing import ParsedChatHistory, ChatExchange


@dataclass
class ChatChunk:
    """
    A chunk of chat history for embedding and retrieval.
    
    Each chunk contains:
    - The primary exchange (student prompt + AI response)
    - Optional context from previous/next exchanges
    - Metadata for citation and filtering
    """
    chunk_id: str
    exchange_number: int  # 1-indexed exchange number
    
    # Primary content
    student_prompt: str
    ai_response: str
    
    # Context (surrounding exchanges for better understanding)
    context_before: list[ChatExchange] = field(default_factory=list)
    context_after: list[ChatExchange] = field(default_factory=list)
    
    # Metadata
    model_name: Optional[str] = None
    timestamp: Optional[str] = None
    char_count: int = 0
    
    # Embedding (populated later)
    embedding: Optional[list[float]] = None
    
    def __post_init__(self):
        if self.char_count == 0:
            self.char_count = len(self.student_prompt) + len(self.ai_response)
    
    @property
    def primary_text(self) -> str:
        """Get the primary exchange text for embedding."""
        return f"Student: {self.student_prompt}\n\nAI Response: {self.ai_response}"
    
    @property
    def full_text_with_context(self) -> str:
        """Get full text including context for comprehensive embedding."""
        parts = []
        
        # Add context before
        if self.context_before:
            parts.append("=== Previous Context ===")
            for ex in self.context_before:
                parts.append(f"[Exchange {ex.number}]")
                parts.append(f"Student: {ex.student_prompt[:500]}...")
                parts.append(f"AI: {ex.ai_response[:500]}...")
            parts.append("")
        
        # Add primary exchange
        parts.append(f"=== Exchange {self.exchange_number} (Primary) ===")
        parts.append(f"Student: {self.student_prompt}")
        parts.append(f"AI Response: {self.ai_response}")
        
        # Add context after
        if self.context_after:
            parts.append("")
            parts.append("=== Following Context ===")
            for ex in self.context_after:
                parts.append(f"[Exchange {ex.number}]")
                parts.append(f"Student: {ex.student_prompt[:500]}...")
                parts.append(f"AI: {ex.ai_response[:500]}...")
        
        return "\n".join(parts)
    
    @property
    def citation_ref(self) -> str:
        """Get citation reference string."""
        return f"[CHAT:{self.exchange_number}]"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for storage/serialization."""
        return {
            "chunk_id": self.chunk_id,
            "exchange_number": self.exchange_number,
            "student_prompt": self.student_prompt,
            "ai_response": self.ai_response,
            "model_name": self.model_name,
            "timestamp": self.timestamp,
            "char_count": self.char_count,
            "citation_ref": self.citation_ref,
            "context_before_count": len(self.context_before),
            "context_after_count": len(self.context_after),
        }


def chunk_chat_history(
    chat_history: ParsedChatHistory,
    context_window: int = 1,
    include_context_in_embedding: bool = False,
) -> list[ChatChunk]:
    """
    Chunk a parsed chat history into retrievable units.
    
    Strategy: One chunk per exchange with optional surrounding context.
    
    Args:
        chat_history: Parsed chat history with exchanges
        context_window: Number of exchanges before/after to include as context
        include_context_in_embedding: Whether to embed the full context or just primary
        
    Returns:
        List of ChatChunk objects ready for embedding
    """
    chunks = []
    exchanges = chat_history.exchanges
    
    for i, exchange in enumerate(exchanges):
        # Get context before
        context_before = []
        if context_window > 0:
            start_idx = max(0, i - context_window)
            context_before = exchanges[start_idx:i]
        
        # Get context after
        context_after = []
        if context_window > 0:
            end_idx = min(len(exchanges), i + context_window + 1)
            context_after = exchanges[i + 1:end_idx]
        
        chunk = ChatChunk(
            chunk_id=f"chat_{chat_history.platform}_{exchange.number}",
            exchange_number=exchange.number,
            student_prompt=exchange.student_prompt,
            ai_response=exchange.ai_response,
            context_before=context_before,
            context_after=context_after,
            model_name=exchange.model_name,
            timestamp=exchange.timestamp,
        )
        
        chunks.append(chunk)
    
    return chunks


def get_chunk_text_for_embedding(
    chunk: ChatChunk,
    include_context: bool = False,
) -> str:
    """
    Get the text to use for embedding a chunk.
    
    Args:
        chunk: The chat chunk
        include_context: Whether to include surrounding context
        
    Returns:
        Text string for embedding
    """
    if include_context:
        return chunk.full_text_with_context
    return chunk.primary_text


def create_topic_summary_chunks(
    chat_history: ParsedChatHistory,
    exchanges_per_chunk: int = 3,
) -> list[ChatChunk]:
    """
    Alternative chunking: Group exchanges by topic/theme.
    
    This groups multiple exchanges together for broader context.
    Useful for understanding conversation flow and topic progression.
    
    Args:
        chat_history: Parsed chat history
        exchanges_per_chunk: Number of exchanges per chunk
        
    Returns:
        List of chunks with grouped exchanges
    """
    chunks = []
    exchanges = chat_history.exchanges
    
    for i in range(0, len(exchanges), exchanges_per_chunk):
        group = exchanges[i:i + exchanges_per_chunk]
        
        # Combine all prompts and responses in the group
        combined_prompts = []
        combined_responses = []
        
        for ex in group:
            combined_prompts.append(f"[{ex.number}] {ex.student_prompt}")
            combined_responses.append(f"[{ex.number}] {ex.ai_response}")
        
        chunk = ChatChunk(
            chunk_id=f"topic_{chat_history.platform}_{i // exchanges_per_chunk + 1}",
            exchange_number=group[0].number,  # First exchange in group
            student_prompt="\n\n".join(combined_prompts),
            ai_response="\n\n".join(combined_responses),
            model_name=group[0].model_name,
        )
        
        chunks.append(chunk)
    
    return chunks




