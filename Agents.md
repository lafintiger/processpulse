# Agent Handoff Document
**Project:** AI-Assisted Writing Process Analyzer  
**Last Updated:** December 10, 2025  
**Status:** PRD Complete - Ready for Development

---

## Project Overview

This application allows educators to assess student writing assignments by analyzing both the final essay AND the complete chat history of student-AI collaboration. The focus is on evaluating the **thinking process** (80% of grade) rather than just the final product (20%).

**Key Innovation:** Makes student thinking visible through required AI chat history submission, enabling assessment of intellectual honesty, critical engagement, iteration, and genuine pursuit of truth.

---

## Current Status

✅ **Completed:**
- Comprehensive PRD created (`PRD.md`)
- Core requirements gathered
- Technical architecture defined
- User workflows documented
- Assessment rubrics provided in `RubricDocs/`

🔄 **Next Steps:**
- Begin Phase 1 development (MVP)
- Project setup and environment configuration
- Start with Gradio UI skeleton

---

## Critical Context for Next Agent

### 1. Core Philosophy
This tool is **NOT** about catching students using AI (AI use is required). It's about teaching them to:
- Think critically WHILE using AI
- Iterate and refine ideas
- Seek opposing viewpoints
- Verify information
- Be intellectually honest

The rubric (see `RubricDocs/rubric.md`) reflects this 80/20 split:
- 50 points: AI Collaboration Process
- 20 points: Metacognitive Awareness
- 10 points: Transparency & Integrity
- 20 points: Final Essay Quality

### 2. User Profile
**Primary User:** College instructor, may not be highly technical
- Needs simple, intuitive web interface
- Wants to grade 10-30 submissions per assignment
- Must review and adjust AI assessments (not blind trust)
- Values privacy and local processing

**User's Technical Environment:**
- High-end Windows laptop (RTX 5090, 24GB VRAM, 64GB RAM)
- Can run largest Ollama models
- Has many models installed (see PRD for full list)
- Comfortable with technical concepts but UI should still be user-friendly

### 3. Key Technical Decisions Made

**Frontend:** Gradio
- Rapid development
- Built-in public link feature
- Good for drag-and-drop interfaces
- Python-native (easy integration with backend)

**Backend:** FastAPI
- Async support for concurrent model calls
- Easy API documentation
- WebSocket support for progress updates

**Database:** PostgreSQL (recommended) or SQLite (easier MVP start)
- User prefers PostgreSQL for scalability
- But SQLite may be faster to get MVP working
- **Your call on what to start with**

**AI Infrastructure:**
- Ollama for local LLMs (port 11434)
- RAG implementation needed for long chat histories
- Vector DB: ChromaDB or FAISS

**Privacy-First:**
- Everything runs locally by default
- No cloud services (Phase 1)
- Commercial APIs (OpenAI, Anthropic) optional in future

### 4. Recommended Models (User Has These)

**For Assessment Analysis:**
- **Primary:** `qwen3:32b` (19GB) - Best reasoning, handles long contexts
- **Secondary:** `gemma3:27b` (17GB) - Good instruction following
- **Tertiary:** `ministral-3:latest` (6GB) - Fast, efficient

**For Embeddings (RAG):**
- **Recommended:** `bge-m3` (1.2GB) - User has this installed
- **Alternative:** `embeddinggemma` (621MB) - Lighter weight
- **Consider adding:** `nomic-embed-text` - Excellent for long documents

**Multi-Model "Three Judges" Feature:**
- Run 2-3 models on same submission
- Compare results for consistency
- Help determine which model works best
- This is a key differentiator feature

### 5. Critical Technical Challenges

#### Challenge 1: Chat History Parsing
**Problem:** Different AI platforms export in different formats
- ChatGPT: JSON or HTML
- Claude: Text/Markdown
- Gemini: (need to research)
- Grok: (need to research)

**Phase 1 Approach:** 
- Start with ChatGPT JSON format (most common)
- Add others iteratively
- Create documentation for students on how to export

**Data Structure Needed:**
```json
{
  "platform": "chatgpt",
  "exchanges": [
    {
      "number": 1,
      "timestamp": "2025-12-10T10:30:00Z",
      "student_prompt": "...",
      "ai_response": "..."
    }
  ]
}
```

#### Challenge 2: RAG for Long Chat Histories
**Problem:** Chat histories can be very long (10-20+ exchanges, each potentially lengthy)

**Proposed Approach:**
1. Chunk by exchange (student prompt + AI response = 1 chunk)
2. Generate embeddings with `bge-m3`
3. Store in vector DB with metadata (exchange number, timestamp)
4. For each rubric criterion:
   - Create targeted query
   - Retrieve top-K relevant exchanges
   - Include 2-3 exchanges before/after for context
   - Pass to LLM for assessment

**Research Needed:**
- What's the optimal chunking strategy?
- How much context to include?
- Best embedding model for this use case?
- Test and iterate on real data

#### Challenge 3: Prompt Engineering
**Critical:** The quality of assessments depends entirely on prompt quality

