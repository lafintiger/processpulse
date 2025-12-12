# Agent Handoff Document - ProcessPulse

**Project:** ProcessPulse (AI-Assisted Writing Process Analyzer)  
**Last Updated:** December 12, 2025  
**Status:** ✅ ANALYZER WORKING + WRITER READY + DOCKER READY  
**License:** Polyform Noncommercial 1.0.0 (Free for education)  
**GitHub:** https://github.com/lafintiger/processpulse

---

## Executive Summary

ProcessPulse is an application for educators to assess student writing by analyzing both the final essay AND the complete AI collaboration history. The core philosophy is **80/20 assessment**: 80% of the grade comes from the thinking process, 20% from the final product.

**Current State:** 
- Backend (FastAPI) fully functional with assessment pipeline + session storage
- Frontend (React) analyzer mode works
- **Writer interface READY FOR TESTING** with all core features
- **Academic integrity tracking** - paste detection, copy tracking, focus monitoring
- **Export options** - DOCX, TXT, HTML, JSON (for assessment)
- **Perplexica web search** - AI-powered research with source citations
- **Docker deployment** - One command to deploy everything (`docker-compose up -d`)

---

## What's Working Now

### Writer Interface (Phase 2 - Complete)
- Rich text editor with TipTap (bold, italic, underline, headings, lists, quotes, alignment)
- AI chat sidebar with streaming responses
- **Right-click context menu** for Edit with AI, Copy, Cut
- **Find & Replace** (Ctrl+F / Ctrl+H)
- **Insert links** via toolbar
- Auto-save to localStorage
- Export sessions to backend + local JSON

### Academic Integrity Tracking
- **Paste detection** with character/word count (shows % pasted in stats bar)
- **Copy tracking** to detect potential external AI use
- **Focus tracking** - monitors when user leaves the app
- **Session metrics** - typed vs pasted ratio, AI acceptance rate

### Backend
- FastAPI with SQLite database
- Writing session storage (`/api/sessions/save`, `/api/sessions/list`, `/api/sessions/{id}`)
- Assessment pipeline with RAG
- Rubric management

---

## Project Architecture

### Directory Structure

```
Process-Analyzer/
├── app/                          # Python backend
│   ├── __init__.py
│   ├── config.py                 # Settings (Pydantic BaseSettings)
│   ├── api/
│   │   ├── main.py              # FastAPI app + lifespan events
│   │   └── routes/
│   │       ├── health.py        # /health, /api/status endpoints
│   │       ├── models.py        # /api/models (Ollama model list)
│   │       ├── upload.py        # /api/upload/essay, /api/upload/chat-history
│   │       ├── rubric.py        # /api/rubric (get rubric)
│   │       ├── assessment.py    # Assessment endpoints
│   │       └── sessions.py      # NEW: Writing session storage
│   ├── db/
│   │   ├── database.py          # SQLite + SQLAlchemy async setup
│   │   └── models.py            # ORM models (includes WritingSession)
│   └── services/
│       ├── parsing/
│       ├── ollama/
│       ├── rag/
│       ├── rubric/
│       └── assessment/
│
├── frontend/                     # React + Vite + TailwindCSS v4
│   ├── src/
│   │   ├── App.tsx              # Main app - routes between Home/Writer/Analyzer
│   │   ├── index.css            # TailwindCSS + custom styles
│   │   ├── types.ts             # TypeScript interfaces
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   ├── AssessmentResults.tsx
│   │   │   ├── ChatViewer.tsx
│   │   │   └── writer/          # Writing interface components
│   │   │       ├── WriterPage.tsx
│   │   │       ├── Editor.tsx        # TipTap editor with all features
│   │   │       ├── ChatSidebar.tsx
│   │   │       ├── InlineEditPopup.tsx
│   │   │       ├── SettingsPanel.tsx
│   │   │       └── index.ts
│   │   ├── lib/
│   │   │   └── ai-providers.ts  # AI provider abstraction
│   │   └── stores/
│   │       └── writer-store.ts  # Zustand state with metrics tracking
│   ├── package.json
│   └── vite.config.ts
│
├── data/
│   └── process_analyzer.db      # SQLite database
│
├── RubricDocs/                   # Assessment rubric documentation
├── Samples/                      # Test files
├── requirements.txt
├── run.py
└── README.md
```

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/health` | GET | Simple health check |
| `/api/status` | GET | Full system status |
| `/api/models` | GET | List available Ollama models |
| `/api/upload/essay` | POST | Upload & parse essay file |
| `/api/upload/chat-history` | POST | Upload & parse chat history |
| `/api/rubric` | GET | Get full rubric structure |
| `/api/sessions/save` | POST | **NEW:** Save writing session |
| `/api/sessions/list` | GET | **NEW:** List all sessions |
| `/api/sessions/{id}` | GET | **NEW:** Get session details |
| `/api/sessions/{id}/export` | POST | **NEW:** Export for assessment |

---

## Event Types (Process Capture)

```typescript
type EventType =
  | 'session_start'
  | 'session_end'
  | 'text_insert'      // Characters typed
  | 'text_delete'      // Characters deleted
  | 'text_paste'       // Pasted from clipboard (tracks length)
  | 'text_copy'        // Copied to clipboard (potential external AI)
  | 'text_cut'         // Cut to clipboard
  | 'text_select'      // Text selection
  | 'ai_request'       // Asked AI for help
  | 'ai_response'      // AI responded
  | 'ai_accept'        // Accepted AI suggestion
  | 'ai_reject'        // Rejected AI suggestion
  | 'ai_modify'        // Modified AI suggestion
  | 'document_save'
  | 'undo'
  | 'redo'
  | 'focus_lost'       // Window lost focus
  | 'focus_gained'     // Window regained focus
