"""
SQLAlchemy models for Process Analyzer.

Design Principles:
1. SQLite-compatible but PostgreSQL-ready
2. Use TEXT for JSON storage (works in both)
3. Use standard SQL types (no SQLite-specific features)
4. Include proper indexes for performance
5. Timestamps use ISO format strings (portable)
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)


def generate_uuid() -> str:
    """Generate a UUID string."""
    return str(uuid.uuid4())


def utc_now() -> str:
    """Get current UTC timestamp as ISO string."""
    return datetime.now(timezone.utc).isoformat()


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


# =============================================================================
# RUBRIC MODELS
# =============================================================================

class Rubric(Base):
    """
    Assessment rubric containing categories and criteria.
    """
    __tablename__ = "rubrics"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[str] = mapped_column(String(50), default="1.0")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    total_points: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[str] = mapped_column(String(50), default=utc_now)
    updated_at: Mapped[str] = mapped_column(String(50), default=utc_now, onupdate=utc_now)
    
    # Relationships
    categories: Mapped[list["RubricCategory"]] = relationship(
        "RubricCategory", 
        back_populates="rubric",
        cascade="all, delete-orphan",
        order_by="RubricCategory.order"
    )
    assignments: Mapped[list["Assignment"]] = relationship(
        "Assignment",
        back_populates="rubric"
    )


class RubricCategory(Base):
    """
    A category within a rubric (e.g., "AI Collaboration Process").
    """
    __tablename__ = "rubric_categories"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    rubric_id: Mapped[str] = mapped_column(String(36), ForeignKey("rubrics.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    weight: Mapped[int] = mapped_column(Integer, nullable=False)  # Points for this category
    order: Mapped[int] = mapped_column(Integer, default=0)  # Display order
    
    # Relationships
    rubric: Mapped["Rubric"] = relationship("Rubric", back_populates="categories")
    criteria: Mapped[list["RubricCriterion"]] = relationship(
        "RubricCriterion",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="RubricCriterion.order"
    )


class RubricCriterion(Base):
    """
    A specific criterion within a category (e.g., "Starting Point & Initial Thinking").
    """
    __tablename__ = "rubric_criteria"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    category_id: Mapped[str] = mapped_column(String(36), ForeignKey("rubric_categories.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    points: Mapped[int] = mapped_column(Integer, nullable=False)  # Max points for this criterion
    order: Mapped[int] = mapped_column(Integer, default=0)
    
    # Relationships
    category: Mapped["RubricCategory"] = relationship("RubricCategory", back_populates="criteria")
    levels: Mapped[list["CriterionLevel"]] = relationship(
        "CriterionLevel",
        back_populates="criterion",
        cascade="all, delete-orphan",
        order_by="CriterionLevel.order"
    )


class CriterionLevel(Base):
    """
    A scoring level for a criterion (e.g., "Exemplary", "Proficient").
    """
    __tablename__ = "criterion_levels"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    criterion_id: Mapped[str] = mapped_column(String(36), ForeignKey("rubric_criteria.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(50), nullable=False)  # exemplary, proficient, developing, inadequate
    min_points: Mapped[int] = mapped_column(Integer, nullable=False)
    max_points: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0)  # 0=exemplary, 1=proficient, etc.
    
    # Relationships
    criterion: Mapped["RubricCriterion"] = relationship("RubricCriterion", back_populates="levels")


# =============================================================================
# ASSIGNMENT & SUBMISSION MODELS
# =============================================================================

class Assignment(Base):
    """
    An assignment created by an instructor.
    """
    __tablename__ = "assignments"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Assignment prompt
    rubric_id: Mapped[str] = mapped_column(String(36), ForeignKey("rubrics.id"))
    learning_objectives: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Optional objectives
    emphasis_areas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Optional emphasis
    created_at: Mapped[str] = mapped_column(String(50), default=utc_now)
    updated_at: Mapped[str] = mapped_column(String(50), default=utc_now, onupdate=utc_now)
    
    # Relationships
    rubric: Mapped["Rubric"] = relationship("Rubric", back_populates="assignments")
    submissions: Mapped[list["Submission"]] = relationship(
        "Submission",
        back_populates="assignment",
        cascade="all, delete-orphan"
    )


class Submission(Base):
    """
    A student's submission including essay and chat history.
    """
    __tablename__ = "submissions"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    assignment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assignments.id", ondelete="CASCADE"))
    student_identifier: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Optional for privacy
    
    # Essay data
    essay_text: Mapped[str] = mapped_column(Text, nullable=False)
    essay_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    essay_word_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Chat history data (stored as JSON string)
    chat_history_raw: Mapped[str] = mapped_column(Text, nullable=False)  # Original file content
    chat_history_parsed: Mapped[str] = mapped_column(Text, nullable=False)  # Canonical JSON format
    chat_platform: Mapped[str] = mapped_column(String(50), default="unknown")
    chat_exchange_count: Mapped[int] = mapped_column(Integer, default=0)
    chat_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Process reflection (if provided separately)
    process_reflection: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Status
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, analyzing, reviewed, finalized
    
    # Timestamps
    created_at: Mapped[str] = mapped_column(String(50), default=utc_now)
    updated_at: Mapped[str] = mapped_column(String(50), default=utc_now, onupdate=utc_now)
    
    # Relationships
    assignment: Mapped["Assignment"] = relationship("Assignment", back_populates="submissions")
    assessments: Mapped[list["Assessment"]] = relationship(
        "Assessment",
        back_populates="submission",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index("ix_submissions_status", "status"),
        Index("ix_submissions_assignment", "assignment_id"),
    )


# =============================================================================
# ASSESSMENT MODELS
# =============================================================================

class Assessment(Base):
    """
    An AI-generated assessment of a submission.
    Multiple assessments can exist per submission (multi-model comparison).
    """
    __tablename__ = "assessments"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    submission_id: Mapped[str] = mapped_column(String(36), ForeignKey("submissions.id", ondelete="CASCADE"))
    
    # Model information
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    model_identifier: Mapped[str] = mapped_column(String(255), nullable=False)  # Full model path
    pass_number: Mapped[int] = mapped_column(Integer, default=1)  # For multiple passes
    
    # Scoring
    total_score: Mapped[float] = mapped_column(Float, default=0.0)
    total_possible: Mapped[int] = mapped_column(Integer, default=100)
    
    # Summary
    summary_assessment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Review status
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)  # Primary assessment for this submission
    instructor_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    instructor_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    instructor_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Prompt version tracking
    prompt_version: Mapped[str] = mapped_column(String(50), default="1.0")
    
    # Timestamps
    created_at: Mapped[str] = mapped_column(String(50), default=utc_now)
    reviewed_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Relationships
    submission: Mapped["Submission"] = relationship("Submission", back_populates="assessments")
    criterion_scores: Mapped[list["CriterionScore"]] = relationship(
        "CriterionScore",
        back_populates="assessment",
        cascade="all, delete-orphan"
    )
    authenticity_flags: Mapped[list["AuthenticityFlag"]] = relationship(
        "AuthenticityFlag",
        back_populates="assessment",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index("ix_assessments_submission", "submission_id"),
        Index("ix_assessments_model", "model_name"),
    )


class CriterionScore(Base):
    """
    Score for a specific criterion within an assessment.
    """
    __tablename__ = "criterion_scores"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    assessment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"))
    criterion_id: Mapped[str] = mapped_column(String(36), ForeignKey("rubric_criteria.id"))
    
    # Scoring
    points_earned: Mapped[float] = mapped_column(Float, nullable=False)
    points_possible: Mapped[int] = mapped_column(Integer, nullable=False)
    level_name: Mapped[str] = mapped_column(String(50), nullable=False)  # exemplary, proficient, etc.
    
    # Evidence (stored as JSON string)
    evidence: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of evidence objects
    
    # Feedback
    ai_reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    ai_feedback: Mapped[str] = mapped_column(Text, nullable=False)  # Feedback for student
    
    # Instructor adjustments
    instructor_adjusted: Mapped[bool] = mapped_column(Boolean, default=False)
    instructor_points: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    instructor_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    instructor_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="criterion_scores")
    criterion: Mapped["RubricCriterion"] = relationship("RubricCriterion")


class AuthenticityFlag(Base):
    """
    Flags raised during authenticity analysis.
    """
    __tablename__ = "authenticity_flags"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    assessment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"))
    
    flag_type: Mapped[str] = mapped_column(String(50), nullable=False)  # timestamp, content, style, artifact
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # low, medium, high
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # e.g., "CHAT:5" or "ESSAY:P3"
    
    # Instructor review
    instructor_dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    instructor_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="authenticity_flags")


# =============================================================================
# WRITING SESSION MODELS (for Writer interface)
# =============================================================================

class WritingSession(Base):
    """
    A writing session from the ProcessPulse Writer interface.
    Contains the document, chat history, and all captured events.
    """
    __tablename__ = "writing_sessions"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)  # From frontend
    
    # Document info
    document_title: Mapped[str] = mapped_column(String(255), nullable=False)
    document_content: Mapped[str] = mapped_column(Text, nullable=False)
    assignment_context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Session timing (Unix milliseconds from frontend)
    session_start_time: Mapped[int] = mapped_column(Integer, nullable=False)  # ms timestamp
    session_end_time: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # ms timestamp
    
    # Raw data (JSON)
    events_json: Mapped[str] = mapped_column(Text, nullable=False)  # All captured events
    chat_messages_json: Mapped[str] = mapped_column(Text, nullable=False)  # Chat history
    
    # Computed stats
    total_events: Mapped[int] = mapped_column(Integer, default=0)
    ai_request_count: Mapped[int] = mapped_column(Integer, default=0)
    ai_accept_count: Mapped[int] = mapped_column(Integer, default=0)
    ai_reject_count: Mapped[int] = mapped_column(Integer, default=0)
    text_insert_count: Mapped[int] = mapped_column(Integer, default=0)
    text_delete_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # AI provider used
    ai_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ai_model: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Status
    status: Mapped[str] = mapped_column(String(50), default="active")  # active, completed, exported
    
    # Link to submission (optional - when session is used for assessment)
    submission_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("submissions.id"), nullable=True)
    
    # Timestamps
    created_at: Mapped[str] = mapped_column(String(50), default=utc_now)
    updated_at: Mapped[str] = mapped_column(String(50), default=utc_now, onupdate=utc_now)
    
    # Indexes
    __table_args__ = (
        Index("ix_writing_sessions_session_id", "session_id"),
        Index("ix_writing_sessions_status", "status"),
    )


# =============================================================================
# PROMPT MANAGEMENT
# =============================================================================

class Prompt(Base):
    """
    Assessment prompts with versioning.
    """
    __tablename__ = "prompts"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    
    # Identification
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    prompt_type: Mapped[str] = mapped_column(String(50), nullable=False)  # system, criterion, summary, authenticity
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Timestamps
    created_at: Mapped[str] = mapped_column(String(50), default=utc_now)
    
    # Indexes
    __table_args__ = (
        Index("ix_prompts_type_version", "prompt_type", "version"),
        Index("ix_prompts_active", "is_active"),
    )