**Requirements:**
- Prompts must be visible to users (transparency)
- Prompts must be editable (customization)
- Need different prompts for:
  - System instructions
  - Each rubric criterion assessment
  - Summary assessment generation
  - Authenticity/cheating detection

**User expects:** "Masterful prompts" that get models to:
- Score consistently and fairly
- Cite specific evidence (exchange numbers)
- Avoid hallucinations
- Provide constructive feedback
- Be neither too harsh nor too lenient

**See PRD Appendix for starting prompt templates**

#### Challenge 4: Hallucination Prevention
**Strategies to implement:**
1. **Multiple passes:** Run same assessment 2-3 times, compare results
2. **Evidence requirement:** Force model to cite specific exchanges
3. **Multi-model validation:** Compare outputs from different models
4. **Structured output:** Use JSON response format for consistency
5. **Human review:** Always require instructor approval

#### Challenge 5: Authenticity Detection
**Check for signs of cheating:**
- Suspiciously regular timestamps
- Essay content not found in chat history
- Conversation too "clean" (no mistakes, confusion, dead ends)
- Style inconsistencies
- AI artifacts (em-dashes, perfect formatting)

**Important:** Frame as "flags for review" not accusations
- Low/Medium/High severity
- Instructor makes final judgment
- Some false positives are acceptable

### 6. MVP Scope (Phase 1)

**Must Have:**
- ✅ Web UI (Gradio) with file upload
- ✅ Essay upload (TXT, DOCX, PDF)
- ✅ Chat history upload (ChatGPT JSON format)
- ✅ Default rubric loaded (from `RubricDocs/rubric.md`)
- ✅ Form-based rubric editor (simple)
- ✅ Ollama connection check
- ✅ Model selection dropdown
- ✅ RAG implementation for chat analysis
- ✅ Single-model assessment pipeline
- ✅ Results display with evidence citations
- ✅ Chat history viewer (click citations to see source)
- ✅ Basic export (PDF, JSON)
- ✅ Instructor review/adjustment interface

**Nice to Have (but include if easy):**
- Multi-model "three judges" comparison
- Multiple passes for consistency
- Authenticity/cheating detection
- Prompt viewer/editor

**Definitely Phase 2:**
- Batch processing multiple students
- Longitudinal tracking
- Other AI platform formats (Claude, Gemini, Grok)
- Student portal
- Commercial API support

### 7. Key Files to Reference

**Rubrics (Essential for implementation):**
- `RubricDocs/rubric.md` - Full instructor rubric with detailed criteria
- `RubricDocs/rubric for students.md` - Student-facing version
- `RubricDocs/AI and Writing Assignments - The New Paradigm.md` - Context and philosophy

**Project Docs:**
- `PRD.md` - Complete product requirements (1350 lines, very detailed)
- `Agents.md` - This handoff document

**What to extract from rubrics:**
- Category names and point values
- Criterion names and point values
- Scoring levels (Exemplary/Proficient/Developing/Inadequate)
- Point ranges for each level
- Descriptive text for each level
- Convert to database schema + JSON format

### 8. Development Approach

**Recommended Order:**
1. **Week 1: Infrastructure**
   - Project setup (virtualenv, dependencies)
   - Gradio UI skeleton (file upload, basic navigation)
   - Ollama integration (test connection, list models)
   - Database setup (schema design, migrations)

2. **Week 2: Data Processing**
   - File parsing (essay extraction)
   - Chat history parsing (ChatGPT format)
   - Rubric data model
   - Load default rubric into DB

3. **Week 3: Analysis Engine**
   - RAG implementation (chunking, embedding, retrieval)
   - Prompt templates
   - Single criterion assessment (prove it works)
   - Full rubric assessment pipeline

4. **Week 4: Results & Polish**
   - Results display UI
   - Evidence citation linking
   - Chat viewer with highlighting
   - Export functionality
   - Testing and bug fixes

**User's preference:** Get basic functionality working first, then iterate and add complexity

### 9. Testing Strategy

**Create Test Dataset Early:**
- 3-5 sample submissions with:
  - Essay (TXT/DOCX)
  - Chat history (real ChatGPT export)
  - Known "ground truth" scores (manually graded)
- Use to test:
  - File parsing
  - RAG retrieval quality
  - Assessment accuracy
  - Consistency across runs

**User will be sole tester initially** but plans to expand to other educators

### 10. Important User Preferences

✅ **Wants:**
- Research on best practices (chunking, embeddings, prompts)
- Multiple model comparison to find what works best
- Flexibility and extensibility
- Transparency (see all prompts, all logic)
- Professional but accessible UI
- Evidence-based assessment (always cite sources)

❌ **Doesn't want:**
- Black box AI that can't be inspected
- Cloud dependencies (Phase 1)
- Overly complex technical setup
- False accusations of cheating
- Generic feedback ("good job!")

### 11. Open Research Questions

**You'll need to investigate:**

1. **Best embedding model for educational assessment:**
   - Compare bge-m3 vs. nomic-embed-text vs. embeddinggemma
   - Test on real chat histories
   - Measure retrieval relevance

