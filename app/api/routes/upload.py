"""
File upload endpoints.
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from typing import Optional

from app.config import get_settings
from app.services.parsing import (
    parse_chat_history,
    parse_essay,
    ChatFormat,
)

router = APIRouter()
settings = get_settings()


@router.post("/essay")
async def upload_essay(
    file: UploadFile = File(...),
):
    """
    Upload and parse an essay file.
    
    Supports: TXT, DOCX, PDF, MD
    
    Returns:
        Parsed essay with text, word count, and metadata.
    """
    # Validate file extension
    filename = file.filename or "unknown"
    ext = "." + filename.split(".")[-1].lower() if "." in filename else ""
    
    if ext and ext not in settings.allowed_essay_ext_list:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {settings.allowed_essay_extensions}"
        )
    
    # Read content
    content = await file.read()
    
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {settings.max_upload_size_mb}MB"
        )
    
    try:
        parsed = parse_essay(content, filename)
        return {
            "success": True,
            "filename": filename,
            "parsed": parsed.to_dict(),
        }
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse essay: {str(e)}"
        )


@router.post("/chat-history")
async def upload_chat_history(
    file: UploadFile = File(...),
    format_hint: Optional[str] = Form(None),
):
    """
    Upload and parse a chat history file.
    
    Supports: JSON (LM Studio, generic), TXT, MD
    
    Args:
        file: The chat history file
        format_hint: Optional format hint ('lm_studio', 'plain_text', 'generic_json')
    
    Returns:
        Parsed chat history with exchanges and metadata.
    """
    filename = file.filename or "unknown"
    ext = "." + filename.split(".")[-1].lower() if "." in filename else ""
    
    if ext and ext not in settings.allowed_chat_ext_list:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {settings.allowed_chat_extensions}"
        )
    
    content = await file.read()
    
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: {settings.max_upload_size_mb}MB"
        )
    
    # Decode content
    try:
        content_str = content.decode("utf-8")
    except UnicodeDecodeError:
        content_str = content.decode("utf-8", errors="ignore")
    
    # Parse format hint
    hint = None
    if format_hint:
        format_map = {
            "lm_studio": ChatFormat.LM_STUDIO,
            "plain_text": ChatFormat.PLAIN_TEXT,
            "generic_json": ChatFormat.GENERIC_JSON,
        }
        hint = format_map.get(format_hint.lower())
    
    try:
        parsed = parse_chat_history(content_str, filename, format_hint=hint)
        return {
            "success": True,
            "filename": filename,
            "format_detected": parsed.format_detected.value,
            "exchange_count": parsed.total_exchanges,
            "parsing_notes": parsed.parsing_notes,
            "parsed": parsed.to_dict(),
        }
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse chat history: {str(e)}"
        )


@router.post("/preview")
async def preview_submission(
    essay: UploadFile = File(...),
    chat_history: UploadFile = File(...),
    student_identifier: Optional[str] = Form(None),
):
    """
    Preview a complete submission (essay + chat history).
    
    This endpoint validates and parses both files without saving to database.
    
    Returns:
        Preview of the parsed submission ready for assessment.
    """
    # Parse essay
    essay_content = await essay.read()
    try:
        parsed_essay = parse_essay(essay_content, essay.filename)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse essay: {str(e)}"
        )
    
    # Parse chat history
    chat_content = await chat_history.read()
    try:
        chat_str = chat_content.decode("utf-8", errors="ignore")
        parsed_chat = parse_chat_history(chat_str, chat_history.filename)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse chat history: {str(e)}"
        )
    
    # Validate
    warnings = []
    
    if parsed_essay.word_count < 100:
        warnings.append(f"Essay is very short ({parsed_essay.word_count} words)")
    
    if parsed_chat.total_exchanges < 2:
        warnings.append(f"Chat history has very few exchanges ({parsed_chat.total_exchanges})")
    
    if parsed_chat.total_exchanges < 6:
        warnings.append("Chat history has fewer than 6 exchanges - this may indicate limited iteration")
    
    return {
        "success": True,
        "student_identifier": student_identifier,
        "essay": {
            "filename": essay.filename,
            "word_count": parsed_essay.word_count,
            "paragraph_count": parsed_essay.paragraph_count,
            "preview": parsed_essay.text[:500] + "..." if len(parsed_essay.text) > 500 else parsed_essay.text,
        },
        "chat_history": {
            "filename": chat_history.filename,
            "format": parsed_chat.format_detected.value,
            "platform": parsed_chat.platform,
            "exchange_count": parsed_chat.total_exchanges,
            "first_exchange_preview": {
                "student": parsed_chat.exchanges[0].student_prompt[:200] + "..." if parsed_chat.exchanges and len(parsed_chat.exchanges[0].student_prompt) > 200 else (parsed_chat.exchanges[0].student_prompt if parsed_chat.exchanges else ""),
                "ai": parsed_chat.exchanges[0].ai_response[:200] + "..." if parsed_chat.exchanges and len(parsed_chat.exchanges[0].ai_response) > 200 else (parsed_chat.exchanges[0].ai_response if parsed_chat.exchanges else ""),
            } if parsed_chat.exchanges else None,
        },
        "warnings": warnings,
        "ready_for_assessment": len(warnings) == 0 or all("very" not in w.lower() for w in warnings),
    }