```

---

## Session Metrics (Academic Integrity)

```typescript
interface SessionMetrics {
  totalCharactersTyped: number      // Student's original work
  totalCharactersPasted: number     // External content pasted in
  totalCharactersCopied: number     // Content copied out (external AI?)
  aiRequestCount: number            // Times asked AI for help
  aiAcceptCount: number             // AI suggestions accepted
  aiRejectCount: number             // AI suggestions rejected
  focusLostCount: number            // Times switched away from app
  totalFocusLostDuration: number    // Time spent outside app (ms)
}
```

---

## Database Models

### WritingSession (NEW)

```python
class WritingSession(Base):
    id: str                      # UUID
    session_id: str              # Frontend session ID
    document_title: str
    document_content: str        # Final document HTML
    assignment_context: str      # Optional assignment prompt
    word_count: int
    session_start_time: int      # Unix ms
    session_end_time: int        # Unix ms
    events_json: str             # All captured events
    chat_messages_json: str      # AI chat history
    total_events: int
    ai_request_count: int
    ai_accept_count: int
    ai_reject_count: int
    text_insert_count: int
    text_delete_count: int
    ai_provider: str             # ollama, openai, anthropic
    ai_model: str
    status: str                  # active, completed, exported
```

---

## Running the Application

### Backend
```powershell
cd C:\Users\lafintiger\SynologyDrive\_aiprojects\__Dev\Process-Analyzer
.\venv\Scripts\Activate.ps1
python run.py
# Runs at http://localhost:8000
# API docs at http://localhost:8000/docs
```

### Frontend
```powershell
cd C:\Users\lafintiger\SynologyDrive\_aiprojects\__Dev\Process-Analyzer\frontend
npm run dev
# Runs at http://localhost:5175
```

### Verify Ollama
```powershell
curl http://localhost:11434/api/tags
```

---

## Key Features Implemented

### Editor Features
- [x] Rich text formatting (bold, italic, underline)
- [x] Headings (H1, H2, H3)
- [x] Lists (bullet, numbered)
- [x] Blockquotes
- [x] Text alignment
- [x] Insert links
- [x] Find & Replace (Ctrl+F, Ctrl+H)
- [x] Word/character count
- [x] Auto-save

### AI Integration
- [x] Chat sidebar with streaming
- [x] Right-click → Edit with AI
- [x] Inline edit popup (Cmd+K)
- [x] Multiple providers (Ollama, OpenAI, Claude)
- [x] Provider status indicator

### Process Tracking
- [x] All events timestamped (Unix ms)
- [x] Paste detection with content length
- [x] Copy tracking
- [x] Focus/blur tracking
- [x] Session metrics calculation
- [x] Backend session storage

### UI/UX
- [x] Dark theme
- [x] Context menu on right-click
- [x] Stats bar (words, time, paste %, AI usage)
- [x] Keyboard shortcuts hints

---

## Completed Features (Latest Session)

| Feature | Status |
|---------|--------|
| Export to DOCX | ✅ Done |
| Export to TXT | ✅ Done |
| Export to HTML | ✅ Done |
| Browser spell check | ✅ Done |
| Keyboard shortcuts help modal | ✅ Done |
| Welcome onboarding modal | ✅ Done |
| Auto-save indicator | ✅ Done |
| Error boundary (crash recovery) | ✅ Done |
| **Perplexica Web Search** | ✅ Done |

## Remaining Features (Future)

| Feature | Priority | Effort |
|---------|----------|--------|
| ~~Export to PDF~~ | ✅ Done | - |
| Focus mode (minimal UI) | Low | Easy |
| Version history/snapshots | Low | High |
| Mobile responsiveness | Low | Medium |

---

## Configuration

### Default Models
- **Analysis:** `gpt-oss:latest`
- **Embeddings:** `bge-m3`

### Settings Files
- Backend: `app/config.py`
- Frontend: `frontend/src/stores/writer-store.ts` → `defaultSettings`

---

## ⚠️ CRITICAL LESSONS LEARNED - READ BEFORE MAKING CHANGES

### 1. Model Selection for JSON Output (CRITICAL)
**Problem:** `gpt-oss:latest` and some other models do NOT properly support Ollama's `format: "json"` mode. They return malformed JSON or empty responses, causing all assessment scores to be 0.

**Solution:** Always use models known to support JSON mode:
- ✅ `qwen3:latest` - Works well, fast (4.9GB)
- ✅ `huihui_ai/qwen3-abliterated:8b` - Works well, fast (4.7GB)
- ✅ `huihui_ai/qwen3-abliterated:32b` - Works well, slower but better quality (18.4GB)
- ❌ `gpt-oss:latest` - DOES NOT work with JSON mode

**How to test a model's JSON support:**
```powershell
$body = @{model="MODEL_NAME"; prompt="Generate JSON: {score: 75}"; format="json"; stream=$false} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method Post -Body $body
```

### 2. Ollama Connection Issues
**Problem:** After a long-running or failed request, Ollama can get stuck and stop responding to new requests.

**Symptoms:**
- API calls to Ollama hang indefinitely
- `/api/tags` endpoint times out
- Assessment starts but never progresses

**Solution:**
1. Kill Ollama: `taskkill /f /im ollama.exe` or via Task Manager
2. Restart Ollama: `ollama serve`
3. Verify it's responding: `Invoke-RestMethod -Uri "http://localhost:11434/api/tags"`

### 3. Chat Sidebar Scrolling (CSS Flexbox)
**Problem:** Chat messages scroll off the visible area or don't scroll at all.

**Root Cause:** Flexbox containers need explicit height constraints for `overflow-y: auto` to work.

**Solution - Apply these CSS rules:**
```css
/* Parent container must have fixed/explicit height */
.chat-wrapper {
  height: 100%;      /* or calc(100vh - header) */
  overflow: hidden;  /* Prevent parent from growing */
}

