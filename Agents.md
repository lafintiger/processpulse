# Agent Handoff Document - ProcessPulse

**Project:** ProcessPulse (AI-Assisted Writing Process Analyzer)  
**Last Updated:** December 11, 2025  
**Status:** Phase 1 MVP + Phase 2 Writing Interface (in progress)  
**GitHub:** https://github.com/lafintiger/processpulse

---

## Executive Summary

ProcessPulse is an application for educators to assess student writing by analyzing both the final essay AND the complete AI collaboration history. The core philosophy is **80/20 assessment**: 80% of the grade comes from the thinking process, 20% from the final product.

**Current State:** 
- Backend (FastAPI) is functional with assessment pipeline
- Frontend (React) analyzer mode works
- **NEW:** Writer interface being built (Phase 2) - currently debugging black screen on document creation

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
│   │       └── assessment.py    # Assessment endpoints (placeholder)
│   ├── db/
│   │   ├── database.py          # SQLite + SQLAlchemy async setup
│   │   └── models.py            # ORM models (Rubric, Submission, Assessment, etc.)
│   └── services/
│       ├── parsing/
│       │   ├── chat_parser.py   # Parse various chat history formats
│       │   └── essay_parser.py  # Parse TXT, DOCX, PDF, MD files
│       ├── ollama/
│       │   └── client.py        # Async Ollama API client
│       ├── rag/
│       │   ├── chunker.py       # Chunk chat histories
│       │   ├── embeddings.py    # Generate embeddings via Ollama
│       │   └── retriever.py     # Retrieve relevant chunks
│       ├── rubric/
│       │   └── loader.py        # Load rubric from markdown
│       └── assessment/
│           ├── analyzer.py      # Full assessment pipeline
│           └── prompts.py       # System/criterion/summary prompts
│
├── frontend/                     # React + Vite + TailwindCSS v4
│   ├── src/
│   │   ├── App.tsx              # Main app - routes between Home/Writer/Analyzer
│   │   ├── index.css            # TailwindCSS + custom styles + TipTap styles
│   │   ├── types.ts             # TypeScript interfaces
│   │   ├── components/
│   │   │   ├── Header.tsx       # App header
│   │   │   ├── StatusBar.tsx    # System status (Ollama, model, etc.)
│   │   │   ├── FileUpload.tsx   # Upload essay + chat history
│   │   │   ├── AssessmentResults.tsx  # Display assessment scores
│   │   │   ├── ChatViewer.tsx   # View chat history with highlighting
│   │   │   └── writer/          # NEW: Writing interface components
│   │   │       ├── WriterPage.tsx     # Main writer page
│   │   │       ├── Editor.tsx         # TipTap rich text editor
│   │   │       ├── ChatSidebar.tsx    # AI chat sidebar
│   │   │       ├── InlineEditPopup.tsx # Cmd+K inline editing
│   │   │       ├── SettingsPanel.tsx  # AI provider settings
│   │   │       └── index.ts           # Exports
│   │   ├── lib/
│   │   │   └── ai-providers.ts  # AI provider abstraction (Ollama, OpenAI, Claude)
│   │   └── stores/
│   │       └── writer-store.ts  # Zustand state management for writer
│   ├── package.json             # Dependencies
│   └── vite.config.ts           # Vite configuration
│
├── data/
│   ├── process_analyzer.db      # SQLite database
│   └── chroma/                  # ChromaDB vector storage (if used)
│
├── RubricDocs/
│   ├── rubric.md               # Full 11-criterion rubric
│   ├── rubric for students.md  # Student-facing version
│   ├── AI and Writing Assignments - The New Paradigm.md  # Philosophy doc
│   └── sample copy paste gpt.md # Sample ChatGPT export format
│
├── Samples/
│   ├── Sample 1.md             # Sample essay (may be empty - Synology sync issue)
│   ├── Sample1-chat history.json # LM Studio format chat history
│   └── sample2.docx            # Sample essay in DOCX format
│
├── requirements.txt            # Python dependencies
├── run.py                      # Backend entry point (uvicorn)
├── test_setup.py              # Verify setup script
├── test_assessment.py         # Test assessment pipeline
├── PRD.md                     # Product Requirements Document
└── README.md                  # User-facing documentation
```

---

## Backend Details

### Database Models (`app/db/models.py`)

```python
# Core models:
- Rubric: Container for categories
- Category: AI Collaboration Process, Metacognitive Awareness, etc.
- Criterion: Individual criteria within categories
- Level: Scoring levels (Exemplary/Proficient/Developing/Inadequate)
- Assignment: Assignment context
- Submission: Essay + chat history for grading
- Assessment: Assessment results
- CriterionScore: Individual criterion scores with evidence
- AuthenticityFlag: Flags for suspicious patterns
- Prompt: Versioned assessment prompts
```

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/health` | GET | Simple health check |
| `/api/status` | GET | Full system status (Ollama, models, DB) |
| `/api/models` | GET | List available Ollama models |
| `/api/upload/essay` | POST | Upload & parse essay file |
| `/api/upload/chat-history` | POST | Upload & parse chat history |
| `/api/rubric` | GET | Get full rubric structure |

