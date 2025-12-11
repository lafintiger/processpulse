"""
Chat History Parser

Parses various chat history formats into a canonical format for analysis.
Supports:
- Plain text/Markdown (universal fallback)
- LM Studio JSON exports
- Generic structured JSON
- Future: Claude, ChatGPT, etc.
"""

import json
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import orjson


class ChatFormat(str, Enum):
    """Detected chat history format."""
    PLAIN_TEXT = "plain_text"
    LM_STUDIO = "lm_studio"
    GENERIC_JSON = "generic_json"
    UNKNOWN = "unknown"


@dataclass
class ChatExchange:
    """
    A single exchange in a conversation (student prompt + AI response).
    This is our canonical format for all chat histories.
    """
    number: int  # Exchange number (1-indexed)
    student_prompt: str
    ai_response: str
    timestamp: Optional[str] = None
    model_name: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "number": self.number,
            "student_prompt": self.student_prompt,
            "ai_response": self.ai_response,
            "timestamp": self.timestamp,
            "model_name": self.model_name,
            "metadata": self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "ChatExchange":
        """Create from dictionary."""
        return cls(
            number=data.get("number", 0),
            student_prompt=data.get("student_prompt", ""),
            ai_response=data.get("ai_response", ""),
            timestamp=data.get("timestamp"),
            model_name=data.get("model_name"),
            metadata=data.get("metadata", {}),
        )
    
    @property
    def full_text(self) -> str:
        """Get full text of the exchange for embedding."""
        return f"Student: {self.student_prompt}\n\nAI: {self.ai_response}"
    
    @property
    def char_count(self) -> int:
        """Total character count."""
        return len(self.student_prompt) + len(self.ai_response)


@dataclass
class ParsedChatHistory:
    """
    Canonical representation of a parsed chat history.
    """
    platform: str
    format_detected: ChatFormat
    exchanges: list[ChatExchange]
    total_exchanges: int
    conversation_name: Optional[str] = None
    raw_content: str = ""
    parsing_notes: list[str] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "platform": self.platform,
            "format_detected": self.format_detected.value,
            "conversation_name": self.conversation_name,
            "total_exchanges": self.total_exchanges,
            "exchanges": [ex.to_dict() for ex in self.exchanges],
            "parsing_notes": self.parsing_notes,
        }
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return orjson.dumps(self.to_dict()).decode("utf-8")
    
    @classmethod
    def from_json(cls, json_str: str) -> "ParsedChatHistory":
        """Create from JSON string."""
        data = orjson.loads(json_str)
        return cls(
            platform=data.get("platform", "unknown"),
            format_detected=ChatFormat(data.get("format_detected", "unknown")),
            conversation_name=data.get("conversation_name"),
            total_exchanges=data.get("total_exchanges", 0),
            exchanges=[ChatExchange.from_dict(ex) for ex in data.get("exchanges", [])],
            parsing_notes=data.get("parsing_notes", []),
        )


def detect_chat_format(content: str, filename: Optional[str] = None) -> ChatFormat:
    """
    Detect the format of a chat history file.
    
    Args:
        content: The raw file content
        filename: Optional filename for hints
        
    Returns:
        Detected ChatFormat
    """
    content_stripped = content.strip()
    
    # Check if it's JSON
    if content_stripped.startswith("{") or content_stripped.startswith("["):
        try:
            data = orjson.loads(content_stripped)
            
            # Check for LM Studio format
            if isinstance(data, dict):
                if "messages" in data and isinstance(data.get("messages"), list):
                    # Check for LM Studio specific structure
                    messages = data["messages"]
                    if messages and "versions" in messages[0]:
                        return ChatFormat.LM_STUDIO
                
                # Generic JSON with exchanges
                if "exchanges" in data:
                    return ChatFormat.GENERIC_JSON
            
            return ChatFormat.GENERIC_JSON
        except (orjson.JSONDecodeError, json.JSONDecodeError):
            pass
    
    # Default to plain text
    return ChatFormat.PLAIN_TEXT


def parse_chat_history(
    content: str,
    filename: Optional[str] = None,
    format_hint: Optional[ChatFormat] = None,
) -> ParsedChatHistory:
    """
    Parse a chat history into canonical format.
    
    Args:
        content: Raw chat history content
        filename: Optional filename for format hints
        format_hint: Optional explicit format specification
        
    Returns:
        ParsedChatHistory in canonical format
    """
    # Detect format if not specified
    detected_format = format_hint or detect_chat_format(content, filename)
    
    # Route to appropriate parser
    if detected_format == ChatFormat.LM_STUDIO:
        return _parse_lm_studio(content)
    elif detected_format == ChatFormat.GENERIC_JSON:
        return _parse_generic_json(content)
    else:
        return _parse_plain_text(content)