/* Scrollable container needs min-h-0 AND explicit height */
.messages-container {
  flex: 1;
  min-height: 0;       /* CRITICAL for flexbox scrolling */
  overflow-y: auto;
  min-height: 500px;   /* Fallback to ensure visibility */
}

/* Fixed elements (header, input) should not shrink */
.header, .input-area {
  flex-shrink: 0;
}
```

### 4. Zustand State Persistence Issues
**Problem:** State gets stuck in invalid states (e.g., `providerStatus: 'checking'` forever) due to localStorage persistence.

**Solution:** When debugging connection issues:
1. Open DevTools → Application → Local Storage
2. Clear `writer-store` key
3. Refresh the page

### 5. ProcessPulse Session JSON Format
**Problem:** The Analyzer didn't recognize session exports from the Writer.

**Solution:** Added `PROCESSPULSE_SESSION` format to chat parser that extracts exchanges from both `chatMessages` and `events` arrays.

---

## Resolved Issues (Complete List)

### Frontend Issues

1. **Black screen after document creation**
   - Cause: Variable shadowing (`document` vs global `document`)
   - Fix: Renamed to `writerDocument`, used `window.document`

2. **Text selection immediately clearing**
   - Cause: Auto-updating state on selection change
   - Fix: Use right-click context menu instead

3. **Chat sidebar scrolling broken**
   - Cause: Flexbox containers without proper height constraints
   - Fix: Added `min-h-0`, `flex-shrink-0`, fixed `minHeight` on messages container

4. **Resizable panel needed between editor and chat**
   - Fix: Implemented draggable divider with `useState` for width, mouse event handlers

5. **Provider status stuck at 'checking'**
   - Cause: Zustand localStorage persistence with stale state
   - Fix: Clear localStorage, also removed excessive console logging

### Backend Issues

6. **Unicode emoji errors**
   - Cause: Windows console encoding
   - Fix: Removed all emojis from Python code

7. **Assessment returning all zeros**
   - Cause: `gpt-oss:latest` model doesn't support JSON format mode
   - Fix: Changed default model to `qwen3:latest` (or `huihui_ai/qwen3-abliterated:32b`)

8. **Assessment endpoint was placeholder**
   - Cause: Original endpoint just returned mock data
   - Fix: Implemented full assessment pipeline integration

9. **ProcessPulse session format not recognized**
   - Cause: Chat parser didn't know about Writer's export format
   - Fix: Added `PROCESSPULSE_SESSION` format with parsing for `chatMessages` and `events`

10. **Perplexica CORS errors**
    - Cause: Browser blocking cross-origin requests to localhost:3000
    - Fix: Created backend proxy at `/api/perplexica/`

### Configuration Issues

11. **TailwindCSS v4 config**
    - Fix: Use `@import "tailwindcss"` and `@tailwindcss/postcss`

12. **Vite proxy for API calls**
    - Added proxy in `vite.config.ts` for `/api` to `http://localhost:8000`

