"""
Assessment Prompts

Carefully crafted prompts for AI-assisted writing process assessment.
These prompts are designed to:
1. Produce consistent, fair scores
2. Require evidence citations
3. Avoid hallucinations
4. Provide constructive feedback
"""

from typing import Optional
from app.services.rubric.loader import CriterionData, LevelData


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SYSTEM_PROMPT = """You are an expert educational assessor specializing in evaluating student thinking processes when working with AI tools. Your role is to fairly and objectively assess student work according to a provided rubric.

KEY PRINCIPLES:
1. Focus on the THINKING PROCESS, not just the output
2. Look for evidence of intellectual honesty and genuine engagement
3. Value iteration, questioning, and evolution of ideas
4. Be fair but rigorous - neither overly harsh nor overly lenient
5. ALWAYS provide specific evidence for your assessments
6. ALWAYS cite exact exchange numbers (e.g., [CHAT:5]) when referencing the chat history
7. Do not invent or assume evidence that is not present

IMPORTANT CONTEXT:
- The student has been REQUIRED to use AI for this assignment
- AI use is NOT cheating - it is expected and encouraged
- You are evaluating HOW they used AI, not WHETHER they used it
- The 80/20 split means process (80%) matters more than the final essay (20%)

When citing evidence, use these formats:
- [CHAT:N] for chat exchange number N
- [ESSAY:PN] for essay paragraph N

You must respond in valid JSON format as specified in each task."""


# =============================================================================
# CRITERION ASSESSMENT PROMPT
# =============================================================================

def create_criterion_prompt(
    criterion: CriterionData,
    retrieved_chunks: str,
    essay_text: str,
    assignment_context: Optional[str] = None,
) -> str:
    """
    Create a prompt for assessing a specific criterion.
    
    Args:
        criterion: The criterion to assess
        retrieved_chunks: Relevant chat history excerpts
        essay_text: The student's essay
        assignment_context: Optional assignment description
        
    Returns:
        Formatted prompt string
    """
    # Format scoring levels
    levels_text = format_levels(criterion.levels)
    
    prompt = f"""ASSESSMENT TASK: Evaluate the following criterion from the rubric.

CRITERION: {criterion.name}
POINTS POSSIBLE: {criterion.points}

SCORING LEVELS:
{levels_text}

{"ASSIGNMENT CONTEXT:" + chr(10) + assignment_context + chr(10) if assignment_context else ""}
RELEVANT CHAT HISTORY EXCERPTS:
{retrieved_chunks}

ESSAY (for reference):
{essay_text[:3000]}{"..." if len(essay_text) > 3000 else ""}

YOUR TASK:
Assess this criterion based on the evidence provided in the chat history and essay.

You MUST respond with a JSON object in exactly this format:
{{
    "criterion_name": "{criterion.name}",
    "points_possible": {criterion.points},
    "points_earned": <number between 0 and {criterion.points}>,
    "level": "<exemplary|proficient|developing|inadequate>",
    "reasoning": "<2-3 sentences explaining your score, referencing specific evidence>",
    "evidence": [
        {{
            "type": "<chat_exchange|essay_section>",
            "reference": "<exchange number or paragraph number>",
            "citation": "<[CHAT:N] or [ESSAY:PN]>",
            "excerpt": "<brief relevant quote, max 100 chars>",
            "analysis": "<1 sentence explaining why this supports your assessment>"
        }}
    ],
    "feedback": "<2-3 sentences of constructive feedback for the student>",
    "confidence": "<high|medium|low>"
}}

IMPORTANT:
- Every score MUST have at least one piece of evidence
- If you cannot find clear evidence, score conservatively and note low confidence
- Be specific in your reasoning - avoid generic statements
- The feedback should be actionable and constructive
- Do not invent evidence that isn't in the excerpts provided"""

    return prompt


def format_levels(levels: list[LevelData]) -> str:
    """Format scoring levels for inclusion in prompts."""
    parts = []
    for level in sorted(levels, key=lambda x: x.order):
        parts.append(f"""
{level.name.upper()} ({level.min_points}-{level.max_points} points):
{level.description}""")
    return "\n".join(parts)


