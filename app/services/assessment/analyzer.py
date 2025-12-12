"""
Assessment Analyzer

The main engine that orchestrates the full assessment process:
1. Chunk and embed chat history
2. For each criterion, retrieve relevant chunks and assess
3. Generate summary assessment
4. Run authenticity checks
"""

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Callable

import orjson

from app.config import get_settings
from app.services.ollama import OllamaClient
from app.services.parsing import ParsedChatHistory, ParsedEssay
from app.services.rubric import RubricData, CriterionData
from app.services.rag.chunker import chunk_chat_history, ChatChunk
from app.services.rag.embeddings import embed_chunks
from app.services.rag.retriever import Retriever, format_retrieved_for_prompt
from app.services.assessment.prompts import (
    SYSTEM_PROMPT,
    create_criterion_prompt,
    create_summary_prompt,
    create_authenticity_prompt,
    create_query_for_criterion,
)

settings = get_settings()


@dataclass
class Evidence:
    """A piece of evidence supporting an assessment."""
    type: str  # chat_exchange, essay_section
    reference: str
    citation: str
    excerpt: str
    analysis: str
    
    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "reference": self.reference,
            "citation": self.citation,
            "excerpt": self.excerpt,
            "analysis": self.analysis,
        }


@dataclass
class CriterionAssessment:
    """Assessment result for a single criterion."""
    criterion_name: str
    criterion_id: str
    points_possible: int
    points_earned: float
    level: str  # exemplary, proficient, developing, inadequate
    reasoning: str
    evidence: list[Evidence]
    feedback: str
    confidence: str  # high, medium, low
    
    def to_dict(self) -> dict:
        return {
            "criterion_name": self.criterion_name,
            "criterion_id": self.criterion_id,
            "points_possible": self.points_possible,
            "points_earned": self.points_earned,
            "level": self.level,
            "reasoning": self.reasoning,
            "evidence": [e.to_dict() for e in self.evidence],
            "feedback": self.feedback,
            "confidence": self.confidence,
        }


@dataclass
class AuthenticityResult:
    """Result of authenticity analysis."""
    score: int  # 0-100
    confidence: str
    flags: list[dict]
    positive_indicators: list[str]
    overall_assessment: str
    
    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "confidence": self.confidence,
            "flags": self.flags,
            "positive_indicators": self.positive_indicators,
            "overall_assessment": self.overall_assessment,
        }


@dataclass  
class FullAssessment:
    """Complete assessment result for a submission."""
    submission_id: Optional[str]
    model_name: str
    timestamp: str
    
    # Scores
    criterion_assessments: list[CriterionAssessment]
    total_score: float
    total_possible: int
    
    # Summary
    summary_paragraphs: list[str]
    key_strengths: list[str]
    areas_for_growth: list[str]
    notable_observations: str
    overall_quality: str
    recommended_grade: str
    
    # Authenticity
    authenticity: Optional[AuthenticityResult] = None
    
    # Metadata
    processing_time_seconds: float = 0.0
    errors: list[str] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            "submission_id": self.submission_id,
            "model_name": self.model_name,
            "timestamp": self.timestamp,
            "total_score": self.total_score,
            "total_possible": self.total_possible,
            "percentage": round(self.total_score / self.total_possible * 100, 1) if self.total_possible > 0 else 0,
            "criterion_assessments": [ca.to_dict() for ca in self.criterion_assessments],
            "summary": {
                "paragraphs": self.summary_paragraphs,
                "key_strengths": self.key_strengths,
                "areas_for_growth": self.areas_for_growth,
                "notable_observations": self.notable_observations,
                "overall_quality": self.overall_quality,
                "recommended_grade": self.recommended_grade,
            },
            "authenticity": self.authenticity.to_dict() if self.authenticity else None,
            "processing_time_seconds": self.processing_time_seconds,
            "errors": self.errors,
        }