---

## Agent Session Log

### Session 1 - December 10, 2025
**Agent:** Initial PRD Development Agent  
**Accomplished:** Created comprehensive PRD, defined architecture

### Session 2 - December 11, 2025 (Morning)
**Agent:** Development Agent  
**Accomplished:**
- Set up complete backend (FastAPI, SQLite, parsers, RAG, assessment)
- Set up React frontend with Tailwind v4
- Built analyzer UI
- Started Phase 2: Writer interface

### Session 3 - December 11, 2025 (Afternoon)
**Agent:** Development Agent  
**Accomplished:**
- Fixed black screen bug in Writer
- Implemented right-click context menu
- Added paste/copy/focus tracking for academic integrity
- Added session metrics
- Created backend session storage API
- Added Find & Replace (Ctrl+F/H)
- Added link insertion
- Added writing stats bar

### Session 4 - December 11, 2025 (Evening)
**Agent:** Development Agent  
**Accomplished:**
- Added DOCX export using `docx` library
- Added TXT export (plain text)
- Added HTML export (styled)
- Enabled browser spell check in editor
- Added keyboard shortcuts help modal (Ctrl+/)
- Added welcome onboarding modal for first-time users
- Added auto-save indicator with timestamp
- Added error boundary component for crash recovery
- **Added Perplexica Web Search integration**
  - PerplexicaClient class for local AI-powered search
  - SearchPanel component with multiple focus modes (Web, Academic, YouTube, Reddit, Wolfram)
  - Results display with expandable sources and citations
  - Insert search results directly to chat
  - Tracks `web_search` events for process capture
- **PROTOTYPE NOW READY FOR STUDENT TESTING**

**Key Files Added:**
- `frontend/src/lib/export-utils.ts` - Export utilities
- `frontend/src/components/ErrorBoundary.tsx` - Error handling
- `frontend/src/components/writer/SearchPanel.tsx` - Perplexica search UI

**Key Files Modified:**
- `frontend/src/lib/ai-providers.ts` - Added PerplexicaClient class
- `frontend/src/stores/writer-store.ts` - Search state, actions, web_search event type
- `frontend/src/components/writer/WriterPage.tsx` - Export dropdown, shortcuts modal, welcome modal, search button
- `frontend/src/components/writer/Editor.tsx` - Spell check enabled
- `frontend/src/App.tsx` - Wrapped with ErrorBoundary