### Services Architecture

**Chat Parser (`chat_parser.py`):**
- Detects format: LM Studio JSON, ChatGPT JSON, plain text/markdown
- Converts to canonical format: `List[ChatMessage]` with role, content, timestamp
- `ChatFormat` enum: CHATGPT_JSON, LM_STUDIO_JSON, PLAIN_TEXT, UNKNOWN

**Essay Parser (`essay_parser.py`):**
- Handles: `.txt`, `.md`, `.docx`, `.pdf`
- Returns: `EssayContent` with raw text, word count, format

**Ollama Client (`ollama/client.py`):**
- Async client for Ollama API
- Methods: `list_models()`, `generate()`, `embed()`
- Base URL: `http://localhost:11434`

**RAG Pipeline:**
- `chunker.py`: Chunks by exchange (Q+A pairs)
- `embeddings.py`: Generates embeddings via `bge-m3` model
- `retriever.py`: Retrieves top-K relevant chunks

**Assessment Engine (`assessment/analyzer.py`):**
- Full pipeline: parse → chunk → embed → retrieve → assess each criterion → summarize
- Uses structured JSON output for consistent scoring
- Generates evidence citations

### Configuration (`app/config.py`)

```python
class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./data/process_analyzer.db"
    ollama_base_url: str = "http://localhost:11434"
    default_analysis_model: str = "gpt-oss:latest"  # Changed from qwen3:32b
    default_embedding_model: str = "bge-m3"
    debug: bool = True
```

---

## Frontend Details

### Tech Stack
- **React 19** with TypeScript
- **Vite 7** for bundling
- **TailwindCSS v4** (new config system - uses CSS imports)
- **TipTap** for rich text editing
- **Zustand** for state management

### Key Components

**App.tsx - Route Management:**
```tsx
// Three modes:
type AppMode = 'home' | 'writer' | 'analyzer'

// Home: Choose between Writer (students) and Analyzer (educators)
// Writer: AI-assisted writing with process capture
// Analyzer: Upload + assess submissions
```

**Writer Interface (NEW - Phase 2):**

1. **WriterPage.tsx**: Main container
   - Shows home screen when no document open
   - Shows editor view when document active
   - Manages document list (localStorage)
   - New Document modal

2. **Editor.tsx**: TipTap rich text editor
   - Toolbar with formatting options
   - Keyboard shortcuts (Cmd+B, Cmd+I, Cmd+K for AI edit)
   - Event capture for process analysis
   - Word count display

3. **ChatSidebar.tsx**: AI chat panel
   - Send messages to AI
   - View conversation history
   - Streaming responses

4. **InlineEditPopup.tsx**: Cmd+K modal
   - Select text → Cmd+K → Enter instruction
   - AI suggests replacement
   - Accept/reject diff

5. **SettingsPanel.tsx**: AI configuration
   - Provider selection (Ollama/OpenAI/Claude)
   - Model configuration
   - API key input for commercial APIs

### AI Provider Abstraction (`lib/ai-providers.ts`)

```typescript
interface AIProvider {
  id: string
  name: string
  complete(prompt: string, options?: CompletionOptions): Promise<string>
  stream(prompt: string, options?: CompletionOptions): AsyncIterable<string>
  maxContextTokens: number
  supportsStreaming: boolean
}

// Implementations:
- OllamaProvider: Local AI via http://localhost:11434
- OpenAIProvider: OpenAI API
- AnthropicProvider: Claude API
```

### State Management (`stores/writer-store.ts`)