# =============================================================================
# SUMMARY ASSESSMENT PROMPT
# =============================================================================

def create_summary_prompt(
    criterion_results: list[dict],
    total_score: float,
    total_possible: int,
    essay_preview: str,
    assignment_context: Optional[str] = None,
) -> str:
    """
    Create a prompt for generating the overall summary assessment.
    
    Args:
        criterion_results: List of criterion assessment results
        total_score: Total points earned
        total_possible: Total points possible
        essay_preview: First portion of essay
        assignment_context: Optional assignment description
        
    Returns:
        Formatted prompt string
    """
    # Format criterion scores
    scores_text = format_criterion_scores(criterion_results)
    
    prompt = f"""SUMMARY ASSESSMENT TASK: Generate a holistic summary of this student's work.

COMPLETE ASSESSMENT DATA:
{scores_text}

OVERALL SCORES:
- Total: {total_score}/{total_possible} ({total_score/total_possible*100:.1f}%)

{"ASSIGNMENT: " + assignment_context + chr(10) if assignment_context else ""}
ESSAY PREVIEW:
{essay_preview[:2000]}{"..." if len(essay_preview) > 2000 else ""}

YOUR TASK:
Provide a holistic summary assessment in 2-3 paragraphs. Address:

1. Overall approach to AI collaboration - what patterns did you observe?
2. Key strengths demonstrated in their process
3. Areas where improvement is needed
4. Any notable or novel approaches
5. General intellectual trajectory shown

You MUST respond with a JSON object in exactly this format:
{{
    "summary_paragraphs": [
        "<paragraph 1: overall assessment and collaboration patterns>",
        "<paragraph 2: strengths and positive observations>",
        "<paragraph 3: areas for improvement and actionable recommendations>"
    ],
    "key_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
    "areas_for_growth": ["<area 1>", "<area 2>"],
    "notable_observations": "<any unique or notable aspects of this submission>",
    "overall_quality": "<exemplary|proficient|developing|inadequate>",
    "recommended_grade": "<A|B|C|D|F based on typical rubric conversion>"
}}

IMPORTANT:
- Be honest but constructive
- Avoid generic praise or criticism - be specific
- Your tone should be like a demanding but supportive professor
- Do not simply summarize scores - provide insight into the student's thinking"""

    return prompt


def format_criterion_scores(results: list[dict]) -> str:
    """Format criterion scores for summary prompt."""
    parts = []
    for result in results:
        parts.append(f"""
- {result.get('criterion_name', 'Unknown')}: {result.get('points_earned', 0)}/{result.get('points_possible', 0)} ({result.get('level', 'unknown')})
  Reasoning: {result.get('reasoning', 'N/A')[:200]}""")
    return "\n".join(parts)


# =============================================================================
# AUTHENTICITY CHECK PROMPT
# =============================================================================

