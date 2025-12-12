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

SYSTEM_PROMPT = """You are an expert educational assessor specializing in evaluating student thinking processes when working with AI tools. Your role is to RIGOROUSLY assess student work according to a provided rubric. You are a demanding but fair professor who expects genuine intellectual engagement.

KEY PRINCIPLES:
1. Focus on the THINKING PROCESS, not just the output
2. Look for evidence of intellectual honesty and genuine engagement
3. Value iteration, questioning, and evolution of ideas
4. BE STRICT - students must demonstrate their own thinking, not just delegate to AI
5. ALWAYS provide specific evidence for your assessments
6. ALWAYS cite exact exchange numbers (e.g., [CHAT:5]) when referencing the chat history
7. Do not invent or assume evidence that is not present
8. When in doubt, score LOWER - generous grading harms the student's growth

CRITICAL: DETECTING AI OVER-DEPENDENCE (Score these patterns as INADEQUATE or DEVELOPING, never Proficient/Exemplary)

RED FLAGS FOR COPY-PASTE DELEGATION (automatic penalty - score Inadequate or low Developing):
- "give me a paragraph about X" / "write me a paragraph for X"
- "make this into a paragraph I can use"
- "complete this for me" / "finish this section"
- "add this to my essay" without any modification
- Accepting AI output verbatim with no changes or pushback
- Asking AI to "pick" or "choose" things for the student
- No evidence of the student's original thinking BEFORE asking AI

RED FLAGS FOR PASSIVE CONSUMPTION (score no higher than Developing):
- Simple questions like "what is X?" without follow-up depth
- Never disagreeing with or challenging AI responses
- Never asking "why" or "how" - only "what"
- Format requests only ("make it shorter", "make it one paragraph")
- No evidence of the student forming their own position

WHAT GENUINE ENGAGEMENT LOOKS LIKE (required for Proficient/Exemplary):
- Student states their OWN thesis/position FIRST, then asks AI to critique it
- Student pushes back: "I disagree because...", "But what about...", "That doesn't account for..."
- Student synthesizes multiple AI responses into something new
- Student catches AI errors or biases
- Student asks for counterarguments and genuinely wrestles with them
- Evidence of thinking BETWEEN exchanges, not just AI doing all the work

IMPORTANT CONTEXT:
- The student has been REQUIRED to use AI for this assignment
- AI use is NOT cheating - it is expected and encouraged
- You are evaluating HOW they used AI, not WHETHER they used it
- The 80/20 split means process (80%) matters more than the final essay (20%)
- A student who treats AI as a "write my essay" tool has FAILED the process criteria
- A student who uses AI as a thinking partner and demonstrates their own growth has succeeded

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
BE STRICT. This rubric evaluates the student's THINKING PROCESS, not just their ability to prompt AI.

SCORING GUIDANCE - READ CAREFULLY:

INADEQUATE (0-49% of points): The student shows one or more of these patterns:
- Delegating thinking to AI ("give me a paragraph", "write this for me", "pick for me")
- No original position or thesis stated before asking AI for help
- Accepting AI output without any critical evaluation or modification
- Simple factual queries with no depth ("what is X?")
- No pushback, disagreement, or challenging of AI responses

DEVELOPING (50-69% of points): The student shows:
- Some direction given to AI, but still mostly passive
- Occasional questions but no sustained engagement
- Format-focused requests ("make it shorter") without substantive critique
- May state a position but doesn't defend or develop it independently

PROFICIENT (70-89% of points): The student demonstrates:
- Clear original thinking BEFORE using AI as a tool
- Meaningful pushback or questioning of AI responses (at least 2-3 instances)
- Synthesis of information rather than copy-paste
- Some evidence of intellectual struggle and growth

EXEMPLARY (90-100% of points): The student demonstrates:
- Strong original position articulated first, AI used to stress-test it
- Multiple instances of disagreement, critique, or catching AI limitations
- Clear evidence that the final work is the STUDENT'S, enhanced by AI
- Sophisticated synthesis and intellectual growth visible across exchanges

You MUST respond with a JSON object in exactly this format:
{{
    "criterion_name": "{criterion.name}",
    "points_possible": {criterion.points},
    "points_earned": <number between 0 and {criterion.points}>,
    "level": "<exemplary|proficient|developing|inadequate>",
    "reasoning": "<2-3 sentences explaining your score, referencing specific evidence. If student delegated to AI, say so explicitly.>",
    "evidence": [
        {{
            "type": "<chat_exchange|essay_section>",
            "reference": "<exchange number or paragraph number>",
            "citation": "<[CHAT:N] or [ESSAY:PN]>",
            "excerpt": "<brief relevant quote, max 100 chars>",
            "analysis": "<1 sentence explaining why this supports your assessment - note if this is copy-paste delegation>"
        }}
    ],
    "feedback": "<2-3 sentences of constructive feedback for the student>",
    "confidence": "<high|medium|low>"
}}

CRITICAL REMINDERS:
- Every score MUST have at least one piece of evidence
- If evidence shows DELEGATION to AI (write for me, give me a paragraph), score INADEQUATE
- If student never states their OWN position before asking AI, score no higher than DEVELOPING
- If you cannot find clear evidence of genuine engagement, score INADEQUATE with high confidence
- Be specific in your reasoning - avoid generic statements
- The feedback should be actionable and constructive
- Do not invent evidence that isn't in the excerpts provided
- When in doubt, score LOWER - this is an assessment of thinking, not prompting skill"""

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
Provide a holistic summary assessment in 2-3 paragraphs. BE HONEST AND DIRECT.

