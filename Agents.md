# Agent Handoff Document - ProcessPulse

**Project:** ProcessPulse (AI-Assisted Writing Process Analyzer)  
**Last Updated:** December 11, 2025  
**Status:** Phase 2 Writer Interface - Functional with Academic Integrity Tracking  
**GitHub:** https://github.com/lafintiger/processpulse

---

## Executive Summary

ProcessPulse is an application for educators to assess student writing by analyzing both the final essay AND the complete AI collaboration history. The core philosophy is **80/20 assessment**: 80% of the grade comes from the thinking process, 20% from the final product.

**Current State:** 
- Backend (FastAPI) fully functional with assessment pipeline + session storage
- Frontend (React) analyzer mode works
- **Writer interface fully functional** with rich text editing, AI chat, and process capture
- **Academic integrity tracking** - paste detection, copy tracking, focus monitoring

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
# Runs at http://localhost:5173
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

## Pending Features

| Feature | Priority | Effort |
|---------|----------|--------|
| Export to PDF/DOCX | High | Medium |
| Spell check | Medium | Medium |
| Focus mode (minimal UI) | Low | Easy |
| Keyboard shortcuts help modal | Low | Easy |
| Version history/snapshots | Low | High |

---

## Configuration

### Default Models
- **Analysis:** `gpt-oss:latest`
- **Embeddings:** `bge-m3`

### Settings Files
- Backend: `app/config.py`
- Frontend: `frontend/src/stores/writer-store.ts` → `defaultSettings`

---

## Resolved Issues

1. **Black screen after document creation**
   - Cause: Variable shadowing (`document` vs global `document`)
   - Fix: Renamed to `writerDocument`, used `window.document`

2. **Text selection immediately clearing**
   - Cause: Auto-updating state on selection change
   - Fix: Use right-click context menu instead

3. **Unicode emoji errors**
   - Cause: Windows console encoding
   - Fix: Removed all emojis from Python code

4. **TailwindCSS v4 config**
   - Fix: Use `@import "tailwindcss"` and `@tailwindcss/postcss`

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
**Agent:** Development Agent (Current)  
**Accomplished:**
- Fixed black screen bug in Writer
- Implemented right-click context menu
- Added paste/copy/focus tracking for academic integrity
- Added session metrics
- Created backend session storage API
- Added Find & Replace (Ctrl+F/H)
- Added link insertion
- Added writing stats bar

**Key Files Modified:**
- `frontend/src/components/writer/Editor.tsx` - Major enhancements
- `frontend/src/stores/writer-store.ts` - Metrics tracking
- `app/db/models.py` - WritingSession model
- `app/api/routes/sessions.py` - NEW: Session API

---

## Next Steps for Future Agent

1. **Add export formats** - PDF and DOCX export using libraries
2. **Add spell check** - Browser-based or external library
3. **Connect Writer → Analyzer flow** - Auto-import sessions for assessment
4. **Polish UI** - Error boundaries, loading states
5. **Testing** - Unit tests for backend, integration tests

---

*This document should be updated whenever significant progress is made.*
