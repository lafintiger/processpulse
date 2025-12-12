"""
Writing Session API Routes

Endpoints for saving and retrieving writing sessions from the Writer interface.
All events are timestamped with Unix milliseconds from the frontend.
"""

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.database import get_db_context
from app.db.models import WritingSession

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


# =============================================================================
# Request/Response Models
# =============================================================================

class EventData(BaseModel):
    """A single captured event from the Writer."""
    id: str
    timestamp: int  # Unix milliseconds
    sessionId: str
    eventType: str
    position: dict | None = None
    content: str | None = None
    aiProvider: str | None = None
    promptTokens: int | None = None
    metadata: dict | None = None


class ChatMessageData(BaseModel):
    """A chat message from the Writer."""
    id: str
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: int  # Unix milliseconds
    selectedText: str | None = None


class DocumentData(BaseModel):
    """Document data from the Writer."""
    id: str
    title: str
    content: str
    wordCount: int
    assignmentContext: str | None = None
    createdAt: int
    updatedAt: int


class SaveSessionRequest(BaseModel):
    """Request to save a writing session."""
    sessionId: str
    sessionStartTime: int  # Unix milliseconds
    sessionEndTime: int | None = None
    document: DocumentData
    events: list[EventData]
    chatMessages: list[ChatMessageData]
    settings: dict | None = None  # Provider settings


class SessionResponse(BaseModel):
    """Response for session operations."""
    success: bool
    sessionId: str
    message: str
    stats: dict | None = None


class SessionListItem(BaseModel):
    """Summary of a session for listing."""
    id: str
    sessionId: str
    documentTitle: str
    wordCount: int
    sessionStartTime: int
    sessionEndTime: int | None
    totalEvents: int
    aiRequestCount: int
    status: str
    createdAt: str


# =============================================================================
# Helper Functions
# =============================================================================

def compute_event_stats(events: list[EventData]) -> dict:
    """Compute statistics from events."""
    stats = {
        'total_events': len(events),
        'ai_request_count': 0,
        'ai_accept_count': 0,
        'ai_reject_count': 0,
        'text_insert_count': 0,
        'text_delete_count': 0,
    }
    
    for event in events:
        if event.eventType == 'ai_request':
            stats['ai_request_count'] += 1
        elif event.eventType == 'ai_accept':
            stats['ai_accept_count'] += 1
        elif event.eventType == 'ai_reject':
            stats['ai_reject_count'] += 1
        elif event.eventType == 'text_insert':
            stats['text_insert_count'] += 1
        elif event.eventType == 'text_delete':
            stats['text_delete_count'] += 1
    
    return stats


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/save", response_model=SessionResponse)
async def save_session(request: SaveSessionRequest):
    """
    Save a writing session from the Writer interface.
    
    All timestamps are Unix milliseconds from the frontend.
    Events and chat messages are stored as JSON for flexibility.
    """
    try:
        async with get_db_context() as session:
            # Check if session already exists
            from sqlalchemy import select
            result = await session.execute(
                select(WritingSession).where(WritingSession.session_id == request.sessionId)
            )
            existing = result.scalar_one_or_none()
            
            # Compute stats
            stats = compute_event_stats(request.events)
            
            # Extract provider info from settings
            ai_provider = None
            ai_model = None
            if request.settings:
                ai_provider = request.settings.get('providerType')
                if ai_provider == 'ollama':
                    ai_model = request.settings.get('ollamaModel')
                elif ai_provider == 'openai':
                    ai_model = request.settings.get('openaiModel')
                elif ai_provider == 'anthropic':
                    ai_model = request.settings.get('anthropicModel')
            
            # Serialize events and chat messages
            events_json = json.dumps([e.model_dump() for e in request.events])
            chat_json = json.dumps([m.model_dump() for m in request.chatMessages])
            
            if existing:
                # Update existing session
                existing.document_content = request.document.content
                existing.word_count = request.document.wordCount
                existing.session_end_time = request.sessionEndTime
                existing.events_json = events_json
                existing.chat_messages_json = chat_json
                existing.total_events = stats['total_events']
                existing.ai_request_count = stats['ai_request_count']
                existing.ai_accept_count = stats['ai_accept_count']
                existing.ai_reject_count = stats['ai_reject_count']
                existing.text_insert_count = stats['text_insert_count']
                existing.text_delete_count = stats['text_delete_count']
                existing.ai_provider = ai_provider
                existing.ai_model = ai_model
                if request.sessionEndTime:
                    existing.status = 'completed'
                
                await session.commit()
                
                return SessionResponse(
                    success=True,
                    sessionId=request.sessionId,
                    message="Session updated",
                    stats=stats
                )
            else:
                # Create new session
                writing_session = WritingSession(
                    session_id=request.sessionId,
                    document_title=request.document.title,
                    document_content=request.document.content,
                    assignment_context=request.document.assignmentContext,
                    word_count=request.document.wordCount,
                    session_start_time=request.sessionStartTime,
                    session_end_time=request.sessionEndTime,
                    events_json=events_json,
                    chat_messages_json=chat_json,
                    total_events=stats['total_events'],
                    ai_request_count=stats['ai_request_count'],
                    ai_accept_count=stats['ai_accept_count'],
                    ai_reject_count=stats['ai_reject_count'],
                    text_insert_count=stats['text_insert_count'],
                    text_delete_count=stats['text_delete_count'],
                    ai_provider=ai_provider,
                    ai_model=ai_model,
                    status='active' if not request.sessionEndTime else 'completed',
                )
                
                session.add(writing_session)
                await session.commit()
                
                return SessionResponse(
                    success=True,
                    sessionId=request.sessionId,
                    message="Session saved",
                    stats=stats
                )
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save session: {str(e)}")