class AssessmentEngine:
    """
    Main engine for assessing student submissions.
    
    Usage:
        engine = AssessmentEngine(rubric)
        result = await engine.assess(chat_history, essay)
    """
    
    def __init__(
        self,
        rubric: RubricData,
        model: Optional[str] = None,
        embedding_model: Optional[str] = None,
        retrieval_top_k: int = 5,
        authenticity_mode: str = "conservative",
    ):
        self.rubric = rubric
        self.model = model or settings.default_analysis_model
        self.embedding_model = embedding_model or settings.default_embedding_model
        self.retrieval_top_k = retrieval_top_k
        self.authenticity_mode = authenticity_mode
        
        self._chunks: list[ChatChunk] = []
        self._retriever: Optional[Retriever] = None
    
    async def assess(
        self,
        chat_history: ParsedChatHistory,
        essay: ParsedEssay,
        assignment_context: Optional[str] = None,
        run_authenticity: bool = True,
        progress_callback: Optional[Callable[[str, int, int], None]] = None,
    ) -> FullAssessment:
        """
        Run full assessment on a submission.
        
        Args:
            chat_history: Parsed chat history
            essay: Parsed essay
            assignment_context: Optional assignment description
            run_authenticity: Whether to run authenticity checks
            progress_callback: Optional callback(step_name, current, total)
            
        Returns:
            FullAssessment with all results
        """
        start_time = datetime.now(timezone.utc)
        errors = []
        
        def report_progress(step: str, current: int, total: int):
            if progress_callback:
                progress_callback(step, current, total)
            print(f"  [{current}/{total}] {step}")
        
        # Count total steps
        criteria_count = sum(len(cat.criteria) for cat in self.rubric.categories)
        total_steps = criteria_count + 3  # +chunking, +summary, +authenticity
        current_step = 0
        
        # Step 1: Chunk and embed chat history
        report_progress("Chunking and embedding chat history", current_step, total_steps)
        current_step += 1
        
        try:
            self._chunks = chunk_chat_history(chat_history, context_window=1)
            self._chunks = await embed_chunks(
                self._chunks, 
                model=self.embedding_model,
                show_progress=False
            )
            self._retriever = Retriever(embedding_model=self.embedding_model)
            self._retriever.add_chunks(self._chunks)
        except Exception as e:
            errors.append(f"Embedding failed: {str(e)}")
            # Continue with empty retriever
            self._retriever = Retriever()
        
        # Step 2: Assess each criterion
        criterion_assessments = []
        
        for category in self.rubric.categories:
            for criterion in category.criteria:
                report_progress(f"Assessing: {criterion.name}", current_step, total_steps)
                current_step += 1
                
                try:
                    assessment = await self._assess_criterion(
                        criterion=criterion,
                        essay_text=essay.text,
                        assignment_context=assignment_context,
                    )
                    criterion_assessments.append(assessment)
                except Exception as e:
                    errors.append(f"Criterion '{criterion.name}' failed: {str(e)}")
                    # Create a placeholder with 0 score
                    criterion_assessments.append(CriterionAssessment(
                        criterion_name=criterion.name,
                        criterion_id=f"err_{criterion.name}",
                        points_possible=criterion.points,
                        points_earned=0,
                        level="inadequate",
                        reasoning=f"Assessment failed: {str(e)}",
                        evidence=[],
                        feedback="Unable to assess this criterion due to an error.",
                        confidence="low",
                    ))
        
        # Calculate totals
        total_score = sum(ca.points_earned for ca in criterion_assessments)
        total_possible = sum(ca.points_possible for ca in criterion_assessments)
        
        # Step 3: Generate summary
        report_progress("Generating summary assessment", current_step, total_steps)
        current_step += 1
        
        summary_result = await self._generate_summary(
            criterion_assessments=criterion_assessments,
            total_score=total_score,
            total_possible=total_possible,
            essay_preview=essay.text,
            assignment_context=assignment_context,
        )
        
        # Step 4: Authenticity check
        authenticity_result = None
        if run_authenticity:
            report_progress("Running authenticity analysis", current_step, total_steps)
            current_step += 1
            
            try:
                authenticity_result = await self._check_authenticity(
                    chat_history=chat_history,
                    essay_text=essay.text,
                )
            except Exception as e:
                errors.append(f"Authenticity check failed: {str(e)}")
        
        # Calculate processing time
        end_time = datetime.now(timezone.utc)
        processing_time = (end_time - start_time).total_seconds()
        
        return FullAssessment(
            submission_id=None,
            model_name=self.model,
            timestamp=start_time.isoformat(),
            criterion_assessments=criterion_assessments,
            total_score=total_score,
            total_possible=total_possible,
            summary_paragraphs=summary_result.get("summary_paragraphs", []),
            key_strengths=summary_result.get("key_strengths", []),
            areas_for_growth=summary_result.get("areas_for_growth", []),
            notable_observations=summary_result.get("notable_observations", ""),
            overall_quality=summary_result.get("overall_quality", "unknown"),
            recommended_grade=summary_result.get("recommended_grade", "N/A"),
            authenticity=authenticity_result,
            processing_time_seconds=processing_time,
            errors=errors,
        )
    
    async def _assess_criterion(
        self,
        criterion: CriterionData,
        essay_text: str,
        assignment_context: Optional[str],
    ) -> CriterionAssessment:
        """Assess a single criterion."""
        # Generate search query for this criterion
        query = create_query_for_criterion(criterion.name)
        
        # Retrieve relevant chunks
        if self._retriever:
            results = await self._retriever.search(
                query=query,
                top_k=self.retrieval_top_k,
                min_score=0.25,
            )
            retrieved_text = format_retrieved_for_prompt(results)
        else:
            retrieved_text = "No chat history available."
        
        # Create prompt
        prompt = create_criterion_prompt(
            criterion=criterion,
            retrieved_chunks=retrieved_text,
            essay_text=essay_text,
            assignment_context=assignment_context,
        )
        
        # Call LLM
        async with OllamaClient(timeout=120.0) as client:
            response = await client.generate(
                prompt=prompt,
                model=self.model,
                system=SYSTEM_PROMPT,
                format="json",
            )
        
        # Parse response
        response_text = response.get("response", "{}")
        result = self._parse_json_response(response_text)
        
        # Build assessment
        evidence = []
        for ev in result.get("evidence", []):
            evidence.append(Evidence(
                type=ev.get("type", "unknown"),
                reference=str(ev.get("reference", "")),
                citation=ev.get("citation", ""),
                excerpt=ev.get("excerpt", "")[:200],
                analysis=ev.get("analysis", ""),
            ))
        
        return CriterionAssessment(
            criterion_name=criterion.name,
            criterion_id=f"crit_{criterion.name.replace(' ', '_').lower()}",
            points_possible=criterion.points,
            points_earned=min(float(result.get("points_earned", 0)), criterion.points),
            level=result.get("level", "inadequate"),
            reasoning=result.get("reasoning", "No reasoning provided"),
            evidence=evidence,
            feedback=result.get("feedback", "No feedback provided"),
            confidence=result.get("confidence", "low"),
        )
    
    async def _generate_summary(
        self,
        criterion_assessments: list[CriterionAssessment],
        total_score: float,
        total_possible: int,
        essay_preview: str,
        assignment_context: Optional[str],
    ) -> dict:
        """Generate summary assessment."""
        # Format criterion results
        criterion_results = [ca.to_dict() for ca in criterion_assessments]
        
        prompt = create_summary_prompt(
            criterion_results=criterion_results,
            total_score=total_score,
            total_possible=total_possible,
            essay_preview=essay_preview,
            assignment_context=assignment_context,
        )
        
        async with OllamaClient(timeout=120.0) as client:
            response = await client.generate(
                prompt=prompt,
                model=self.model,
                system=SYSTEM_PROMPT,
                format="json",
            )
        
        response_text = response.get("response", "{}")
        return self._parse_json_response(response_text)
    
    async def _check_authenticity(
        self,
        chat_history: ParsedChatHistory,
        essay_text: str,
    ) -> AuthenticityResult:
        """Run authenticity checks."""
        # Calculate stats
        stats = {
            "total_exchanges": chat_history.total_exchanges,
            "time_span": "Unknown",  # Would need timestamps
            "avg_prompt_length": 0,
            "avg_response_length": 0,
        }
        
        if chat_history.exchanges:
            prompts = [ex.student_prompt for ex in chat_history.exchanges]
            responses = [ex.ai_response for ex in chat_history.exchanges]
            stats["avg_prompt_length"] = sum(len(p) for p in prompts) // len(prompts)
            stats["avg_response_length"] = sum(len(r) for r in responses) // len(responses)
        
        # Sample chat excerpts (first 3, middle 2, last 2)
        excerpts = []
        exchanges = chat_history.exchanges
        
        if exchanges:
            sample_indices = []
            if len(exchanges) >= 7:
                sample_indices = [0, 1, 2, len(exchanges)//2, len(exchanges)//2+1, -2, -1]
            else:
                sample_indices = list(range(len(exchanges)))
            
            for idx in sample_indices:
                if 0 <= idx < len(exchanges) or idx < 0:
                    ex = exchanges[idx]
                    excerpts.append(f"""
[CHAT:{ex.number}]
Student: {ex.student_prompt[:300]}{"..." if len(ex.student_prompt) > 300 else ""}
AI: {ex.ai_response[:300]}{"..." if len(ex.ai_response) > 300 else ""}
""")
        
        chat_excerpts = "\n".join(excerpts)
        
        prompt = create_authenticity_prompt(
            chat_history_stats=stats,
            chat_excerpts=chat_excerpts,
            essay_text=essay_text,
            mode=self.authenticity_mode,
        )
        
        async with OllamaClient(timeout=120.0) as client:
            response = await client.generate(
                prompt=prompt,
                model=self.model,
                system=SYSTEM_PROMPT,
                format="json",
            )
        
        response_text = response.get("response", "{}")
        result = self._parse_json_response(response_text)
        
        return AuthenticityResult(
            score=result.get("authenticity_score", 50),
            confidence=result.get("confidence", "low"),
            flags=result.get("flags", []),
            positive_indicators=result.get("positive_indicators", []),
            overall_assessment=result.get("overall_assessment", "Unable to assess"),
        )
    
    def _parse_json_response(self, text: str) -> dict:
        """Parse JSON from LLM response, handling common issues."""
        # Try direct parse
        try:
            return orjson.loads(text)
        except:
            pass
        
        # Try to extract JSON from markdown code block
        if "```json" in text:
            try:
                start = text.index("```json") + 7
                end = text.index("```", start)
                return orjson.loads(text[start:end])
            except:
                pass
        
        # Try to find JSON object
        try:
            start = text.index("{")
            end = text.rindex("}") + 1
            return orjson.loads(text[start:end])
        except:
            pass
        
        # Return empty dict if all else fails
        return {}


async def assess_submission(
    chat_history: ParsedChatHistory,
    essay: ParsedEssay,
    rubric: RubricData,
    assignment_context: Optional[str] = None,
    model: Optional[str] = None,
    run_authenticity: bool = True,
    authenticity_mode: str = "conservative",
    progress_callback: Optional[Callable[[str, int, int], None]] = None,
) -> FullAssessment:
    """
    Convenience function to assess a submission.
    
    Args:
        chat_history: Parsed chat history
        essay: Parsed essay
        rubric: Assessment rubric
        assignment_context: Optional assignment description
        model: LLM model to use
        run_authenticity: Whether to run authenticity checks
        authenticity_mode: "conservative" or "aggressive"
        progress_callback: Optional progress callback
        
    Returns:
        FullAssessment with complete results
    """
    engine = AssessmentEngine(
        rubric=rubric,
        model=model,
        authenticity_mode=authenticity_mode,
    )
    
    return await engine.assess(
        chat_history=chat_history,
        essay=essay,
        assignment_context=assignment_context,
        run_authenticity=run_authenticity,
        progress_callback=progress_callback,
    )