KEY QUESTION TO ANSWER: Did this student USE AI as a thinking partner, or did they DELEGATE their thinking TO AI?

Signs of DELEGATION (overall quality should be Inadequate or Developing):
- Most prompts are "give me X" or "write X for me"
- Student never states their own position before asking AI
- Final essay is essentially AI-generated with minimal student input
- No evidence of pushback, disagreement, or intellectual struggle
- Student treated AI as a "write my essay" service

Signs of genuine COLLABORATION (can be Proficient or Exemplary):
- Student articulates their own ideas first, uses AI to refine
- Multiple instances of pushback, critique, or challenging AI
- Final essay shows synthesis of student + AI thinking
- Evidence of intellectual growth and position evolution
- Student catches AI errors or contributes unique insights

Address:
1. Overall approach to AI collaboration - delegation vs. genuine thinking partnership?
2. Key strengths demonstrated in their process (be specific, not generic)
3. Areas where improvement is needed (be direct about delegation if present)
4. General intellectual trajectory - did the student GROW or just CONSUME?

GRADING STANDARDS:
- A (90-100%): Exemplary thinking partnership, strong original contribution
- B (80-89%): Proficient collaboration with clear student thinking
- C (70-79%): Developing skills, some delegation but some engagement
- D (60-69%): Significant delegation, minimal original thinking
- F (below 60%): Used AI as a ghostwriter, not a thinking partner

You MUST respond with a JSON object in exactly this format:
{{
    "summary_paragraphs": [
        "<paragraph 1: overall assessment - was this delegation or collaboration? Be direct.>",
        "<paragraph 2: strengths IF ANY - be specific, not generic. If few strengths, say so.>",
        "<paragraph 3: areas for improvement - be actionable and honest about what went wrong>"
    ],
    "key_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
    "areas_for_growth": ["<area 1>", "<area 2>"],
    "notable_observations": "<any unique or notable aspects - including concerning patterns>",
    "overall_quality": "<exemplary|proficient|developing|inadequate>",
    "recommended_grade": "<A|B|C|D|F based on evidence of genuine thinking, NOT essay quality>"
}}

IMPORTANT:
- Be HONEST - a polished essay generated by AI with minimal student thinking is a FAILING grade
- Avoid generic praise - if there's nothing specific to praise, say "limited strengths observed"
- Your tone should be like a demanding professor who cares about actual learning
- The grade reflects PROCESS (80%), not just the essay (20%)
- A student who delegates to AI has failed the assignment regardless of essay quality"""

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
7. DELEGATION PATTERNS: Frequent "give me", "write for me", "make this a paragraph" requests
8. ORIGINAL THINKING: Does student ever state their OWN position before asking AI?
9. INTELLECTUAL ENGAGEMENT: Does student ever disagree, push back, or challenge AI?
10. SYNTHESIS vs COPY-PASTE: Did student integrate AI output or just paste it?

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
            "What are the student's initial thoughts, position, thesis, or research question at the beginning of the conversation? Does the student state their OWN position BEFORE asking AI for help? Look for original thinking vs. immediately asking AI 'what is X' or 'tell me about X'.",
        
        "Iterative Refinement & Critical Engagement":
            "Where does the student push back, disagree, ask for clarification, request revisions, challenge the AI, or iterate on ideas? Look for 'I disagree', 'but what about', 'that doesn't make sense'. Also look for DELEGATION patterns: 'give me a paragraph', 'write this for me', 'make this a paragraph I can use'.",
        
        "Perspective Exploration & Intellectual Honesty":
            "Where does the student ask for counterarguments, opposing views, different perspectives, or challenges to their thesis? Does the student genuinely WRESTLE with opposing views or just collect them? Intellectual flexibility and honesty.",
        
        "Research & Source Integration":
            "Where does the student ask for sources, verify claims, fact-check, request evidence, or integrate research? Did the student verify AI claims or just accept them? Source evaluation and verification.",
        
        "Process Reflection Quality":
            "Where does the student reflect on their process, discuss what they learned, acknowledge AI limitations, or show metacognitive awareness? Look for self-awareness about their learning.",
        
        "Intellectual Growth & Position Evolution":
            "How does the student's position, thesis, or thinking change over the conversation? Did the student's thinking EVOLVE or did they just accept what AI told them? Evidence of genuine intellectual growth.",
        
        "Complete Documentation":
            "Evidence of complete conversation from start to finish, nothing appears edited or missing.",
        
        "Honesty & Attribution":
            "Where does the student acknowledge AI contributions, distinguish their ideas from AI's, or show transparency? Look for 'the AI suggested' or 'I combined my idea with AI's'.",
        
        "Coherence & Structure":
            "Discussion of essay structure, thesis development, organization, transitions, or argument flow. Did student direct this or delegate to AI?",
        
        "Depth & Insight":
            "Deep analysis, nuanced thinking, complex ideas, insights beyond surface level. Look for student's ORIGINAL insights vs. just repeating what AI said.",
        
        "Writing Quality":
            "Discussion of writing style, voice, tone, grammar, editing, or prose quality. Is the voice distinctly the student's or generic AI-speak?",
    }
    
    return query_map.get(
        criterion_name,
        f"Evidence related to: {criterion_name}"
    )