@router.get("/list", response_model=list[SessionListItem])
async def list_sessions(
    status: str | None = None,
    limit: int = 50
):
    """
    List saved writing sessions.
    
    Args:
        status: Filter by status (active, completed, exported)
        limit: Maximum number of sessions to return
    """
    try:
        async with get_db_context() as session:
            from sqlalchemy import select, desc
            
            query = select(WritingSession).order_by(desc(WritingSession.created_at)).limit(limit)
            
            if status:
                query = query.where(WritingSession.status == status)
            
            result = await session.execute(query)
            sessions = result.scalars().all()
            
            return [
                SessionListItem(
                    id=s.id,
                    sessionId=s.session_id,
                    documentTitle=s.document_title,
                    wordCount=s.word_count,
                    sessionStartTime=s.session_start_time,
                    sessionEndTime=s.session_end_time,
                    totalEvents=s.total_events,
                    aiRequestCount=s.ai_request_count,
                    status=s.status,
                    createdAt=s.created_at,
                )
                for s in sessions
            ]
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")


@router.get("/{session_id}")
async def get_session_details(session_id: str):
    """
    Get full details of a writing session including all events and chat messages.
    """
    try:
        async with get_session() as db_session:
            from sqlalchemy import select
            
            result = await db_session.execute(
                select(WritingSession).where(WritingSession.session_id == session_id)
            )
            writing_session = result.scalar_one_or_none()
            
            if not writing_session:
                raise HTTPException(status_code=404, detail="Session not found")
            
            return {
                "id": writing_session.id,
                "sessionId": writing_session.session_id,
                "document": {
                    "title": writing_session.document_title,
                    "content": writing_session.document_content,
                    "assignmentContext": writing_session.assignment_context,
                    "wordCount": writing_session.word_count,
                },
                "sessionStartTime": writing_session.session_start_time,
                "sessionEndTime": writing_session.session_end_time,
                "events": json.loads(writing_session.events_json),
                "chatMessages": json.loads(writing_session.chat_messages_json),
                "stats": {
                    "totalEvents": writing_session.total_events,
                    "aiRequestCount": writing_session.ai_request_count,
                    "aiAcceptCount": writing_session.ai_accept_count,
                    "aiRejectCount": writing_session.ai_reject_count,
                    "textInsertCount": writing_session.text_insert_count,
                    "textDeleteCount": writing_session.text_delete_count,
                },
                "aiProvider": writing_session.ai_provider,
                "aiModel": writing_session.ai_model,
                "status": writing_session.status,
                "createdAt": writing_session.created_at,
                "updatedAt": writing_session.updated_at,
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session: {str(e)}")


@router.post("/{session_id}/export")
async def export_session_for_assessment(session_id: str):
    """
    Export a writing session to be used for assessment.
    
    This converts the session data into the format expected by the analyzer.
    Returns both the essay and a formatted chat history.
    """
    try:
        async with get_session() as db_session:
            from sqlalchemy import select
            
            result = await db_session.execute(
                select(WritingSession).where(WritingSession.session_id == session_id)
            )
            writing_session = result.scalar_one_or_none()
            
            if not writing_session:
                raise HTTPException(status_code=404, detail="Session not found")
            
            # Parse chat messages
            chat_messages = json.loads(writing_session.chat_messages_json)
            
            # Convert to canonical chat format for assessment
            canonical_chat = []
            for msg in chat_messages:
                canonical_chat.append({
                    "role": msg["role"],
                    "content": msg["content"],
                    "timestamp": msg["timestamp"],
                    "selected_text": msg.get("selectedText"),
                })
            
            # Mark as exported
            writing_session.status = 'exported'
            await db_session.commit()
            
            return {
                "essay": {
                    "title": writing_session.document_title,
                    "content": writing_session.document_content,
                    "wordCount": writing_session.word_count,
                    "assignmentContext": writing_session.assignment_context,
                },
                "chatHistory": canonical_chat,
                "processMetrics": {
                    "sessionDurationMs": (
                        writing_session.session_end_time - writing_session.session_start_time
                        if writing_session.session_end_time
                        else None
                    ),
                    "totalEvents": writing_session.total_events,
                    "aiRequestCount": writing_session.ai_request_count,
                    "aiAcceptRate": (
                        writing_session.ai_accept_count / writing_session.ai_request_count
                        if writing_session.ai_request_count > 0
                        else None
                    ),
                    "textInsertCount": writing_session.text_insert_count,
                    "textDeleteCount": writing_session.text_delete_count,
                },
                "sessionId": writing_session.session_id,
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export session: {str(e)}")