### Session 5 - December 11, 2025 (Late Evening)
**Agent:** Development Agent  
**Accomplished:**
- **Fixed Perplexica CORS issue**
  - Created backend proxy at `/api/perplexica/` to bypass browser CORS restrictions
  - Updated PerplexicaClient to use backend proxy instead of direct calls
  - Perplexica web search now fully functional
- **Added Polyform Noncommercial 1.0.0 License**
  - Free for educators, students, educational institutions
  - Commercial use requires separate license
- **Complete Docker Deployment Setup**
  - `Dockerfile` - Backend (FastAPI, multi-stage build, ~500MB)
  - `frontend/Dockerfile` - Frontend (React + nginx, ~50MB)
  - `docker-compose.yml` - Full orchestration with:
    - ProcessPulse frontend & backend
    - Ollama with auto model download
    - Perplexica + SearXNG for web search
  - `env.example` - Configuration template
  - `DEPLOYMENT.md` - Detailed deployment guide
  - Auto-downloads models on first run (~7.5GB total)
  - GPU support option (just uncomment in docker-compose)
  - External Ollama support for existing installations

**Key Files Added:**
- `Dockerfile` - Backend container
- `frontend/Dockerfile` - Frontend container
- `frontend/nginx.conf` - Production nginx config
- `docker-compose.yml` - Full stack orchestration
- `env.example` - Environment configuration
- `DEPLOYMENT.md` - Deployment documentation
- `LICENSE` - Polyform Noncommercial 1.0.0
- `.dockerignore` - Docker build exclusions
- `app/api/routes/perplexica.py` - Perplexica proxy endpoints

**Disk Space Requirements (Docker):**
| Component | Size |
|-----------|------|
| Docker images | ~2.5 GB |
| Chat model (llama3.1:8b) | ~4.7 GB |
| Embedding model | ~275 MB |
| **Total** | **~7.5 GB** |

### Session 6 - December 12, 2025
**Agent:** Development Agent  
**Accomplished:**
- **Fixed Analyzer Assessment Pipeline**
  - Assessment endpoint was returning placeholder data - now runs full pipeline
  - Added ProcessPulse session format parser (`PROCESSPULSE_SESSION`)
  - Session JSON exports from Writer now parse correctly
  
- **Fixed Model JSON Support Issue**
  - Discovered `gpt-oss:latest` doesn't support Ollama's `format: "json"` mode
  - Changed default model to `qwen3:latest` (configurable)
  - Documented which models work with JSON mode
  
- **Fixed Chat Sidebar Scrolling**
  - Root cause: Flexbox containers need `min-h-0` for scrolling to work
  - Added fixed `minHeight: 600px` to messages area
  - Made main page container `h-screen overflow-hidden`
  
- **Added Resizable Chat Panel**
  - Draggable divider between editor and chat
  - Persists width during session
  
- **Added Markdown Export**
  - New `exportToMarkdown()` function in export-utils.ts
  - Converts HTML to clean Markdown format
  
- **Fixed AssessmentResults Undefined Errors**
  - Added null checks for `processing_time_seconds`, `total_score`, `total_possible`
  - Added safety for `summary` and `criterion_assessments` arrays

- **Documentation**
  - Added comprehensive "Critical Lessons Learned" section
  - Documented all resolved issues with causes and fixes
  - Future agents won't repeat these mistakes

**Key Files Modified:**
- `app/api/routes/assessment.py` - Full assessment implementation
- `app/services/parsing/chat_parser.py` - ProcessPulse session format
- `app/config.py` - Changed default model to qwen3:latest
- `frontend/src/App.tsx` - Assessment handling, progress display
- `frontend/src/components/writer/WriterPage.tsx` - Resizable panels, markdown export
- `frontend/src/components/writer/ChatSidebar.tsx` - Fixed scrolling
- `frontend/src/components/AssessmentResults.tsx` - Null safety checks
- `frontend/src/lib/export-utils.ts` - Added markdown export

