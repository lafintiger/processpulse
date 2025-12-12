"""
Student Submission API Routes

Handles student submissions from the Writer interface.
Saves essay (MD) and session data (JSON) to server storage for instructor review.
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(prefix="/api/submissions", tags=["submissions"])

settings = get_settings()

# Submissions storage directory
SUBMISSIONS_DIR = Path("./data/submissions")
SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)


# =============================================================================
# Request/Response Models
# =============================================================================

class StudentInfo(BaseModel):
    """Student identification."""
    name: str
    studentId: Optional[str] = None
    email: Optional[str] = None


class DocumentSubmission(BaseModel):
    """Document data for submission."""
    title: str
    content: str  # HTML content
    wordCount: int
    assignmentContext: Optional[str] = None


class ChatMessage(BaseModel):
    """A chat message from the Writer."""
    id: str
    role: str
    content: str
    timestamp: int
    selectedText: Optional[str] = None


class EventData(BaseModel):
    """A captured event from the Writer."""
    id: str
    timestamp: int
    sessionId: str
    eventType: str
    position: Optional[dict] = None
    content: Optional[str] = None
    contentLength: Optional[int] = None
    aiProvider: Optional[str] = None
    promptTokens: Optional[int] = None
    metadata: Optional[dict] = None


class SubmitRequest(BaseModel):
    """Request to submit writing for assessment."""
    student: StudentInfo
    sessionId: str
    sessionStartTime: int
    sessionEndTime: int
    document: DocumentSubmission
    events: List[EventData]
    chatMessages: List[ChatMessage]
    settings: Optional[dict] = None


class SubmissionResponse(BaseModel):
    """Response after successful submission."""
    success: bool
    message: str
    submissionId: str
    files: dict


class SubmissionListItem(BaseModel):
    """Summary of a submission for listing."""
    id: str
    studentName: str
    studentId: Optional[str]
    documentTitle: str
    wordCount: int
    submittedAt: str
    aiRequestCount: int
    hasMarkdown: bool
    hasJson: bool


# =============================================================================
# Helper Functions
# =============================================================================

def sanitize_filename(name: str) -> str:
    """Make a string safe for use as a filename."""
    # Replace spaces with underscores
    name = name.replace(" ", "_")
    # Remove any character that isn't alphanumeric, underscore, or hyphen
    name = re.sub(r'[^\w\-]', '', name)
    # Limit length
    return name[:50]


def html_to_markdown(html: str) -> str:
    """Convert HTML content to Markdown."""
    import re
    
    md = html
    
    # Headers
    md = re.sub(r'<h1[^>]*>(.*?)</h1>', r'# \1\n\n', md, flags=re.DOTALL)
    md = re.sub(r'<h2[^>]*>(.*?)</h2>', r'## \1\n\n', md, flags=re.DOTALL)
    md = re.sub(r'<h3[^>]*>(.*?)</h3>', r'### \1\n\n', md, flags=re.DOTALL)
    
    # Bold, italic, underline
    md = re.sub(r'<strong[^>]*>(.*?)</strong>', r'**\1**', md, flags=re.DOTALL)
    md = re.sub(r'<b[^>]*>(.*?)</b>', r'**\1**', md, flags=re.DOTALL)
    md = re.sub(r'<em[^>]*>(.*?)</em>', r'*\1*', md, flags=re.DOTALL)
    md = re.sub(r'<i[^>]*>(.*?)</i>', r'*\1*', md, flags=re.DOTALL)
    md = re.sub(r'<u[^>]*>(.*?)</u>', r'_\1_', md, flags=re.DOTALL)
    
    # Lists
    md = re.sub(r'<li[^>]*>(.*?)</li>', r'- \1\n', md, flags=re.DOTALL)
    md = re.sub(r'<ul[^>]*>(.*?)</ul>', r'\1\n', md, flags=re.DOTALL)
    md = re.sub(r'<ol[^>]*>(.*?)</ol>', r'\1\n', md, flags=re.DOTALL)
    
    # Blockquotes
    md = re.sub(r'<blockquote[^>]*>(.*?)</blockquote>', lambda m: '> ' + m.group(1).strip().replace('\n', '\n> ') + '\n\n', md, flags=re.DOTALL)
    
    # Links
    md = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r'[\2](\1)', md, flags=re.DOTALL)
    
    # Paragraphs
    md = re.sub(r'<p[^>]*>(.*?)</p>', r'\1\n\n', md, flags=re.DOTALL)
    
    # Line breaks
    md = re.sub(r'<br\s*/?>', '\n', md)
    
    # Remove remaining HTML tags
    md = re.sub(r'<[^>]+>', '', md)
    
    # Clean up whitespace
    md = re.sub(r'\n{3,}', '\n\n', md)
    md = re.sub(r'^\s+', '', md)
    md = re.sub(r'\s+$', '', md)
    
    # Decode HTML entities
    md = md.replace('&nbsp;', ' ')
    md = md.replace('&amp;', '&')
    md = md.replace('&lt;', '<')
    md = md.replace('&gt;', '>')
    md = md.replace('&quot;', '"')
    
    return md


def compute_stats(events: List[EventData]) -> dict:
    """Compute statistics from events."""
    stats = {
        'total_events': len(events),
        'ai_request_count': 0,
        'ai_accept_count': 0,
        'ai_reject_count': 0,
        'text_insert_count': 0,
        'text_delete_count': 0,
        'text_paste_count': 0,
        'text_copy_count': 0,
        'focus_lost_count': 0,
        'characters_typed': 0,
        'characters_pasted': 0,
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
            stats['characters_typed'] += event.contentLength or len(event.content or '')
        elif event.eventType == 'text_delete':
            stats['text_delete_count'] += 1
        elif event.eventType == 'text_paste':
            stats['text_paste_count'] += 1
            stats['characters_pasted'] += event.contentLength or len(event.content or '')
        elif event.eventType == 'text_copy':
            stats['text_copy_count'] += 1
        elif event.eventType == 'focus_lost':
            stats['focus_lost_count'] += 1
    
    return stats


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/submit", response_model=SubmissionResponse)
async def submit_writing(request: SubmitRequest):
    """
    Submit writing for assessment.
    
    Creates two files in the submissions directory:
    1. {student}_{title}_{timestamp}.md - The essay in Markdown format
    2. {student}_{title}_{timestamp}_session.json - Full session data for assessment
    """
    try:
        # Generate submission ID and timestamp
        timestamp = datetime.now()
        timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")
        
        # Create safe filename components
        student_name = sanitize_filename(request.student.name)
        doc_title = sanitize_filename(request.document.title)
        
        # Create submission folder for this student
        student_dir = SUBMISSIONS_DIR / student_name
        student_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filenames
        base_name = f"{doc_title}_{timestamp_str}"
        md_filename = f"{base_name}.md"
        json_filename = f"{base_name}_session.json"
        
        # Convert HTML to Markdown
        markdown_content = html_to_markdown(request.document.content)
        
        # Add header to markdown
        md_header = f"""---