```typescript
interface WriterState {
  // Document
  document: WriterDocument | null
  documents: DocumentMeta[]
  
  // AI
  provider: AIProvider | null
  providerStatus: 'disconnected' | 'checking' | 'connected' | 'error'
  chatMessages: ChatMessage[]
  
  // Settings
  settings: WriterSettings
  
  // Events (for process analysis)
  events: WriterEvent[]
  
  // Inline edit
  inlineEditOpen: boolean
  inlineEditPosition: { from: number, to: number }
  selectedText: string
}
```

### Styling (`index.css`)

- Custom theme variables (@theme block for Tailwind v4)
- DM Sans font for body, JetBrains Mono for code
- Dark theme (zinc-950 background)
- **ProseMirror/TipTap styles** for editor content
- Custom utility classes: `.card`, `.btn-primary`, `.btn-secondary`

---

## Current Issues & Debugging

### ACTIVE BUG: Writer Black Screen

**Symptom:** After clicking "Create" on new document modal, screen goes black.

**Investigation:**
1. No console errors visible
2. No compilation errors in terminal
3. TipTap editor might not be rendering visible content

**Likely Causes:**
- TipTap `EditorContent` renders but has no visible styling
- `.ProseMirror` class styles not being applied
- Editor returns but content area has no contrast

**Fixes Applied:**
1. Added `@tailwindcss/typography` package
2. Added explicit `.ProseMirror` styles in `index.css`
3. Added loading spinner when editor initializing
4. Added explicit background color to main container

**Next Steps to Debug:**
1. Check browser DevTools Elements tab to see if HTML is rendering
2. Add console.log in Editor component to verify it's mounting
3. Check if TipTap is initializing correctly
4. Verify `.ProseMirror` class is being applied

### Previous Issues (Resolved)

1. **Unicode Emoji Error**: Windows console couldn't print emojis
   - Fixed: Removed all emojis from Python print statements

2. **Tailwind v4 Configuration**: New config system different from v3
   - Fixed: Use `@import "tailwindcss"` and `@tailwindcss/postcss` plugin

3. **Custom Colors Not Working**: `bg-surface-950` class unknown
   - Fixed: Use standard Tailwind colors or define in `@theme` block

4. **Module Imports**: `ImportError` for various modules
   - Fixed: Added missing exports to `__init__.py` files

5. **Sample File Empty**: `Sample 1.md` shows 0 bytes
   - Cause: Synology Drive sync issue
   - Workaround: Test with `sample2.docx` instead

---

## Models & Configuration

### Default Models (User's System)

**For Analysis:**
- `gpt-oss:latest` (12.8GB) - Current default, good for writing assistance
- `qwen3:32b` (19GB) - Original default, best reasoning
- `qwen3:latest` - Smaller version available

**For Embeddings:**
- `bge-m3` (1.2GB) - Current embedding model

**User's Hardware:**
- Windows with RTX 5090, 24GB VRAM
- 64GB RAM
- Can run largest models

### Changing Models

Backend: `app/config.py` → `default_analysis_model`
Frontend: `frontend/src/stores/writer-store.ts` → `defaultSettings.ollamaModel`
Frontend: `frontend/src/lib/ai-providers.ts` → `OllamaProvider` constructor default

---

## Running the Application

### Backend
```powershell
cd C:\Users\lafintiger\SynologyDrive\_aiprojects\__Dev\Process-Analyzer
.\venv\Scripts\Activate.ps1
python run.py
# Runs at http://localhost:8000
```

### Frontend
```powershell
cd C:\Users\lafintiger\SynologyDrive\_aiprojects\__Dev\Process-Analyzer\frontend
npm run dev
# Runs at http://localhost:5175 (or next available port)
```

### Verify Ollama
```powershell
curl http://localhost:11434/api/tags
```

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | SQLite (PostgreSQL-ready schema) | Fast MVP, easy migration later |
| Frontend | React + Vite (not Gradio) | More flexible UI needed for writer |
| State | Zustand | Lightweight, TypeScript-friendly |
| Editor | TipTap | Best React editor, extensible |
| Styling | TailwindCSS v4 | Modern, utility-first |
| AI Local | Ollama | Privacy, no API costs |
| AI Cloud | OpenAI/Claude optional | Better for students who prefer |

---

## Assessment Rubric Structure