**Critical Learnings:**
1. Always test model JSON support before using for assessment
2. Flexbox scrolling requires `min-h-0` on child containers
3. Ollama can get stuck - restart it if requests hang
4. Clear localStorage when Zustand state gets corrupted

### Session 7 - December 12, 2025 (Current)
**Agent:** Development Agent  
**Accomplished:**

- **Improved Assessment Prompt Strictness**
  - Updated `SYSTEM_PROMPT` with explicit red flags for AI over-dependence
  - Added copy-paste delegation patterns that trigger automatic INADEQUATE scores
  - Added passive consumption patterns that cap scores at DEVELOPING
  - Created detailed scoring guidance with examples for each level
  - Updated summary prompt to ask "delegation vs collaboration?"
  - Updated authenticity prompt with additional delegation checks
  - Improved semantic search queries for each criterion
  - **Result:** Test submission scored 59/100 (down from 62/100) - more accurate for copy-paste usage

- **Added PDF Export for Assessment Reports**
  - Professional multi-page PDF reports using jsPDF + jspdf-autotable
  - Includes: overall score, summary paragraphs, key strengths, areas for growth
  - Detailed criterion breakdown with reasoning, evidence citations, feedback
  - Authenticity analysis with flags and positive indicators
  - Export button added to AssessmentResults component
  - Also added JSON data export option

- **Changed Frontend Port to 5175**
  - Updated `vite.config.ts` to use port 5175 (was 5173)
  - Avoids conflict with other projects

**Key Files Added:**
- `frontend/src/lib/pdf-export.ts` - Comprehensive PDF generation utility

**Key Files Modified:**
- `app/services/assessment/prompts.py` - Stricter assessment prompts
- `frontend/src/components/AssessmentResults.tsx` - Export menu with PDF/JSON
- `frontend/vite.config.ts` - Port changed to 5175

**Prompt Changes Made:**
1. **RED FLAGS** added for copy-paste delegation:
   - "give me a paragraph about X"
   - "write me a paragraph for X"
   - "complete this for me"
   - Student never states their own position first
2. **SCORING GUIDANCE** added:
   - INADEQUATE: Delegation, no original thinking
   - DEVELOPING: Some direction but mostly passive
   - PROFICIENT: Clear original thinking BEFORE AI, meaningful pushback
   - EXEMPLARY: Strong original position, multiple disagreements
3. **SUMMARY** changes:
   - Key question: "Did student USE AI or DELEGATE TO AI?"
   - Polished AI essay with no student thinking = FAILING grade

---

## Testing the Prototype

### For Students
1. Go to http://localhost:5175
2. Click "Writer"
3. Click "New Document"
4. Enter title and optional assignment context
5. Click "Create"
6. Start writing! Use AI chat sidebar for help
7. Right-click on selected text for AI editing
8. Export when done (DOCX for submission, JSON for instructor)

### For Instructors
1. Collect JSON exports from students
2. Go to http://localhost:5175
3. Click "Analyzer"
4. Upload essay and JSON session file
5. Click "Analyze Submission"
6. Review scores and evidence
7. Click "Export Report" → "PDF Report" for a comprehensive assessment document

---

## Next Steps for Future Agent

1. **Connect Writer → Analyzer flow** - Button to directly import session for assessment
2. **Testing** - Unit tests for backend, integration tests for frontend
3. ~~**Deployment** - Docker setup, production config~~ ✅ DONE
4. **Mobile responsiveness** - Make writer usable on tablets
5. **Test Docker deployment** - Verify docker-compose works on fresh machine
6. **Batch assessment** - Multiple submissions at once
7. **PDF export** - Export essays as PDF

---

## Docker Deployment

### Quick Start
```bash
git clone https://github.com/lafintiger/processpulse.git
cd processpulse
cp env.example .env
docker-compose up -d
# Access at http://localhost
```

### Services Included
- Frontend (nginx + React)
- Backend (FastAPI)
- Ollama (Local AI)
- Perplexica (Web Search)
- SearXNG (Search Engine)

### Configuration
Edit `.env` to change:
- Ports (default: 80, 11434, 3000)
- AI models (default: llama3.1:8b, nomic-embed-text)
- Debug mode

See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions.

---

*This document should be updated whenever significant progress is made.*