def create_authenticity_prompt(
    chat_history_stats: dict,
    chat_excerpts: str,
    essay_text: str,
    mode: str = "conservative",
) -> str:
    """
    Create a prompt for authenticity/integrity checking.
    
    Args:
        chat_history_stats: Statistics about the chat history
        chat_excerpts: Sample of chat exchanges
        essay_text: The student's essay
        mode: "conservative" (fewer false positives) or "aggressive" (catch more)
        
    Returns:
        Formatted prompt string
    """
    threshold_note = """
NOTE: Use CONSERVATIVE thresholds. Only flag issues with clear evidence.
A false accusation is worse than missing a minor issue.
""" if mode == "conservative" else """
NOTE: Use THOROUGH analysis. Flag anything that seems unusual for instructor review.
The instructor will make final determinations.
"""

    prompt = f"""AUTHENTICITY ANALYSIS TASK: Analyze this submission for potential integrity concerns.

{threshold_note}

CHAT HISTORY STATISTICS:
- Total exchanges: {chat_history_stats.get('total_exchanges', 0)}
- Time span: {chat_history_stats.get('time_span', 'Unknown')}
- Average prompt length: {chat_history_stats.get('avg_prompt_length', 0)} characters
- Average response length: {chat_history_stats.get('avg_response_length', 0)} characters

SAMPLE CHAT EXCHANGES:
{chat_excerpts}

ESSAY CONTENT:
{essay_text[:4000]}{"..." if len(essay_text) > 4000 else ""}

ANALYSIS CHECKLIST:
1. TIMESTAMP PATTERNS: Are intervals suspiciously regular or uniform?
2. CONTENT ALIGNMENT: Does essay content appear to derive from the chat history?
3. CONVERSATION NATURALNESS: Does conversation show natural confusion, mistakes, dead ends?
4. STYLE CONSISTENCY: Is student's prompting style consistent throughout?
5. AI ARTIFACTS: Signs of AI-generated prompts (overly polished, em-dashes, generic phrasing)?
6. ITERATION EVIDENCE: Does the chat show genuine iteration and refinement?

You MUST respond with a JSON object in exactly this format:
{{
    "authenticity_score": <0-100, where 100 is fully authentic>,
    "confidence": "<high|medium|low>",
    "flags": [
        {{
            "type": "<timestamp|content|style|artifact|iteration>",
            "severity": "<low|medium|high>",
            "description": "<clear description of the concern>",
            "evidence": "<specific evidence supporting this flag>",
            "location": "<[CHAT:N] or general location>",
            "recommendation": "<what the instructor should look for>"
        }}
    ],
    "positive_indicators": [
        "<evidence of genuine engagement>",
        "<natural conversation patterns>",
        "<signs of authentic struggle/learning>"
    ],
    "overall_assessment": "<2-3 sentence summary of authenticity analysis>"
}}

CRITICAL REMINDERS:
- These are FLAGS FOR REVIEW, not accusations
- The instructor makes final judgments
- Some irregularities are normal - only flag significant concerns
- Always note positive indicators of genuine work
- Be specific about evidence - never make vague accusations"""

    return prompt


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_query_for_criterion(criterion_name: str) -> str:
    """
    Create a semantic search query for a rubric criterion.
    
    Maps criterion names to search queries that will retrieve
    relevant chat history excerpts.
    """
    query_map = {
        "Starting Point & Initial Thinking": 
            "What are the student's initial thoughts, position, thesis, or research question at the beginning of the conversation? First prompts showing original thinking.",
        
        "Iterative Refinement & Critical Engagement":
            "Where does the student push back, ask for clarification, request revisions, challenge the AI, or iterate on ideas? Back-and-forth refinement and engagement.",
        
        "Perspective Exploration & Intellectual Honesty":
            "Where does the student ask for counterarguments, opposing views, different perspectives, or challenges to their thesis? Intellectual flexibility and honesty.",
        
        "Research & Source Integration":
            "Where does the student ask for sources, verify claims, fact-check, request evidence, or integrate research? Source evaluation and verification.",
        
        "Process Reflection Quality":
            "Where does the student reflect on their process, discuss what they learned, acknowledge AI limitations, or show metacognitive awareness?",
        
        "Intellectual Growth & Position Evolution":
            "How does the student's position, thesis, or thinking change over the conversation? Evolution and refinement of ideas.",
        
        "Complete Documentation":
            "Evidence of complete conversation from start to finish, nothing appears edited or missing.",
        
        "Honesty & Attribution":
            "Where does the student acknowledge AI contributions, distinguish their ideas from AI's, or show transparency?",
        
        "Coherence & Structure":
            "Discussion of essay structure, thesis development, organization, transitions, or argument flow.",
        
        "Depth & Insight":
            "Deep analysis, nuanced thinking, complex ideas, insights beyond surface level, intellectual engagement.",
        
        "Writing Quality":
            "Discussion of writing style, voice, tone, grammar, editing, or prose quality.",
    }
    
    return query_map.get(
        criterion_name,
        f"Evidence related to: {criterion_name}"
    )