title: {request.document.title}
student: {request.student.name}
student_id: {request.student.studentId or 'N/A'}
submitted: {timestamp.isoformat()}
word_count: {request.document.wordCount}
---

"""
        if request.document.assignmentContext:
            md_header += f"""## Assignment
{request.document.assignmentContext}

---

"""
        
        full_markdown = md_header + markdown_content
        
        # Save markdown file
        md_path = student_dir / md_filename
        md_path.write_text(full_markdown, encoding='utf-8')
        
        # Compute stats
        stats = compute_stats(request.events)
        
        # Prepare session JSON (for assessment)
        session_data = {
            "submissionId": f"{student_name}_{base_name}",
            "student": request.student.model_dump(),
            "submittedAt": timestamp.isoformat(),
            "document": {
                "title": request.document.title,
                "content": request.document.content,
                "wordCount": request.document.wordCount,
                "assignmentContext": request.document.assignmentContext,
            },
            "session": {
                "sessionId": request.sessionId,
                "startTime": request.sessionStartTime,
                "endTime": request.sessionEndTime,
                "durationMs": request.sessionEndTime - request.sessionStartTime,
            },
            "stats": stats,
            "events": [e.model_dump() for e in request.events],
            "chatMessages": [m.model_dump() for m in request.chatMessages],
            "settings": request.settings,
        }
        
        # Save JSON file
        json_path = student_dir / json_filename
        json_path.write_text(json.dumps(session_data, indent=2), encoding='utf-8')
        
        return SubmissionResponse(
            success=True,
            message=f"Submission received from {request.student.name}",
            submissionId=f"{student_name}_{base_name}",
            files={
                "markdown": str(md_path.relative_to(Path.cwd())),
                "json": str(json_path.relative_to(Path.cwd())),
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save submission: {str(e)}")


@router.get("/list", response_model=List[SubmissionListItem])
async def list_submissions(student: Optional[str] = None):
    """
    List all submissions, optionally filtered by student name.
    """
    submissions = []
    
    try:
        # Iterate through student directories
        for student_dir in SUBMISSIONS_DIR.iterdir():
            if not student_dir.is_dir():
                continue
            
            # Filter by student if specified
            if student and student.lower() not in student_dir.name.lower():
                continue
            
            # Find all JSON session files in this directory
            for json_file in student_dir.glob("*_session.json"):
                try:
                    data = json.loads(json_file.read_text(encoding='utf-8'))
                    
                    # Find corresponding MD file
                    md_file = json_file.parent / json_file.name.replace("_session.json", ".md")
                    
                    submissions.append(SubmissionListItem(
                        id=data.get("submissionId", json_file.stem),
                        studentName=data.get("student", {}).get("name", student_dir.name),
                        studentId=data.get("student", {}).get("studentId"),
                        documentTitle=data.get("document", {}).get("title", "Untitled"),
                        wordCount=data.get("document", {}).get("wordCount", 0),
                        submittedAt=data.get("submittedAt", ""),
                        aiRequestCount=data.get("stats", {}).get("ai_request_count", 0),
                        hasMarkdown=md_file.exists(),
                        hasJson=True,
                    ))
                except Exception as e:
                    print(f"Error reading {json_file}: {e}")
                    continue
        
        # Sort by submission time (newest first)
        submissions.sort(key=lambda x: x.submittedAt, reverse=True)
        
        return submissions
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list submissions: {str(e)}")


@router.get("/{submission_id}")
async def get_submission(submission_id: str):
    """
    Get full details of a submission.
    """
    try:
        # Parse submission ID to find the file
        parts = submission_id.split("_", 1)
        if len(parts) < 2:
            raise HTTPException(status_code=404, detail="Invalid submission ID format")
        
        student_name = parts[0]
        rest = parts[1]
        
        student_dir = SUBMISSIONS_DIR / student_name
        if not student_dir.exists():
            raise HTTPException(status_code=404, detail="Submission not found")
        
        # Find the session JSON file
        json_file = student_dir / f"{rest}_session.json"
        if not json_file.exists():
            # Try without the _session suffix
            json_file = student_dir / f"{rest}.json"
        
        if not json_file.exists():
            raise HTTPException(status_code=404, detail="Session file not found")
        
        data = json.loads(json_file.read_text(encoding='utf-8'))
        
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get submission: {str(e)}")


@router.get("/{submission_id}/download/{file_type}")
async def download_submission_file(submission_id: str, file_type: str):
    """
    Download a submission file (md or json).
    """
    if file_type not in ["md", "json"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Use 'md' or 'json'")
    
    try:
        parts = submission_id.split("_", 1)
        if len(parts) < 2:
            raise HTTPException(status_code=404, detail="Invalid submission ID format")
        
        student_name = parts[0]
        rest = parts[1]
        
        student_dir = SUBMISSIONS_DIR / student_name
        
        if file_type == "md":
            file_path = student_dir / f"{rest}.md"
        else:
            file_path = student_dir / f"{rest}_session.json"
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"{file_type.upper()} file not found")
        
        return FileResponse(
            path=file_path,
            filename=file_path.name,
            media_type="text/markdown" if file_type == "md" else "application/json"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")


@router.delete("/{submission_id}")
async def delete_submission(submission_id: str):
    """
    Delete a submission and its files.
    """
    try:
        parts = submission_id.split("_", 1)
        if len(parts) < 2:
            raise HTTPException(status_code=404, detail="Invalid submission ID format")
        
        student_name = parts[0]
        rest = parts[1]
        
        student_dir = SUBMISSIONS_DIR / student_name
        
        # Delete both files
        md_file = student_dir / f"{rest}.md"
        json_file = student_dir / f"{rest}_session.json"
        
        deleted = []
        if md_file.exists():
            md_file.unlink()
            deleted.append("md")
        if json_file.exists():
            json_file.unlink()
            deleted.append("json")
        
        if not deleted:
            raise HTTPException(status_code=404, detail="No files found to delete")
        
        return {"success": True, "deleted": deleted}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete submission: {str(e)}")


# =============================================================================
# Draft/Work-in-Progress Endpoints (for student resume functionality)
# =============================================================================

DRAFTS_DIR = Path("./data/drafts")
DRAFTS_DIR.mkdir(parents=True, exist_ok=True)


class SaveDraftRequest(BaseModel):
    """Request to save a work-in-progress draft."""
    student: StudentInfo
    sessionId: str
    sessionStartTime: int
    document: DocumentSubmission
    events: List[EventData]
    chatMessages: List[ChatMessage]
    settings: Optional[dict] = None


class DraftListItem(BaseModel):
    """Summary of a draft for listing."""
    id: str
    studentName: str
    documentTitle: str
    wordCount: int
    lastSaved: str
    aiRequestCount: int


@router.post("/draft/save")
async def save_draft(request: SaveDraftRequest):
    """
    Save work-in-progress to server (auto-save endpoint).
    
    This allows students to:
    1. Not lose work if browser closes
    2. Resume from any computer
    3. Continue where they left off
    
    Only one draft per student+title combination (overwrites previous).
    """
    try:
        student_name = sanitize_filename(request.student.name)
        doc_title = sanitize_filename(request.document.title)
        
        # Create student drafts folder
        student_dir = DRAFTS_DIR / student_name
        student_dir.mkdir(parents=True, exist_ok=True)
        
        # Use document title as filename (overwrites same-titled drafts)
        draft_filename = f"{doc_title}_draft.json"
        
        # Compute stats
        stats = compute_stats(request.events)
        
        # Prepare draft data
        draft_data = {
            "draftId": f"{student_name}_{doc_title}",
            "student": request.student.model_dump(),
            "lastSaved": datetime.now().isoformat(),
            "sessionId": request.sessionId,
            "sessionStartTime": request.sessionStartTime,
            "document": {
                "title": request.document.title,
                "content": request.document.content,
                "wordCount": request.document.wordCount,
                "assignmentContext": request.document.assignmentContext,
            },
            "stats": stats,
            "events": [e.model_dump() for e in request.events],
            "chatMessages": [m.model_dump() for m in request.chatMessages],
            "settings": request.settings,
            "status": "draft",
        }
        
        # Save draft
        draft_path = student_dir / draft_filename
        draft_path.write_text(json.dumps(draft_data, indent=2), encoding='utf-8')
        
        return {
            "success": True,
            "message": "Draft saved",
            "draftId": f"{student_name}_{doc_title}",
            "lastSaved": draft_data["lastSaved"],
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save draft: {str(e)}")


@router.get("/drafts/{student_name}", response_model=List[DraftListItem])
async def list_student_drafts(student_name: str):
    """
    List all drafts for a specific student.
    Allows students to see and resume their work-in-progress.
    """
    drafts = []
    
    try:
        safe_name = sanitize_filename(student_name)
        student_dir = DRAFTS_DIR / safe_name
        
        if not student_dir.exists():
            return []
        
        for draft_file in student_dir.glob("*_draft.json"):
            try:
                data = json.loads(draft_file.read_text(encoding='utf-8'))
                drafts.append(DraftListItem(
                    id=data.get("draftId", draft_file.stem),
                    studentName=data.get("student", {}).get("name", safe_name),
                    documentTitle=data.get("document", {}).get("title", "Untitled"),
                    wordCount=data.get("document", {}).get("wordCount", 0),
                    lastSaved=data.get("lastSaved", ""),
                    aiRequestCount=data.get("stats", {}).get("ai_request_count", 0),
                ))
            except Exception as e:
                print(f"Error reading draft {draft_file}: {e}")
                continue
        
        # Sort by last saved (newest first)
        drafts.sort(key=lambda x: x.lastSaved, reverse=True)
        return drafts
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list drafts: {str(e)}")


@router.get("/draft/{student_name}/{document_title}")
async def get_draft(student_name: str, document_title: str):
    """
    Get a specific draft to resume working on it.
    """
    try:
        safe_name = sanitize_filename(student_name)
        safe_title = sanitize_filename(document_title)
        
        draft_path = DRAFTS_DIR / safe_name / f"{safe_title}_draft.json"
        
        if not draft_path.exists():
            raise HTTPException(status_code=404, detail="Draft not found")
        
        data = json.loads(draft_path.read_text(encoding='utf-8'))
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get draft: {str(e)}")


@router.delete("/draft/{student_name}/{document_title}")
async def delete_draft(student_name: str, document_title: str):
    """
    Delete a draft (usually after submission).
    """
    try:
        safe_name = sanitize_filename(student_name)
        safe_title = sanitize_filename(document_title)
        
        draft_path = DRAFTS_DIR / safe_name / f"{safe_title}_draft.json"
        
        if not draft_path.exists():
            raise HTTPException(status_code=404, detail="Draft not found")
        
        draft_path.unlink()
        return {"success": True, "message": "Draft deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete draft: {str(e)}")

