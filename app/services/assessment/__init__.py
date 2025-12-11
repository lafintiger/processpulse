"""Assessment services for analyzing submissions."""

from app.services.assessment.prompts import (
    SYSTEM_PROMPT,
    create_criterion_prompt,
    create_summary_prompt,
    create_authenticity_prompt,
)
from app.services.assessment.analyzer import (
    AssessmentEngine,
    CriterionAssessment,
    FullAssessment,
    assess_submission,
)

__all__ = [
    "SYSTEM_PROMPT",
    "create_criterion_prompt",
    "create_summary_prompt",
    "create_authenticity_prompt",
    "AssessmentEngine",
    "CriterionAssessment",
    "FullAssessment",
    "assess_submission",
]