2. **Optimal chunking for conversations:**
   - By exchange? By topic? Sliding window?
   - How much context to include?
   - Test different approaches

3. **Which LLM works best for this task:**
   - Qwen3-32b? Gemma3-27b? Ministral-3?
   - Test on sample submissions
   - Track accuracy, consistency, quality
   - User wants data-driven recommendation

4. **Multi-model ensemble strategy:**
   - How to combine scores from multiple models?
   - Average? Consensus? Weighted?
   - Test to find best approach

5. **AI platform export formats:**
   - Document how each platform exports chats
   - Create parsing logic for each
   - Provide student instructions

### 12. Common Pitfalls to Avoid

❌ **Don't:** Build overly complex rubric editor in Phase 1
✅ **Do:** Load default rubric, add simple editor later

❌ **Don't:** Try to support all AI platforms at once
✅ **Do:** Start with ChatGPT, add others iteratively

❌ **Don't:** Assume first prompt will work perfectly
✅ **Do:** Plan for prompt iteration and testing

❌ **Don't:** Auto-finalize assessments without human review
✅ **Do:** Always require instructor approval

❌ **Don't:** Make accusing language for cheating detection
✅ **Do:** Frame as "items for review" with neutral tone

❌ **Don't:** Hide the AI's reasoning
✅ **Do:** Show prompts, show evidence, show logic

### 13. Quick Start Checklist for Next Agent

When you begin development:

- [ ] Read PRD.md (especially Phase 1 MVP section)
- [ ] Read all three rubric files to understand assessment criteria
- [ ] Review user's available Ollama models (in PRD)
- [ ] Decide: PostgreSQL or SQLite for MVP?
- [ ] Set up project structure:
  ```
  process-analyzer/
  ├── app/
  │   ├── ui/              # Gradio interface
  │   ├── api/             # FastAPI backend
  │   ├── models/          # Data models
  │   ├── services/        # Business logic
  │   │   ├── parsing/     # File parsing
  │   │   ├── rag/         # RAG implementation
  │   │   ├── assessment/  # LLM assessment
  │   │   └── export/      # Report generation
  │   └── db/              # Database schemas
  ├── prompts/             # Assessment prompt templates
  ├── rubrics/             # Rubric JSON files
  ├── tests/               # Test suite
  ├── test_data/           # Sample submissions
  └── requirements.txt
  ```
- [ ] Create requirements.txt (see PRD Appendix D)
- [ ] Test Ollama connection
- [ ] Create test dataset (3-5 sample submissions)
- [ ] Start with Week 1 tasks

### 14. User Communication Style

**User is:**
- Technical enough to understand architecture decisions
- Wants to be consulted on major choices
- Prefers "show me working code" over lengthy discussions
- Values research-backed recommendations
- Open to suggestions and alternative approaches
- Will test and provide feedback iteratively

**When you need input:**
- Present options with pros/cons
- Make a recommendation with reasoning
- Show working prototype when possible
- Ask specific questions rather than open-ended

### 15. Success Criteria

**MVP is successful when:**
1. User can upload essay + ChatGPT chat history
2. System analyzes and produces scored rubric assessment
3. Every score has evidence citations
4. User can click citations to see source in chat history
5. User can review and adjust all scores
6. System exports clean PDF report
7. Processing completes in <5 minutes on user's hardware
8. No crashes or data loss
9. Assessment scores are reasonable (within ±10% of manual grading)

**Long-term success:**
- Other educators can use it
- Saves instructors time while improving assessment quality
- Students learn to think better through the feedback
- Tool scales to handle full classes (30+ students)

---

## Final Notes

This is an ambitious but well-scoped project. The user has thought deeply about the educational problem and has clear requirements. The main challenges are technical (RAG, prompts, parsing) not conceptual.

**Start simple:** Get basic end-to-end flow working, then iterate on quality.

**Communicate:** Ask questions when you need clarification. User is responsive and helpful.

**Document:** Keep this handoff doc updated as you learn what works and what doesn't.

**Have fun:** This is a genuinely useful tool that addresses a real need in education. Your work will help students learn to think better in the age of AI.

---

## Agent Log

### Session 1 - December 10, 2025
**Agent:** Initial PRD Development Agent  
**Accomplished:**
- Conducted detailed requirements gathering (15 clarifying questions)
- Researched user's available models
- Created comprehensive 1350-line PRD
- Defined technical architecture
- Outlined 10-week development roadmap
- Created this handoff document

**Key Decisions:**
- Gradio for frontend
- PostgreSQL (or SQLite) for database
- Ollama with local models (privacy-first)
- RAG approach for long chat histories
- Multi-model validation feature
- 80/20 process-focused assessment

**Handed off to:** Next development agent  
**Status:** Ready to begin coding

---

### Session 2 - [Date]
**Agent:** [Your name/ID]  
**Working on:** [What you're building]  
**Decisions made:** [Key technical choices]  
**Blockers:** [Any issues]  
**Next agent should know:** [Critical info]

---

*Keep this log updated as the project progresses. Each agent should add their session summary before handing off.*

