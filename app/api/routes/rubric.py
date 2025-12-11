"""
Rubric management endpoints.
"""

from fastapi import APIRouter, HTTPException
from pathlib import Path

from app.services.rubric import (
    load_rubric_from_markdown,
    create_default_rubric,
    RubricData,
)

router = APIRouter()


@router.get("/")
async def get_rubric():
    """
    Get the current default rubric.
    
    Returns:
        The complete rubric structure with categories, criteria, and levels.
    """
    # Try to load from file first
    rubric_path = Path("RubricDocs/rubric.md")
    
    if rubric_path.exists():
        try:
            rubric = load_rubric_from_markdown(rubric_path)
            return {
                "source": "file",
                "path": str(rubric_path),
                "rubric": rubric.to_dict(),
            }
        except Exception as e:
            # Fall back to default if parsing fails
            pass
    
    # Use programmatic default
    rubric = create_default_rubric()
    return {
        "source": "default",
        "rubric": rubric.to_dict(),
    }


@router.get("/default")
async def get_default_rubric():
    """
    Get the programmatically-defined default rubric.
    
    This is the rubric that matches rubric.md but is defined in code
    for reliability.
    """
    rubric = create_default_rubric()
    return rubric.to_dict()


@router.get("/summary")
async def get_rubric_summary():
    """
    Get a summary of the rubric structure.
    
    Useful for displaying rubric overview without full details.
    """
    rubric = create_default_rubric()
    
    summary = {
        "name": rubric.name,
        "total_points": rubric.total_points,
        "categories": []
    }
    
    for cat in rubric.categories:
        cat_summary = {
            "name": cat.name,
            "weight": cat.weight,
            "percentage": f"{(cat.weight / rubric.total_points) * 100:.0f}%",
            "criteria_count": len(cat.criteria),
            "criteria": [
                {"name": c.name, "points": c.points}
                for c in cat.criteria
            ]
        }
        summary["categories"].append(cat_summary)
    
    return summary


@router.get("/criteria")
async def list_criteria():
    """
    List all criteria with their IDs for reference.
    
    Useful for mapping assessment results to criteria.
    """
    rubric = create_default_rubric()
    criteria_list = []
    
    for cat_idx, cat in enumerate(rubric.categories):
        for crit_idx, crit in enumerate(cat.criteria):
            criteria_list.append({
                "id": f"cat{cat_idx}_crit{crit_idx}",
                "category": cat.name,
                "name": crit.name,
                "points": crit.points,
                "levels": [level.name for level in crit.levels],
            })
    
    return {
        "total_criteria": len(criteria_list),
        "criteria": criteria_list,
    }


