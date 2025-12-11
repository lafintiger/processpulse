"""
Run the Process Analyzer application.

Usage:
    python run.py
    
Or with uvicorn directly:
    uvicorn app.api.main:app --reload
"""

import uvicorn
from app.config import get_settings

settings = get_settings()


def main():
    """Start the FastAPI server."""
    print("""
============================================================
               PROCESS ANALYZER
      AI-Assisted Writing Process Analyzer
============================================================""")
    print(f"  Starting server at: http://{settings.host}:{settings.port}")
    print(f"  API Docs at: http://{settings.host}:{settings.port}/docs")
    print(f"  Debug mode: {settings.debug}")
    print("============================================================\n")
    
    uvicorn.run(
        "app.api.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )


if __name__ == "__main__":
    main()