def _parse_lm_studio(content: str) -> ParsedChatHistory:
    """
    Parse LM Studio JSON export format.
    
    LM Studio structure:
    {
        "name": "conversation name",
        "messages": [
            {
                "versions": [{
                    "role": "user",
                    "content": [{"type": "text", "text": "..."}]
                }]
            },
            {
                "versions": [{
                    "role": "assistant",
                    "steps": [{
                        "content": [{"type": "text", "text": "..."}]
                    }],
                    "senderInfo": {"senderName": "model-name"}
                }]
            }
        ]
    }
    """
    data = orjson.loads(content)
    exchanges: list[ChatExchange] = []
    notes: list[str] = []
    
    conversation_name = data.get("name", "Untitled")
    messages = data.get("messages", [])
    
    # Process messages in pairs (user + assistant)
    exchange_num = 1
    i = 0
    
    while i < len(messages):
        msg = messages[i]
        version = msg.get("versions", [{}])[0]
        role = version.get("role", "")
        
        if role == "user":
            # Extract user content
            user_content = _extract_lm_studio_content(version)
            
            # Look for assistant response
            ai_content = ""
            model_name = None
            
            if i + 1 < len(messages):
                next_msg = messages[i + 1]
                next_version = next_msg.get("versions", [{}])[0]
                if next_version.get("role") == "assistant":
                    ai_content = _extract_lm_studio_assistant_content(next_version)
                    sender_info = next_version.get("senderInfo", {})
                    model_name = sender_info.get("senderName")
                    i += 1  # Skip the assistant message
            
            if user_content or ai_content:
                exchanges.append(ChatExchange(
                    number=exchange_num,
                    student_prompt=user_content,
                    ai_response=ai_content,
                    model_name=model_name,
                    metadata={"source": "lm_studio"}
                ))
                exchange_num += 1
        
        i += 1
    
    if not exchanges:
        notes.append("Warning: No exchanges found in LM Studio export")
    
    return ParsedChatHistory(
        platform="lm_studio",
        format_detected=ChatFormat.LM_STUDIO,
        conversation_name=conversation_name,
        exchanges=exchanges,
        total_exchanges=len(exchanges),
        raw_content=content,
        parsing_notes=notes,
    )


def _extract_lm_studio_content(version: dict) -> str:
    """Extract text content from LM Studio user message."""
    content = version.get("content", [])
    if isinstance(content, list):
        texts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                texts.append(item.get("text", ""))
        return "\n".join(texts)
    return str(content)


def _extract_lm_studio_assistant_content(version: dict) -> str:
    """Extract text content from LM Studio assistant message."""
    steps = version.get("steps", [])
    texts = []
    
    for step in steps:
        if step.get("type") == "contentBlock":
            content = step.get("content", [])
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    texts.append(item.get("text", ""))
    
    return "\n".join(texts)


def _parse_generic_json(content: str) -> ParsedChatHistory:
    """
    Parse a generic JSON format.
    Tries to handle various structures intelligently.
    """
    data = orjson.loads(content)
    exchanges: list[ChatExchange] = []
    notes: list[str] = []
    platform = "unknown"
    
    # Handle different JSON structures
    if isinstance(data, dict):
        # Check for our canonical format
        if "exchanges" in data:
            platform = data.get("platform", "generic")
            for i, ex in enumerate(data["exchanges"], 1):
                exchanges.append(ChatExchange(
                    number=ex.get("number", i),
                    student_prompt=ex.get("student_prompt", ex.get("user", "")),
                    ai_response=ex.get("ai_response", ex.get("assistant", "")),
                    timestamp=ex.get("timestamp"),
                    model_name=ex.get("model_name"),
                    metadata=ex.get("metadata", {}),
                ))
        
        # Check for messages array format (common in many exports)
        elif "messages" in data:
            messages = data["messages"]
            exchange_num = 1
            current_user = None
            
            for msg in messages:
                role = msg.get("role", msg.get("type", ""))
                content = msg.get("content", msg.get("text", ""))
                
                if isinstance(content, list):
                    content = " ".join(
                        c.get("text", str(c)) for c in content if isinstance(c, dict)
                    )
                
                if role in ("user", "human"):
                    current_user = str(content)
                elif role in ("assistant", "ai", "bot") and current_user:
                    exchanges.append(ChatExchange(
                        number=exchange_num,
                        student_prompt=current_user,
                        ai_response=str(content),
                        metadata={"source": "generic_json"}
                    ))
                    exchange_num += 1
                    current_user = None
    
    elif isinstance(data, list):
        # Array of messages
        notes.append("Parsed as array of messages")
        exchange_num = 1
        current_user = None
        
        for msg in data:
            if isinstance(msg, dict):
                role = msg.get("role", msg.get("type", ""))
                content = msg.get("content", msg.get("text", ""))
                
                if role in ("user", "human"):
                    current_user = str(content)
                elif role in ("assistant", "ai", "bot") and current_user:
                    exchanges.append(ChatExchange(
                        number=exchange_num,
                        student_prompt=current_user,
                        ai_response=str(content),
                    ))
                    exchange_num += 1
                    current_user = None
    
    return ParsedChatHistory(
        platform=platform,
        format_detected=ChatFormat.GENERIC_JSON,
        exchanges=exchanges,
        total_exchanges=len(exchanges),
        raw_content=content,
        parsing_notes=notes,
    )