### Categories (4)
1. **AI Collaboration Process** (50 points)
   - Initial Engagement (15)
   - Iterative Refinement (15)
   - Critical Evaluation (10)
   - Synthesis & Integration (10)

2. **Metacognitive Awareness** (20 points)
   - Self-Reflection (10)
   - Learning Transfer (10)

3. **Transparency & Integrity** (10 points)
   - Process Documentation (5)
   - Ethical Use (5)

4. **Final Essay Quality** (20 points)
   - Content & Argumentation (8)
   - Organization (6)
   - Language & Style (6)

### Scoring Levels
- Exemplary: 90-100%
- Proficient: 70-89%
- Developing: 50-69%
- Inadequate: 0-49%

---

## Event Capture (Writer Interface)

The writer captures these events for process analysis:

```typescript
type EventType = 
  | 'session_start' 
  | 'session_end'
  | 'text_insert'
  | 'text_delete'
  | 'text_paste'
  | 'text_select'
  | 'ai_request'      // Student asked AI something
  | 'ai_response'     // AI responded
  | 'inline_edit'     // Used Cmd+K feature
  | 'document_save'
```

Each event has:
- `timestamp`: ISO date string
- `type`: Event type
- `data`: Type-specific payload

This enables analysis of:
- How long student spent writing vs. waiting for AI
- How many times they revised
- What kinds of help they asked for
- Whether they critically evaluated AI suggestions

---

## Files to Read for Context

**Essential:**
1. `PRD.md` - Full product requirements
2. `RubricDocs/rubric.md` - Assessment criteria details
3. `RubricDocs/AI and Writing Assignments - The New Paradigm.md` - Philosophy

**Code Understanding:**
1. `frontend/src/App.tsx` - App structure
2. `frontend/src/components/writer/WriterPage.tsx` - Writer flow
3. `frontend/src/stores/writer-store.ts` - State management
4. `app/services/assessment/analyzer.py` - Assessment pipeline

---

## Immediate Next Steps

1. **Debug Writer Black Screen**
   - Add console.log statements to Editor.tsx
   - Check DevTools Elements for rendered HTML
   - Verify TipTap initialization

2. **Once Writer Works:**
   - Test AI chat functionality with gpt-oss model
   - Test inline editing (Cmd+K)
   - Verify event capture is recording

3. **Connect Writer to Analyzer:**
   - Export session as JSON
   - Import into analyzer for assessment
   - Backend endpoint to save writing sessions

4. **Polish:**
   - Error boundaries for better error handling
   - Loading states for AI operations
   - Mobile responsiveness (low priority)

---

## User Preferences

**Communication:**
- Technical, appreciates detailed explanations
- Wants research-backed recommendations
- Prefers working code over lengthy discussions
- Test frequently, iterate quickly

**App Name:** ProcessPulse (chosen from suggestions)

**Key Philosophy:**
- "Authenticity flags" not "cheat detection"
- Conservative/aggressive flag options
- Instructor always makes final decision
- Process over product (80/20)

---

## Agent Session Log

### Session 1 - December 10, 2025
**Agent:** Initial PRD Development Agent  
**Accomplished:** Created comprehensive PRD, defined architecture, gathered requirements  
**Handed off to:** Development agent

### Session 2 - December 11, 2025
**Agent:** Development Agent (Current)  
**Accomplished:**
- Set up complete backend (FastAPI, SQLite, parsers, RAG, assessment)
- Set up React frontend with Tailwind v4
- Built analyzer UI (file upload, results display)
- Resolved multiple configuration issues (Tailwind v4, Unicode, imports)
- Started Phase 2: Writer interface with TipTap editor
- Created AI provider abstraction
- Implemented event capture for process analysis
- Configured gpt-oss:latest as default model

**Current Blocker:** Writer screen goes black after creating document

**Key Files Modified This Session:**
- All files in `frontend/src/components/writer/`
- `frontend/src/lib/ai-providers.ts`
- `frontend/src/stores/writer-store.ts`
- `frontend/src/index.css` (ProseMirror styles)
- `app/config.py` (model defaults)

**Next Agent Should:**
1. Debug the black screen issue in WriterPage
2. Test AI integration in writer
3. Connect writer exports to analyzer
4. Commit changes to GitHub

---

*This document should be updated whenever significant progress is made or blockers are encountered.*
