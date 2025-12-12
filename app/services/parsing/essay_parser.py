"""
Essay Parser

Extracts text from various document formats.
Supports: TXT, DOCX, PDF, Markdown
"""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import chardet


@dataclass
class ParsedEssay:
    """Parsed essay with metadata."""
    text: str
    word_count: int
    paragraph_count: int
    filename: Optional[str] = None
    file_format: str = "txt"
    parsing_notes: list[str] = None
    
    def __post_init__(self):
        if self.parsing_notes is None:
            self.parsing_notes = []
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "text": self.text,
            "word_count": self.word_count,
            "paragraph_count": self.paragraph_count,
            "filename": self.filename,
            "file_format": self.file_format,
            "parsing_notes": self.parsing_notes,
        }


def parse_essay(
    content: bytes | str,
    filename: Optional[str] = None,
) -> ParsedEssay:
    """
    Parse essay content into structured format.
    
    Args:
        content: File content (bytes for binary files, str for text)
        filename: Original filename for format detection
        
    Returns:
        ParsedEssay with extracted text and metadata
    """
    file_format = _detect_format(filename, content)
    notes = []
    
    # Route to appropriate parser
    if file_format == "docx":
        text = _parse_docx(content)
        notes.append("Extracted from DOCX format")
    elif file_format == "pdf":
        text = _parse_pdf(content)
        notes.append("Extracted from PDF format")
    elif file_format in ("md", "markdown"):
        text = _parse_markdown(content)
        notes.append("Parsed as Markdown")
    else:
        text = _parse_text(content)
        file_format = "txt"
    
    # Clean up text
    text = _clean_text(text)
    
    # Calculate stats
    word_count = len(text.split())
    paragraph_count = len([p for p in text.split("\n\n") if p.strip()])
    
    return ParsedEssay(
        text=text,
        word_count=word_count,
        paragraph_count=paragraph_count,
        filename=filename,
        file_format=file_format,
        parsing_notes=notes,
    )


def _detect_format(filename: Optional[str], content: bytes | str) -> str:
    """Detect file format from filename or content."""
    if filename:
        ext = Path(filename).suffix.lower()
        format_map = {
            ".docx": "docx",
            ".doc": "docx",  # Will try docx parser
            ".pdf": "pdf",
            ".md": "md",
            ".markdown": "md",
            ".txt": "txt",
        }
        if ext in format_map:
            return format_map[ext]
    
    # Try to detect from content
    if isinstance(content, bytes):
        # Check magic bytes
        if content[:4] == b"PK\x03\x04":
            return "docx"  # DOCX is a ZIP file
        elif content[:5] == b"%PDF-":
            return "pdf"
    
    return "txt"


def _parse_text(content: bytes | str) -> str:
    """Parse plain text, handling encoding."""
    if isinstance(content, str):
        return content
    
    # Detect encoding
    detected = chardet.detect(content)
    encoding = detected.get("encoding", "utf-8") or "utf-8"
    
    try:
        return content.decode(encoding)
    except UnicodeDecodeError:
        # Fallback encodings
        for enc in ["utf-8", "latin-1", "cp1252"]:
            try:
                return content.decode(enc)
            except UnicodeDecodeError:
                continue
        
        # Last resort: ignore errors
        return content.decode("utf-8", errors="ignore")


def _parse_docx(content: bytes) -> str:
    """Extract text from DOCX file."""
    try:
        from docx import Document
        from io import BytesIO
        
        if isinstance(content, str):
            content = content.encode("utf-8")
        
        doc = Document(BytesIO(content))
        
        paragraphs = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                paragraphs.append(text)
        
        return "\n\n".join(paragraphs)
    
    except ImportError:
        raise ImportError("python-docx is required for DOCX parsing. Install with: pip install python-docx")
    except Exception as e:
        raise ValueError(f"Failed to parse DOCX: {e}")


def _parse_pdf(content: bytes) -> str:
    """Extract text from PDF file."""
    try:
        from pypdf import PdfReader
        from io import BytesIO
        
        if isinstance(content, str):
            content = content.encode("utf-8")
        
        reader = PdfReader(BytesIO(content))
        
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        
        return "\n\n".join(text_parts)
    
    except ImportError:
        raise ImportError("pypdf is required for PDF parsing. Install with: pip install pypdf")
    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {e}")


def _parse_markdown(content: bytes | str) -> str:
    """
    Parse Markdown, preserving text but removing formatting.
    For essays, we want the content, not the markup.
    """
    text = _parse_text(content) if isinstance(content, bytes) else content
    
    # Remove common markdown elements while preserving text
    
    # Remove headers (keep the text)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    
    # Remove bold/italic markers
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)
    
    # Remove inline code
    text = re.sub(r"`(.+?)`", r"\1", text)
    
    # Remove links but keep text
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
    
    # Remove images
    text = re.sub(r"!\[([^\]]*)\]\([^\)]+\)", r"\1", text)
    
    # Remove horizontal rules
    text = re.sub(r"^[\-\*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    
    # Remove blockquote markers
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)
    
    return text


def _clean_text(text: str) -> str:
    """Clean up extracted text."""
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    
    # Remove excessive whitespace
    text = re.sub(r" +", " ", text)
    
    # Remove excessive blank lines (more than 2)
    text = re.sub(r"\n{3,}", "\n\n", text)
    
    # Strip leading/trailing whitespace
    text = text.strip()
    
    return text




