# ProcessPulse

**AI-Assisted Writing Process Analyzer**

Evaluating thinking, not just writing. 80% process, 20% product.

## Vision

ProcessPulse is a tool for educators to assess student writing by analyzing both the final essay AND the complete AI collaboration history. Instead of asking "Did you use AI?", we ask "How did you use AI?"

### Core Philosophy

- **Expect AI use** - Students will use AI; design for transparency
- **80/20 Assessment** - 80% of the grade comes from the thinking process, 20% from the final product
- **Make thinking visible** - Require complete chat histories to see how students develop ideas

## Current Status

### Backend (FastAPI + Python)

- [x] Project structure and configuration
- [x] SQLite database (PostgreSQL-compatible schema)
- [x] Chat history parsers (LM Studio JSON, plain text)
- [x] Essay parsers (TXT, DOCX, PDF, Markdown)
- [x] Rubric system with 11 criteria across 4 categories
- [x] Ollama integration for local LLMs
- [x] RAG pipeline (chunking, embeddings, retrieval)
- [x] Assessment prompts and engine
- [x] REST API endpoints

### Frontend (React + TailwindCSS)

- [x] Basic UI with file upload
- [x] Status bar with system health
- [x] Assessment results display
- [x] Chat history viewer
- [ ] Full writing interface (Phase 2)

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Ollama running locally with models:
  - Analysis: `qwen3:32b` (or similar)
  - Embeddings: `bge-m3`

### Backend Setup

```bash
cd Process-Analyzer
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate   # Linux/Mac

pip install -r requirements.txt
python run.py
```

Backend runs at http://localhost:8000

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5174

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/status` | GET | Full system status |
| `/api/models` | GET | List available Ollama models |
| `/api/upload/essay` | POST | Upload and parse essay |
| `/api/upload/chat-history` | POST | Upload and parse chat history |
| `/api/rubric` | GET | Get assessment rubric |

## Assessment Rubric

| Category | Weight | Criteria |
|----------|--------|----------|
| AI Collaboration Process | 50% | Initial Engagement, Iterative Refinement, Critical Evaluation, Synthesis & Integration |
| Metacognitive Awareness | 20% | Self-Reflection, Learning Transfer |
| Transparency & Integrity | 10% | Process Documentation, Ethical Use |
| Final Essay Quality | 20% | Content & Argumentation, Organization, Language & Style |

## Roadmap

### Phase 1: Assessment Tool (Current)
- Analyze submitted essays + chat histories
- Generate detailed assessments with evidence

### Phase 2: Writing Interface
- Built-in editor with AI assistance
- Real-time process capture
- Support for local AI + commercial APIs (OpenAI, Claude)
- Student "bring your own key" option

### Phase 3: Institutional Features
- Batch assessment
- Instructor dashboard
- LMS integration
- Research analytics

## License

MIT

## Contributing

This project is in active development. Issues and PRs welcome.

