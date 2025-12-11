"""
Test script to verify the setup is working correctly.

Run this before starting the server to check:
- Module imports
- Configuration loading
- Database connectivity
- Ollama connectivity
- File parsing
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))


def test_imports():
    """Test that all modules import correctly."""
    print("Testing imports...")
    
    try:
        from app.config import get_settings
        print("  [OK] Config module")
    except ImportError as e:
        print(f"  [FAIL] Config module: {e}")
        return False
    
    try:
        from app.db.models import Base, Rubric, Submission, Assessment
        print("  [OK] Database models")
    except ImportError as e:
        print(f"  [FAIL] Database models: {e}")
        return False
    
    try:
        from app.services.parsing import parse_chat_history, parse_essay
        print("  [OK] Parsing services")
    except ImportError as e:
        print(f"  [FAIL] Parsing services: {e}")
        return False
    
    try:
        from app.services.rubric import create_default_rubric
        print("  [OK] Rubric services")
    except ImportError as e:
        print(f"  [FAIL] Rubric services: {e}")
        return False
    
    try:
        from app.services.ollama import check_ollama_connection
        print("  [OK] Ollama services")
    except ImportError as e:
        print(f"  [FAIL] Ollama services: {e}")
        return False
    
    try:
        from app.api.main import app
        print("  [OK] FastAPI application")
    except ImportError as e:
        print(f"  [FAIL] FastAPI application: {e}")
        return False
    
    return True


def test_config():
    """Test configuration loading."""
    print("\nTesting configuration...")
    
    from app.config import get_settings
    settings = get_settings()
    
    print(f"  App name: {settings.app_name}")
    print(f"  Version: {settings.app_version}")
    print(f"  Database: {settings.database_url.split('///')[0]}///***")
    print(f"  Ollama URL: {settings.ollama_base_url}")
    print(f"  Default analysis model: {settings.default_analysis_model}")
    print(f"  Default embedding model: {settings.default_embedding_model}")
    
    return True


def test_rubric():
    """Test rubric loading."""
    print("\nTesting rubric...")
    
    from app.services.rubric import create_default_rubric
    
    rubric = create_default_rubric()
    
    print(f"  Name: {rubric.name}")
    print(f"  Total points: {rubric.total_points}")
    print(f"  Categories: {len(rubric.categories)}")
    
    for cat in rubric.categories:
        print(f"    - {cat.name}: {cat.weight} points ({len(cat.criteria)} criteria)")
    
    return True


def test_chat_parsing():
    """Test chat history parsing with sample data."""
    print("\nTesting chat parsing...")
    
    from app.services.parsing import parse_chat_history
    
    # Test plain text parsing
    sample_text = """User: What is AI?

AI: AI stands for Artificial Intelligence. It refers to computer systems designed to perform tasks that typically require human intelligence.

User: Can you give me an example?

AI: Sure! A common example is virtual assistants like Siri or Alexa, which use AI to understand speech and respond to questions."""
    
    result = parse_chat_history(sample_text)
    print(f"  Format detected: {result.format_detected.value}")
    print(f"  Exchanges found: {result.total_exchanges}")
    
    if result.total_exchanges >= 2:
        print("  [OK] Plain text parsing works")
    else:
        print("  [FAIL] Plain text parsing failed")
        return False
    
    # Test with sample file if available
    sample_path = Path("Samples/Sample1-chat history.json")
    if sample_path.exists():
        print(f"\n  Testing with: {sample_path}")
        content = sample_path.read_text(encoding="utf-8")
        result = parse_chat_history(content, sample_path.name)
        print(f"  Format detected: {result.format_detected.value}")
        print(f"  Exchanges found: {result.total_exchanges}")
        if result.exchanges:
            prompt_preview = result.exchanges[0].student_prompt[:100]
            print(f"  First prompt preview: {prompt_preview}...")
    
    return True


async def test_ollama():
    """Test Ollama connectivity."""
    print("\nTesting Ollama connection...")
    
    from app.services.ollama import check_ollama_connection, list_available_models
    
    status = await check_ollama_connection()
    
    if status.get("connected"):
        print(f"  [OK] Connected to Ollama")
        print(f"  Models available: {status.get('model_count', 0)}")
        
        # List some models
        models = await list_available_models()
        print("\n  Available models:")
        for model in models[:10]:  # Show first 10
            print(f"    - {model.name} ({model.size_human})")
        if len(models) > 10:
            print(f"    ... and {len(models) - 10} more")
    else:
        print(f"  [WARN] Not connected: {status.get('message')}")
        print("  (This is okay if Ollama isn't running yet)")
    
    return True


async def test_database():
    """Test database initialization."""
    print("\nTesting database...")
    
    from app.db.database import init_db, engine
    from app.config import get_settings
    
    settings = get_settings()
    settings.ensure_directories()
    
    try:
        await init_db()
        print("  [OK] Database initialized")
        return True
    except Exception as e:
        print(f"  [FAIL] Database error: {e}")
        return False


async def main():
    """Run all tests."""
    print("=" * 60)
    print("PROCESS ANALYZER - Setup Verification")
    print("=" * 60)
    
    all_passed = True
    
    # Synchronous tests
    if not test_imports():
        all_passed = False
    
    if not test_config():
        all_passed = False
    
    if not test_rubric():
        all_passed = False
    
    if not test_chat_parsing():
        all_passed = False
    
    # Async tests
    if not await test_database():
        all_passed = False
    
    if not await test_ollama():
        # Ollama not required for basic functionality
        pass
    
    print("\n" + "=" * 60)
    if all_passed:
        print("[SUCCESS] All tests passed! Ready to run the application.")
        print("\nNext steps:")
        print("  1. Make sure Ollama is running: ollama serve")
        print("  2. Start the server: python run.py")
        print("  3. Open http://localhost:8000/docs for API documentation")
    else:
        print("[FAILED] Some tests failed. Please check the errors above.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