def _parse_plain_text(content: str) -> ParsedChatHistory:
    """
    Parse plain text/markdown chat history.
    
    Attempts to detect common patterns:
    - "User:" / "AI:" or "Assistant:" labels
    - "Q:" / "A:" format
    - "Human:" / "Claude:" format
    - Alternating paragraphs separated by blank lines
    """
    exchanges: list[ChatExchange] = []
    notes: list[str] = []
    
    # Try labeled format first
    labeled_exchanges = _try_parse_labeled_format(content)
    if labeled_exchanges:
        exchanges = labeled_exchanges
        notes.append("Detected labeled format (User/AI pattern)")
    else:
        # Fall back to paragraph-based parsing
        paragraph_exchanges = _try_parse_paragraph_format(content)
        if paragraph_exchanges:
            exchanges = paragraph_exchanges
            notes.append("Parsed as alternating paragraphs")
        else:
            # Last resort: treat entire content as single exchange
            notes.append("Warning: Could not detect conversation structure, treating as single exchange")
            exchanges = [ChatExchange(
                number=1,
                student_prompt="[Unable to parse - entire content below]",
                ai_response=content,
            )]
    
    return ParsedChatHistory(
        platform="plain_text",
        format_detected=ChatFormat.PLAIN_TEXT,
        exchanges=exchanges,
        total_exchanges=len(exchanges),
        raw_content=content,
        parsing_notes=notes,
    )


def _try_parse_labeled_format(content: str) -> list[ChatExchange]:
    """
    Try to parse content with explicit role labels.
    Handles various labeling conventions.
    """
    # Common user patterns
    user_patterns = [
        r"^(?:User|Human|Student|Me|Q)[\s]*[:\-]",
        r"^\*\*(?:User|Human|Student|Me|Q)\*\*[\s]*[:\-]?",
    ]
    
    # Common AI patterns
    ai_patterns = [
        r"^(?:AI|Assistant|Claude|ChatGPT|GPT|Bot|A|Response)[\s]*[:\-]",
        r"^\*\*(?:AI|Assistant|Claude|ChatGPT|GPT|Bot|A|Response)\*\*[\s]*[:\-]?",
    ]
    
    # Combined pattern to split on
    all_patterns = user_patterns + ai_patterns
    split_pattern = "|".join(f"({p})" for p in all_patterns)
    
    # Split content
    parts = re.split(split_pattern, content, flags=re.MULTILINE | re.IGNORECASE)
    parts = [p for p in parts if p and p.strip()]
    
    if len(parts) < 2:
        return []
    
    exchanges = []
    exchange_num = 1
    current_user = None
    
    i = 0
    while i < len(parts):
        part = parts[i].strip()
        
        # Check if this is a label
        is_user_label = any(re.match(p, part, re.IGNORECASE) for p in user_patterns)
        is_ai_label = any(re.match(p, part, re.IGNORECASE) for p in ai_patterns)
        
        if is_user_label and i + 1 < len(parts):
            current_user = parts[i + 1].strip()
            i += 2
        elif is_ai_label and i + 1 < len(parts) and current_user:
            ai_content = parts[i + 1].strip()
            exchanges.append(ChatExchange(
                number=exchange_num,
                student_prompt=current_user,
                ai_response=ai_content,
            ))
            exchange_num += 1
            current_user = None
            i += 2
        else:
            i += 1
    
    return exchanges


def _try_parse_paragraph_format(content: str) -> list[ChatExchange]:
    """
    Try to parse as alternating paragraphs.
    Assumes: User paragraph, blank line(s), AI paragraph, blank line(s), repeat.
    """
    # Split on double newlines
    paragraphs = re.split(r"\n\s*\n", content.strip())
    paragraphs = [p.strip() for p in paragraphs if p.strip()]
    
    if len(paragraphs) < 2:
        return []
    
    exchanges = []
    exchange_num = 1
    
    for i in range(0, len(paragraphs) - 1, 2):
        user_para = paragraphs[i]
        ai_para = paragraphs[i + 1] if i + 1 < len(paragraphs) else ""
        
        if user_para and ai_para:
            exchanges.append(ChatExchange(
                number=exchange_num,
                student_prompt=user_para,
                ai_response=ai_para,
            ))
            exchange_num += 1
    
    return exchanges


