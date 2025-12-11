# ProcessPulse

**AI-Assisted Writing Process Analyzer**

> Evaluating thinking, not just writing. 80% process, 20% product.

[![License: Polyform Noncommercial](https://img.shields.io/badge/License-Polyform%20NC-blue.svg)](LICENSE)

> **Free for educators, students, and non-commercial use.** Commercial use requires a separate license.

---

## Overview

ProcessPulse is a tool for educators to assess student writing by analyzing both the **final essay** AND the **complete AI collaboration history**. Instead of asking "Did you use AI?", we ask "How did you use AI?"

### Core Philosophy

- **Expect AI use** — Students will use AI; design for transparency, not prohibition
- **80/20 Assessment** — 80% of the grade evaluates the thinking process, 20% the final product
- **Make thinking visible** — Require complete chat histories to see how students develop ideas

### Two Modes

1. **Writer Mode** (for Students) — AI-assisted writing environment with full process capture
2. **Analyzer Mode** (for Educators) — Assess submitted essays + chat histories against an 11-criterion rubric

---

## Features

### Analyzer (Assessment Tool)
- Upload essays (TXT, DOCX, PDF, Markdown)
- Upload AI chat histories (ChatGPT, LM Studio, plain text)
- 11-criterion rubric across 4 categories
- Evidence-based scoring with citations
- Multiple model validation ("Three Judges")
- Authenticity flags (suspicious patterns)
- Export assessment reports

### Writer (Writing Interface) ✅ PROTOTYPE READY
- Rich text editor (TipTap) with formatting toolbar
- AI chat sidebar with streaming responses
- Inline editing with Cmd/Ctrl+K
- **Right-click context menu** → Edit with AI, Copy, Cut
- **Find & Replace** (Ctrl+F, Ctrl+H)
- **Insert links** via toolbar
- **Web Search (Perplexica)** — AI-powered research with sources
- **Export options** — DOCX, TXT, HTML, JSON (for assessment)
- **Browser spell check** — Built-in spell checking
- **Keyboard shortcuts help** — Press Ctrl+/ for full list
- **Welcome onboarding** — First-time user tutorial
- **Auto-save indicator** — Shows when saved with timestamp
- Support for local AI (Ollama) or commercial APIs (OpenAI, Claude)
- "Bring your own API key" for students
- Automatic process capture for assessment
- Event timestamps (Unix ms) for every action

### Academic Integrity Tracking ✅
- **Paste detection** — Tracks characters pasted from clipboard
- **Copy tracking** — Detects text copied out (potential external AI use)
- **Focus monitoring** — Tracks when user leaves the app
- **Session metrics** — Typed vs pasted ratio, AI acceptance rate
- **Backend storage** — All sessions saved with full event history

---

## Quick Start

### Option 1: Docker (Recommended for Institutions) 🐳

One command to deploy everything:

```bash
# Clone
git clone https://github.com/lafintiger/processpulse.git
cd processpulse

# Configure (optional)
cp env.example .env

# Launch
docker-compose up -d

# Access at http://localhost
```

**First run downloads AI models automatically (~7.5 GB total).**

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed Docker instructions.

### Option 2: Local Development

#### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **Ollama** running locally with models:
  - Analysis: `gpt-oss:latest` or `qwen3:32b`
  - Embeddings: `bge-m3`
- **Perplexica** (optional) for web search

#### Installation

```bash
# Clone the repository
git clone https://github.com/lafintiger/processpulse.git
cd processpulse

# Backend setup
python -m venv venv
.\venv\Scripts\Activate.ps1   # Windows PowerShell
# source venv/bin/activate    # Linux/macOS

pip install -r requirements.txt

# Frontend setup
cd frontend
npm install
cd ..
```

#### Running

**Terminal 1 - Backend:**
```bash
.\venv\Scripts\Activate.ps1
python run.py
# API runs at http://localhost:8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# UI runs at http://localhost:5173 (or next available port)
```

**Verify Ollama is running:**
```bash
curl http://localhost:11434/api/tags
```

---

## Project Structure

```
Process-Analyzer/
├── app/                      # Python backend (FastAPI)
│   ├── api/                  # REST endpoints
│   │   └── routes/          # health, models, upload, rubric, assessment
│   ├── db/                   # Database (SQLite + SQLAlchemy)
│   └── services/             # Business logic
│       ├── parsing/          # Essay & chat history parsers
│       ├── ollama/           # Ollama API client
│       ├── rag/              # Chunking, embeddings, retrieval
│       ├── rubric/           # Rubric loader
│       └── assessment/       # Assessment pipeline & prompts
│
├── frontend/                 # React + Vite + TailwindCSS
│   └── src/
│       ├── components/       # UI components
│       │   └── writer/       # Writing interface components
│       ├── lib/              # AI provider abstraction
│       └── stores/           # Zustand state management
│
├── RubricDocs/               # Assessment rubric documentation
├── Samples/                  # Sample submissions for testing
├── data/                     # SQLite database & vector storage
└── requirements.txt          # Python dependencies
```

---

## API Reference

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Simple health check |
| `/api/status` | GET | Full system status (Ollama, models, database) |

### Models

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/models` | GET | List available Ollama models |

### Upload & Parse

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload/essay` | POST | Upload and parse essay file |
| `/api/upload/chat-history` | POST | Upload and parse chat history |

### Assessment

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rubric` | GET | Get assessment rubric structure |

### Writing Sessions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions/save` | POST | Save/update writing session |
| `/api/sessions/list` | GET | List all saved sessions |
| `/api/sessions/{id}` | GET | Get full session details |
| `/api/sessions/{id}/export` | POST | Export for assessment |

### Perplexica (Web Search Proxy)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/perplexica/status` | GET | Check if Perplexica is available |
| `/api/perplexica/providers` | GET | Get available models |
| `/api/perplexica/search` | POST | Perform AI-powered web search |

---

## Assessment Rubric

### Categories & Weights

| Category | Weight | Description |
|----------|--------|-------------|
| AI Collaboration Process | 50% | How student engaged with AI |
| Metacognitive Awareness | 20% | Reflection on learning |
| Transparency & Integrity | 10% | Honest documentation |
| Final Essay Quality | 20% | The actual writing |

### Criteria (11 total)

**AI Collaboration Process (50 points)**
- Initial Engagement (15) — Quality of first prompts
- Iterative Refinement (15) — Building on AI responses
- Critical Evaluation (10) — Questioning AI outputs
- Synthesis & Integration (10) — Combining ideas effectively

**Metacognitive Awareness (20 points)**
- Self-Reflection (10) — Understanding own learning
- Learning Transfer (10) — Applying insights

**Transparency & Integrity (10 points)**
- Process Documentation (5) — Clear history
- Ethical Use (5) — Honest collaboration

**Final Essay Quality (20 points)**
- Content & Argumentation (8) — Substance
- Organization (6) — Structure
- Language & Style (6) — Polish

### Scoring Levels

| Level | Range | Description |
|-------|-------|-------------|
| Exemplary | 90-100% | Exceeds expectations |
| Proficient | 70-89% | Meets expectations |
| Developing | 50-69% | Approaching expectations |
| Inadequate | 0-49% | Below expectations |

---

## Supported Formats

### Essays
- Plain text (`.txt`)
- Markdown (`.md`)
- Microsoft Word (`.docx`)
- PDF (`.pdf`)

### Chat Histories
- **ChatGPT JSON** — Export from conversations.json
- **LM Studio JSON** — Local model chat exports
- **Plain Text/Markdown** — Copy-pasted conversations

---

## Configuration

### Environment Variables

Create `.env` from `env.example.txt`:

```env
# Database
DATABASE_URL=sqlite+aiosqlite:///./data/process_analyzer.db

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# Models
DEFAULT_ANALYSIS_MODEL=gpt-oss:latest
DEFAULT_EMBEDDING_MODEL=bge-m3

# Debug
DEBUG=true
```

### Recommended Models

**For Assessment:**
- `gpt-oss:latest` (12.8GB) — Good balance of quality/speed
- `qwen3:32b` (19GB) — Best reasoning capability
- `gemma3:27b` (17GB) — Good instruction following

**For Embeddings:**
- `bge-m3` (1.2GB) — Excellent multilingual embeddings

---

## Development

### Tech Stack

**Backend:**
- FastAPI — Async Python web framework
- SQLAlchemy — ORM with async support
- SQLite — Database (PostgreSQL-ready schema)
- Ollama — Local LLM inference

**Frontend:**
- React 19 — UI framework
- Vite 7 — Build tool
- TailwindCSS v4 — Styling
- TipTap — Rich text editor
- Zustand — State management

### Running Tests

```bash
# Test backend setup
python test_setup.py

# Test assessment pipeline
python test_assessment.py
```

### Code Style

- Python: Follow PEP 8
- TypeScript: ESLint + Prettier
- Commits: Conventional commits preferred

---

## Roadmap

### Phase 1: Assessment Tool ✅
- [x] Upload essays and chat histories
- [x] Parse multiple file formats
- [x] RAG pipeline for long conversations
- [x] Assessment with evidence citations
- [x] Basic UI

### Phase 2: Writing Interface ✅ COMPLETE
- [x] TipTap rich text editor
- [x] AI provider abstraction
- [x] Chat sidebar with streaming
- [x] Inline editing (Cmd+K)
- [x] Right-click context menu
- [x] Find & Replace (Ctrl+F/H)
- [x] Link insertion
- [x] **Perplexica Web Search** — AI-powered research with sources
- [x] Paste/copy/focus tracking
- [x] Session metrics
- [x] Backend session storage
- [x] Process capture export
- [x] Export to DOCX/TXT/HTML
- [x] Browser spell check
- [x] Keyboard shortcuts help (Ctrl+/)
- [x] Welcome onboarding modal
- [x] Auto-save indicator
- [x] Error boundary (crash recovery)
- [ ] Export to PDF

### Phase 2.5: Docker Deployment ✅ COMPLETE
- [x] Backend Dockerfile (FastAPI, multi-stage build)
- [x] Frontend Dockerfile (React + nginx)
- [x] docker-compose.yml with all services
- [x] Auto model download on first run
- [x] Perplexica + SearXNG integration
- [x] Configuration via .env file
- [x] GPU support option
- [x] External Ollama support
- [x] Detailed deployment documentation

### Phase 3: Institutional Features 📋
- [ ] Batch assessment
- [ ] Instructor dashboard
- [ ] Class analytics
- [ ] LMS integration
- [ ] Multi-instructor support

### Phase 4: Scale & Polish 📋
- [ ] PostgreSQL migration
- [ ] Cloud deployment option
- [ ] Student portal
- [ ] Research analytics

---

## Philosophy & Background

See `RubricDocs/AI and Writing Assignments - The New Paradigm.md` for the complete educational philosophy behind ProcessPulse.

Key principles:
1. **AI is a tool, not a threat** — Students will use AI; teach them to use it well
2. **Process reveals understanding** — Chat histories show how students think
3. **Iteration is learning** — Multiple drafts and refinements demonstrate growth
4. **Transparency builds trust** — Complete histories prevent "gaming the system"
5. **Instructors remain essential** — AI assists assessment; humans decide

---

## Contributing

This project is in active development. Issues and PRs welcome!

### Areas Needing Help
- Testing with different chat export formats
- Prompt engineering for better assessments
- UI/UX improvements
- Documentation

---

## License

**Polyform Noncommercial 1.0.0** — See [LICENSE](LICENSE) for details.

| Use Case | Allowed |
|----------|---------|
| Educators & Students | ✅ Free |
| Educational Institutions | ✅ Free |
| Personal/Hobby Use | ✅ Free |
| Non-profit Organizations | ✅ Free |
| Commercial Use | ❌ Contact for license |

---

## Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Editor powered by [TipTap](https://tiptap.dev/)
- Local AI via [Ollama](https://ollama.ai/)
- Styled with [TailwindCSS](https://tailwindcss.com/)

---

## Support

- **Issues:** [GitHub Issues](https://github.com/lafintiger/processpulse/issues)
- **Discussions:** [GitHub Discussions](https://github.com/lafintiger/processpulse/discussions)

---

*ProcessPulse — Making student thinking visible in the age of AI.*
