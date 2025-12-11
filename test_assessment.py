"""
Test the full assessment pipeline on Sample1.

This script demonstrates the complete assessment workflow:
1. Parse essay and chat history
2. Chunk and embed chat history
3. Assess each criterion with RAG retrieval
4. Generate summary
5. Run authenticity check
"""

import asyncio
import sys
import json
from pathlib import Path
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))


async def main():
    print("=" * 70)
    print("PROCESS ANALYZER - Full Assessment Test")
    print("=" * 70)
    print()
    
    # Import modules
    from app.services.parsing import parse_chat_history, parse_essay
    from app.services.rubric import create_default_rubric
    from app.services.assessment import assess_submission
    from app.config import get_settings
    
    settings = get_settings()
    
    # Load sample data
    print("Loading sample data...")
    
    essay_path = Path("Samples/Sample 1.md")
    chat_path = Path("Samples/Sample1-chat history.json")
    
    if not essay_path.exists() or not chat_path.exists():
        print("ERROR: Sample files not found!")
        return
    
    # The essay is embedded in the Sample 1.md file
    essay_content = essay_path.read_text(encoding="utf-8")
    
    # Extract just the essay part (it's after "Essay" heading)
    essay_text = """I think that companies that develop AI will continue to hide information about there developments and agenda for their systems. These companies are driven by one thing...power. Whether it be money, control, influence, or image people are greedy as long as people are in control they will tailor there systems to bring nothing but rewards back to them. No matter what rules or laws are put in place they will dodge these loopholes just like the rich do in taxes to get themselves closer to more gain. People can believe in ethics and the common but what people say and do are two different things especially when it comes to people in power...the people who control the development of their systems. Even if we put people in line to check them whos to say they aren't bought or paid off like other government official who already are. There is so much room for error and advantage i do not think its possible for it to stay ethical. The big reason why AI won't take over the world is because these companies need a world to take advantage of so they will make sure it develops to only help them. Maybe at some point it might go far but I won't wipe us out in a Terminator or Age of Ultron manor."""
    
    chat_content = chat_path.read_text(encoding="utf-8")
    
    print(f"  Essay length: {len(essay_text)} characters")
    print(f"  Chat history: {len(chat_content)} characters")
    
    # Parse files
    print("\nParsing files...")
    
    # Create a simple ParsedEssay-like object
    from dataclasses import dataclass
    
    @dataclass
    class SimpleEssay:
        text: str
        word_count: int
        
    essay = SimpleEssay(
        text=essay_text,
        word_count=len(essay_text.split())
    )
    
    chat_history = parse_chat_history(chat_content, "Sample1-chat history.json")
    
    print(f"  Essay words: {essay.word_count}")
    print(f"  Chat exchanges: {chat_history.total_exchanges}")
    print(f"  Chat format: {chat_history.format_detected.value}")
    
    # Load rubric
    print("\nLoading rubric...")
    rubric = create_default_rubric()
    print(f"  Rubric: {rubric.name}")
    print(f"  Total points: {rubric.total_points}")
    
    # Assignment context
    assignment_context = """Essay question: Will AI destroy humanity or will it assist us in a bold new future of abundance and prosperity? (600 words)

Requirements:
- Start with your own words and thoughts in the initial prompt
- Use AI to refine your thoughts and state what you mean more clearly
- Ask the model to give you all the counter points to your position
- Address those points or change your position
- Submit your final essay along with the complete chat history"""

    # Select model - use a smaller one for testing
    model = "ministral-3:latest"  # Faster for testing
    # model = settings.default_analysis_model  # Full quality
    
    print(f"\nUsing model: {model}")
    print("\n" + "=" * 70)
    print("Starting Assessment (this may take several minutes)...")
    print("=" * 70 + "\n")
    
    start_time = datetime.now()
    
    try:
        result = await assess_submission(
            chat_history=chat_history,
            essay=essay,
            rubric=rubric,
            assignment_context=assignment_context,
            model=model,
            run_authenticity=True,
            authenticity_mode="conservative",
        )
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        print("\n" + "=" * 70)
        print("ASSESSMENT COMPLETE")
        print("=" * 70)
        
        # Display results
        print(f"\n[OVERALL SCORE]")
        print(f"  {result.total_score}/{result.total_possible} ({result.total_score/result.total_possible*100:.1f}%)")
        print(f"  Recommended Grade: {result.recommended_grade}")
        print(f"  Overall Quality: {result.overall_quality}")
        
        print(f"\n[CRITERION SCORES]")
        for ca in result.criterion_assessments:
            level_icon = {
                "exemplary": "[E]",
                "proficient": "[P]", 
                "developing": "[D]",
                "inadequate": "[I]"
            }.get(ca.level, "[?]")
            
            print(f"  {level_icon} {ca.criterion_name}: {ca.points_earned}/{ca.points_possible}")
            print(f"      {ca.reasoning[:100]}...")
            if ca.evidence:
                print(f"      Evidence: {ca.evidence[0].citation}")
        
        print(f"\n[KEY STRENGTHS]")
        for strength in result.key_strengths:
            print(f"  + {strength}")
        
        print(f"\n[AREAS FOR GROWTH]")
        for area in result.areas_for_growth:
            print(f"  - {area}")
        
        if result.authenticity:
            print(f"\n[AUTHENTICITY]")
            print(f"  Score: {result.authenticity.score}/100")
            print(f"  Confidence: {result.authenticity.confidence}")
            if result.authenticity.flags:
                print(f"  Flags: {len(result.authenticity.flags)}")
                for flag in result.authenticity.flags[:3]:
                    print(f"    [{flag.get('severity', '?')}] {flag.get('description', 'Unknown')[:60]}...")
        
        print(f"\n[SUMMARY]")
        for para in result.summary_paragraphs:
            print(f"  {para[:200]}...")
            print()
        
        print(f"\n[METADATA]")
        print(f"  Model: {result.model_name}")
        print(f"  Processing time: {duration:.1f} seconds")
        if result.errors:
            print(f"  Errors: {len(result.errors)}")
            for err in result.errors:
                print(f"    - {err}")
        
        # Save full results to file
        output_path = Path("test_assessment_result.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result.to_dict(), f, indent=2)
        print(f"\n  Full results saved to: {output_path}")
        
    except Exception as e:
        print(f"\nERROR: Assessment failed!")
        print(f"  {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(main())


