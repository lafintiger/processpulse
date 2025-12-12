"""
Assessment endpoints.

These endpoints handle the core assessment functionality:
- Creating new assessments
- Running AI analysis with streaming progress
- Retrieving results
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, AsyncGenerator
import json
import traceback
import asyncio

from app.config import get_settings
from app.services.parsing.essay_parser import parse_essay, ParsedEssay
from app.services.parsing.chat_parser import parse_chat_history, ParsedChatHistory
from app.services.rubric import create_default_rubric
from app.services.assessment.analyzer import assess_submission

router = APIRouter()
settings = get_settings()


class AssessmentRequest(BaseModel):
    """Request to create a new assessment."""
    essay_text: str
    chat_history_json: str  # Parsed chat history in canonical format
    assignment_context: Optional[str] = None
    learning_objectives: Optional[str] = None
    student_identifier: Optional[str] = None
    model_name: Optional[str] = None
    multi_model: bool = False
    additional_models: Optional[list[str]] = None
    authenticity_check: bool = True
    authenticity_mode: Optional[str] = None  # "conservative" or "aggressive"


class AssessmentResponse(BaseModel):
    """Response from assessment creation."""
    assessment_id: str
    status: str
    message: str


# Global progress storage for SSE
_progress_store: dict[str, dict] = {}


@router.post("/create")
async def create_assessment(
    request: AssessmentRequest,
    background_tasks: BackgroundTasks,
):
    """
    Create and run an assessment.
    
    This endpoint runs synchronously and returns the full result.
    Progress is printed to the console.
    """
    try:
        print("\n" + "="*60)
        print("[Assessment] Starting new assessment")
        print("="*60)
        
        # Parse the essay
        print("[1/14] Parsing essay...")
        essay = parse_essay(request.essay_text, filename="essay.txt")
        print(f"       Essay: {essay.word_count} words")
        
        # Parse the chat history from JSON
        print("[2/14] Parsing chat history...")
        chat_history = parse_chat_history(request.chat_history_json)
        print(f"       Chat: {chat_history.total_exchanges} exchanges ({chat_history.platform})")
        
        # Get the rubric
        rubric = create_default_rubric()
        
        # Determine model to use
        model = request.model_name or settings.default_analysis_model
        print(f"[3/14] Using model: {model}")
        
        # Progress callback
        def progress_callback(message: str, current: int, total: int):
            step = current + 3  # Offset for parsing steps
            print(f"[{step}/{total + 3}] {message}")
        
        # Run the assessment
        result = await assess_submission(
            chat_history=chat_history,
            essay=essay,
            rubric=rubric,
            assignment_context=request.assignment_context,
            model=model,
            run_authenticity=request.authenticity_check,
            authenticity_mode=request.authenticity_mode or "conservative",
            progress_callback=progress_callback,
        )
        
        # Convert to dict for JSON response
        result_dict = result.to_dict()
        
        print("="*60)
        print(f"[Assessment] Complete! Score: {result_dict.get('total_score', 0)}/{result_dict.get('total_possible', 100)}")
        print("="*60 + "\n")
        
        return result_dict
        
    except Exception as e:
        print(f"\n[Assessment] ERROR: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Assessment failed: {str(e)}"
        )


@router.get("/status/{assessment_id}")
async def get_assessment_status(assessment_id: str):
    """
    Get the status of an assessment.
    
    Returns:
        Current status and progress information.
    """
    # Placeholder for now
    return {
        "assessment_id": assessment_id,
        "status": "pending",
        "message": "Assessment status endpoint ready. Database integration pending.",
    }


@router.get("/{assessment_id}")
async def get_assessment(assessment_id: str):
    """
    Get complete assessment results.
    
    Returns:
        Full assessment with all criterion scores, evidence, and summary.
    """
    # Placeholder for now
    return {
        "assessment_id": assessment_id,
        "message": "Assessment retrieval endpoint ready. Full implementation pending.",
    }


@router.get("/")
async def list_assessments(
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None,
):
    """
    List assessments with optional filtering.
    
    Args:
        limit: Maximum number of results
        offset: Pagination offset
        status: Filter by status (pending, analyzing, reviewed, finalized)
    """
    return {
        "message": "Assessment listing endpoint ready.",
        "filters": {
            "limit": limit,
            "offset": offset,
            "status": status,
        },
        "assessments": [],
        "total": 0,
    }
