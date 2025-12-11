# Product Requirements Document (PRD)
# AI-Assisted Writing Process Analyzer

**Version:** 1.0  
**Date:** December 10, 2025  
**Status:** Initial Development Phase

---

## Executive Summary

The AI-Assisted Writing Process Analyzer is a locally-hosted web application designed to assess student writing assignments using the new paradigm of AI-assisted education. Rather than focusing solely on the final essay product, this tool analyzes the student's thinking process through their complete AI chat history, evaluating intellectual honesty, critical engagement, iterative refinement, and genuine pursuit of truth.

The application prioritizes privacy, security, and cost-effectiveness by running entirely on local AI models via Ollama, while maintaining the flexibility to add commercial API support in future iterations.

---

## Product Vision & Goals

### Primary Objective
Enable educators to efficiently and consistently assess student AI collaboration processes according to rubric-based criteria, providing detailed feedback on thinking quality rather than just writing quality.

### Core Principles
1. **Privacy-First**: All processing happens locally; student data never leaves the instructor's control
2. **Transparency**: All AI prompts and assessment logic are visible and customizable
3. **Reliability**: Multi-model validation and multiple passes to ensure assessment quality
4. **Accessibility**: Designed for non-technical educators with intuitive interfaces
5. **Extensibility**: Built to grow from single-submission grading to comprehensive longitudinal analysis

---

## Target Users

### Primary User: Course Instructor
- Needs to grade 10-30+ student submissions per assignment
- May not be highly technical (unfamiliar with JSON, APIs, etc.)
- Wants consistent, fair, evidence-based grading
- Needs to review and adjust AI assessments before finalizing
- Values transparency in the assessment process

### Secondary User: Technical Administrator
- May help instructors set up and configure the system
- Needs to manage Ollama models and system resources
- Requires documentation for deployment and troubleshooting

---

## Technical Architecture

### Tech Stack

**Frontend:**
- **Gradio** - Python-based UI framework
  - Rapid development with good defaults
  - Built-in public link feature for testing/collaboration
  - Drag-and-drop file upload support
  - Real-time updates for long-running processes

**Backend:**
- **FastAPI** - Modern Python web framework
  - Async support for concurrent model calls
  - Automatic API documentation
  - WebSocket support for real-time updates
  
**Database:**
- **PostgreSQL** - Production-grade relational database
  - Better for future multi-user scenarios
  - Robust JSON support for flexible data storage
  - Strong data integrity guarantees

**AI Infrastructure:**
- **Ollama** - Local LLM serving (default port 11434)
- **LangChain** - LLM orchestration and prompt management
- **ChromaDB/FAISS** - Vector database for RAG implementation
- **Sentence Transformers** - Embedding generation

### System Requirements

**Minimum Specifications:**
- OS: Windows 10/11, macOS 12+, or Linux (Ubuntu 20.04+)
- RAM: 16GB
- Storage: 50GB available (for models)
- GPU: 8GB VRAM (optional but recommended)

**Recommended Specifications (like user's system):**
- RAM: 64GB
- GPU: NVIDIA RTX 5090 (24GB VRAM)
- Storage: 100GB+ SSD
- CPU: Modern multi-core processor

---

## Core Features - Phase 1 (MVP)

### 1. File Upload & Processing

**Essay Upload:**
- Supported formats: TXT, DOCX, PDF, Markdown
- Drag-and-drop interface
- Text extraction and normalization
- Preview before analysis

**Chat History Upload:**
- Supported formats (Phase 1):
  - ChatGPT: JSON export, HTML export, text copy-paste
  - Claude: Text/Markdown conversations
  - Plain text format (fallback)
- Format auto-detection
- Parsing into structured conversation format:
  ```json
  {
    "platform": "chatgpt",
    "timestamp": "2025-12-10T10:30:00Z",
    "exchanges": [
      {
        "number": 1,
        "timestamp": "2025-12-10T10:30:00Z",
        "student_prompt": "...",
        "ai_response": "...",
        "metadata": {}
      }
    ]
  }
  ```

**Assignment Context Input:**
- Text field for instructor to paste assignment prompt
- Optional: Store assignment templates for reuse

### 2. Rubric Management

**Default Rubric:**
- Pre-loaded with the provided "AI-Assisted Writing Assignment Rubric"
- Structure:
  - 4 major categories (AI Collaboration, Metacognition, Transparency, Essay Quality)
  - Sub-criteria with point values
  - 4 scoring levels per criterion (Exemplary, Proficient, Developing, Inadequate)
  - Descriptive text for each level

**Rubric Editor (Form-Based UI):**
- Create new rubrics
- Edit existing rubrics
- Category management:
  - Add/remove categories
  - Set category weight/points
- Sub-criteria management:
  - Add/remove criteria
  - Set point values
  - Define scoring levels
  - Add descriptive text
- Save/load rubrics (JSON format)
- No direct JSON editing required for basic users
- Advanced users can export/import JSON

### 3. AI Model Configuration

**Ollama Integration:**
- Connection status indicator (red/green dot)
- Test connection button
- Display available models
- Model recommendations based on task:
  - **Analysis Models** (for assessment):
    - Qwen3-30b/32b (excellent reasoning, handles long contexts)
    - Ministral-3 (efficient, good for general analysis)
    - Gemma3-27b (strong instruction following)
    - Llama3.1-70b (if available, top-tier performance)
  - **Embedding Models** (for RAG):
    - `bge-m3` (multilingual, good context understanding)
    - `nomic-embed-text` (if added - optimized for long documents)
    - `embeddinggemma` (specialized embedding model)

**Model Selection:**
- Dropdown to select analysis model(s)
- Dropdown to select embedding model
- Model metadata display (size, parameters, recommended use)
- Hardware compatibility indicator

**Multi-Model Analysis ("Three Judges" Feature):**
- Option to enable multi-model analysis
- Select 2-3 different models
- Each model independently analyzes the submission
- Results compared for:
  - Inter-rater reliability scoring
  - Consensus vs. divergent assessments
  - Model performance comparison
- Display which model performed best for which criteria

### 4. Analysis Engine

**RAG Implementation for Chat History:**
1. **Chunking Strategy:**
   - Chunk by conversation exchange (student prompt + AI response = 1 chunk)
   - Or by semantic blocks (multiple exchanges on same topic)
   - Maintain conversation context (previous 2-3 exchanges)
   - Preserve metadata (timestamps, exchange numbers)

2. **Embedding Generation:**
   - Generate embeddings for each chunk
   - Store in vector database with metadata
   - Enable semantic search across chat history

3. **Criterion-Specific Retrieval:**
   - For each rubric criterion, create targeted query
   - Retrieve top-K relevant chat excerpts
   - Pass to analysis model with full context

**Essay Analysis:**
- Process essay as complete document (likely short enough)
- Extract key elements:
  - Thesis/main argument
  - Structure and organization
  - Evidence used
  - Voice/tone analysis
- Cross-reference with chat history content

**Assessment Process:**
1. **Initialization:**
   - Load rubric
   - Process essay (extract text, analyze structure)
   - Process chat history (parse, chunk, embed)
   - Validate assignment context provided

2. **For Each Rubric Criterion:**
   - Generate criterion-specific analysis prompt
   - Retrieve relevant chat history excerpts (RAG)
   - Include essay excerpts if relevant
   - Include rubric criterion definition and scoring levels
   - Send to analysis model(s)
   - Parse response for:
     - Score (which level: Exemplary/Proficient/Developing/Inadequate)
     - Evidence citations (specific chat exchange numbers or essay sections)
     - Reasoning/justification
     - Feedback text

3. **Multiple Passes (Hallucination Reduction):**
   - Option to run 2-3 passes per criterion
   - Compare results across passes
   - Flag discrepancies for manual review
   - Use consensus scoring when consistent

4. **Authenticity/Cheating Detection:**
   - **Timestamp Analysis:**
     - Check for suspiciously regular intervals
     - Flag perfectly uniform spacing
     - Calculate mean/std dev of time gaps
   - **Essay-Chat Alignment:**
     - Verify essay content appears in chat history
     - Calculate content overlap percentage
     - Flag if essay contains substantial novel content
   - **Conversation Naturalness:**
     - Check for confusion, mistakes, dead ends (should be present)
     - Flag conversations that are "too clean"
     - Detect copy-paste patterns (repeated phrases)
   - **Style Consistency:**
     - Analyze student prompt style consistency
     - Flag sudden voice changes
   - **Generic AI Artifacts:**
     - Check for em-dashes (—) in suspicious patterns
     - Detect overly polished formatting in prompts
     - Identify generic phrases common in AI-generated text
   - **Output:** Authenticity score + list of red flags for instructor review

5. **Summary Assessment Generation:**
   - Synthesize overall findings
   - Generate narrative summary (2-3 paragraphs):
     - Student's overall approach to AI collaboration
     - Key strengths demonstrated
     - Areas for improvement
     - Notable patterns (e.g., "Student showed reluctance to seek counterarguments")
     - Unique or novel approaches
   - Honest, constructive tone

### 5. Results Display & Review Interface

**Assessment Dashboard:**
- **Overall Score Display:**
  - Total points earned / possible
  - Letter grade (if configured)
  - Visual breakdown by category (chart/graph)

- **Category Breakdown:**
  - Each category expandable
  - Shows score for each sub-criterion
  - Color-coded by performance level

- **Detailed Criterion View:**
  - Score awarded and level (Exemplary/Proficient/etc.)
  - AI-generated feedback
  - **Evidence Citations** (clickable):
    - Links to specific chat exchanges
    - Links to essay sections
    - Click to highlight/scroll to location
  - Instructor can:
    - Adjust score via dropdown
    - Edit feedback text
    - Add custom comments
    - Mark criterion as "reviewed"

- **Chat History Viewer:**
  - Left/right panel layout:
    - Left: Full chat history (scrollable)
    - Right: Assessment results
  - Highlight chat excerpts referenced in assessment
  - Click on evidence citation scrolls and highlights
  - Show both inline excerpts and full context

- **Authenticity Flags:**
  - Dedicated section for cheating detection results
  - Each red flag listed with:
    - Severity (Low/Medium/High)
    - Description
    - Evidence location
    - Not accusatory - framed as "needs review"

- **Summary Assessment:**
  - Prominent display of narrative summary
  - Editable by instructor
  - Shows synthesized view of student's process

- **Multi-Model Comparison (if enabled):**
  - Table showing scores from each model
  - Highlight consensus vs. discrepancies
  - Inter-rater reliability statistics
  - Option to select preferred model's assessment

**Export Options:**
- PDF report (formatted for student delivery)
- JSON data (for record-keeping)
- Markdown summary
- Include/exclude various sections (customizable)

### 6. Prompt Transparency

**Prompt Viewer:**
- Dedicated tab/section showing all prompts used
- Categories:
  - System prompts (general instructions to model)
  - Criterion-specific assessment prompts
  - Summary generation prompts
  - Cheating detection prompts
- Each prompt shown with:
  - Purpose/use case
  - Variables/placeholders highlighted
  - Edit capability for advanced users
  - Save custom prompt variants

**Prompt Library:**
- Default prompts (proven effective)
- User's custom prompts
- Import/export prompt sets
- Version control (track prompt changes)

---

## User Workflow - Phase 1

### Single Submission Grading

1. **Setup (First Time):**
   - Launch application (web interface opens)
   - Check Ollama connection (status indicator)
   - Verify models loaded
   - Review/customize rubric if needed

2. **New Assessment:**
   - Click "New Assessment"
   - Enter assignment context (paste prompt)
   - Select rubric (default or custom)
   - Select analysis model(s)
   - Optional: Enable multi-model analysis
   - Optional: Configure assessment settings (# of passes, etc.)

3. **Upload Files:**
   - Drag-and-drop essay file
   - Preview essay (verify correct extraction)
   - Drag-and-drop chat history file
   - System detects format and parses
   - Preview chat history (verify structure)

4. **Run Analysis:**
   - Click "Analyze Submission"
   - Progress indicators show:
     - Processing chat history (chunking, embedding)
     - Analyzing essay structure
     - Assessing each criterion (progress bar)
     - Running authenticity checks
     - Generating summary
   - Estimated time remaining displayed

5. **Review Results:**
   - View overall score and breakdown
   - Navigate through each criterion
   - Click evidence citations to review source material
   - Check authenticity flags
   - Read summary assessment
   - If multi-model: Compare model outputs

6. **Adjust & Finalize:**
   - Modify scores as needed
   - Edit feedback text
   - Add instructor comments
   - Approve or flag for follow-up
   - Mark as reviewed

7. **Export:**
   - Select export format (PDF, JSON, etc.)
   - Choose what to include
   - Generate report for student

---

## Data Models

### Assignment
```json
{
  "id": "uuid",
  "title": "Essay on AI Impact",
  "description": "Write an essay analyzing...",
  "rubric_id": "uuid",
  "created_at": "timestamp",
  "instructor_notes": "..."
}
```

### Submission
```json
{
  "id": "uuid",
  "assignment_id": "uuid",
  "student_id": "string (optional for Phase 1)",
  "essay_text": "Full essay content...",
  "essay_metadata": {
    "word_count": 1500,
    "file_format": "docx",
    "upload_timestamp": "..."
  },
  "chat_history": {
    "platform": "chatgpt",
    "total_exchanges": 15,
    "exchanges": [...],
    "raw_export": "original file content"
  },
  "created_at": "timestamp",
  "status": "pending|analyzing|reviewed|finalized"
}
```

### Assessment
```json
{
  "id": "uuid",
  "submission_id": "uuid",
  "rubric_id": "uuid",
  "model_used": "qwen3-32b",
  "multi_model_results": [...],
  "scores": {
    "category_1": {
      "criterion_1_1": {
        "points_earned": 9,
        "points_possible": 10,
        "level": "exemplary",
        "evidence": [
          {
            "type": "chat_exchange",
            "reference": 5,
            "excerpt": "..."
          }
        ],
        "ai_feedback": "...",
        "instructor_feedback": "...",
        "instructor_adjusted": false
      }
    }
  },
  "total_score": 85,
  "total_possible": 100,
  "authenticity_flags": [...],
  "summary_assessment": "...",
  "created_at": "timestamp",
  "reviewed_at": "timestamp|null",
  "reviewed_by": "instructor_id"
}
```

### Rubric
```json
{
  "id": "uuid",
  "name": "AI-Assisted Writing Rubric v1",
  "description": "Process-focused assessment (80/20)",
  "categories": [
    {
      "id": "cat_1",
      "name": "AI Collaboration Process",
      "weight": 50,
      "criteria": [
        {
          "id": "crit_1_1",
          "name": "Starting Point & Initial Thinking",
          "points": 10,
          "levels": [
            {
              "name": "exemplary",
              "range": [9, 10],
              "description": "Demonstrates clear articulation..."
            },
            {
              "name": "proficient",
              "range": [7, 8],
              "description": "..."
            }
          ]
        }
      ]
    }
  ],
  "created_at": "timestamp"
}
```

---

## Assessment Prompts (Initial Design)

### System Prompt Template
```
You are an expert educational assessor specializing in evaluating student thinking processes when working with AI tools. Your role is to fairly and objectively assess student work according to a provided rubric.

Key principles:
1. Focus on the thinking process, not just the output
2. Look for evidence of intellectual honesty and genuine engagement
3. Value iteration, questioning, and evolution of ideas
4. Be fair but rigorous - neither overly harsh nor overly lenient
5. Provide specific evidence for all assessments
6. Cite exact exchange numbers or essay sections

The student has been REQUIRED to use AI for this assignment. AI use is not cheating - it is expected. You are evaluating HOW they used AI, not WHETHER they used it.
```

### Criterion Assessment Prompt Template
```
RUBRIC CRITERION: {criterion_name}
POINTS POSSIBLE: {points}

SCORING LEVELS:
{level_descriptions}

ASSIGNMENT CONTEXT:
{assignment_prompt}

RELEVANT CHAT HISTORY EXCERPTS:
{rag_retrieved_excerpts}

ESSAY EXCERPTS (if relevant):
{essay_sections}

TASK:
Assess this criterion based on the evidence provided. 

Provide your assessment in the following JSON format:
{
  "score": <number>,
  "level": "<exemplary|proficient|developing|inadequate>",
  "reasoning": "<2-3 sentences explaining your assessment>",
  "evidence": [
    {
      "type": "<chat_exchange|essay_section>",
      "reference": "<exchange number or section>",
      "excerpt": "<brief relevant quote>",
      "analysis": "<why this supports your assessment>"
    }
  ],
  "feedback": "<constructive feedback for student (2-3 sentences)>"
}

Be specific and cite evidence. If evidence is unclear or contradictory, note that in your reasoning.
```

### Summary Assessment Prompt Template
```
COMPLETE ASSESSMENT DATA:
{all_criterion_scores_and_evidence}

OVERALL SCORES:
- AI Collaboration Process: {score}/50
- Metacognitive Awareness: {score}/20
- Transparency: {score}/10
- Essay Quality: {score}/20
- TOTAL: {score}/100

ASSIGNMENT: {assignment_description}

TASK:
Provide a holistic summary assessment of this student's work (2-3 paragraphs). Address:

1. Overall approach to AI collaboration - what patterns did you observe?
2. Key strengths demonstrated in their process
3. Areas where improvement is needed
4. Any notable or novel approaches
5. General intellectual trajectory shown

Be honest but constructive. Avoid generic praise or criticism. Be specific about what the student did well and what they should work on. Your tone should be encouraging but rigorous - like a demanding professor who wants students to succeed.

Do not simply summarize scores. Provide insight into the student's thinking process and learning journey.
```

### Authenticity Check Prompt Template
```
CHAT HISTORY METADATA:
- Total exchanges: {count}
- Time span: {duration}
- Exchange timestamps: {list}

CHAT HISTORY CONTENT:
{full_or_sampled_chat_history}

ESSAY CONTENT:
{essay_text}

TASK:
Analyze this submission for authenticity markers. Check for:

1. TIMESTAMP PATTERNS: Are intervals suspiciously regular or irregular?
2. CONTENT ALIGNMENT: Does the essay actually derive from the chat history?
3. CONVERSATION NATURALNESS: Does the conversation show natural confusion, mistakes, or dead ends?
4. STYLE CONSISTENCY: Is the student's prompting style consistent?
5. ARTIFACT DETECTION: Are there signs of AI-generated prompts?

Provide assessment in JSON format:
{
  "authenticity_score": <0-100>,
  "confidence": "<high|medium|low>",
  "flags": [
    {
      "type": "<timestamp|content|style|artifact>",
      "severity": "<low|medium|high>",
      "description": "...",
      "evidence": "...",
      "location": "..."
    }
  ],
  "overall_assessment": "2-3 sentence summary"
}

Be thorough but not accusatory. These are flags for instructor review, not definitive judgments.
```

---

## Phase 2+ Features (Future Enhancements)

### Multi-Student Batch Processing
- Upload multiple submissions at once
- Queue management
- Parallel processing (multiple models simultaneously)
- Comparative analytics across students

### Longitudinal Tracking
- Student profile with submission history
- Track improvement over time
- Visualize growth in specific areas
- Pattern recognition across assignments
- Personalized recommendations

### Advanced Analytics
- Class-wide statistics
- Identify common weaknesses
- Rubric effectiveness analysis
- Model performance tracking

### Additional AI Platform Support
- Gemini export format
- Grok export format
- Perplexity conversations
- Microsoft Copilot
- Auto-detect and parse all formats

### Rubric Templates Library
- Pre-built rubrics for different disciplines
- Philosophy, technical writing, creative writing variants
- Community-contributed rubrics
- Import from community repository

### Commercial API Integration
- OpenAI API support
- Anthropic Claude API
- OpenRouter integration
- Cost tracking and budgeting
- Hybrid local/cloud deployment

### Student Portal
- Students upload their own submissions
- Real-time feedback (if enabled)
- Track their own progress
- Self-assessment tools

### Collaboration Features
- Multiple instructors can review same submission
- Peer review workflows
- Standardization across teaching teams
- Shared rubric libraries

### Advanced Cheating Detection
- AI-generated chat history detection using ML
- Plagiarism detection across submissions
- Style fingerprinting
- Deep linguistic analysis

---

## Model Recommendations & Research

### Analysis Models (Current Best Options)

**Tier 1 - High Performance (Requires significant resources):**
1. **Qwen3-32B** (19GB)
   - Excellent reasoning and instruction following
   - Strong at nuanced analysis
   - Good context window (32K tokens)
   - **Recommended for primary assessment**

2. **Gemma3-27B** (17GB)
   - Specialized for instruction following
   - Good at structured output (JSON)
   - Reliable scoring

3. **Qwen3-Coder-30B** (18GB)
   - Surprisingly good at analytical tasks
   - Excellent at structured reasoning
   - Good for systematic rubric assessment

**Tier 2 - Efficient (Good balance):**
1. **Ministral-3-Latest** (6GB)
   - Very efficient
   - Good general reasoning
   - Fast inference
   - **Recommended for quick iterations or secondary judge**

2. **Llama3.1-8B** (4.7GB)
   - Well-balanced performance
   - Good instruction following
   - Widely tested

**Multi-Model Strategy:**
- Primary: Qwen3-32B
- Secondary: Gemma3-27B
- Tertiary: Ministral-3
- Compare consistency across model sizes/architectures

### Embedding Models (For RAG)

**Best Options Available:**
1. **bge-m3** (1.2GB) - Currently in your Ollama
   - Multilingual support
   - 8192 token context
   - Excellent semantic understanding
   - **Recommended primary choice**

2. **nomic-embed-text** (Not in your list, but highly recommended to add)
   - Optimized for long documents
   - 8192 token context
   - Excellent for chat history analysis
   - Open source, locally runnable

3. **embeddinggemma** (621MB) - Currently in your Ollama
   - Lightweight
   - Good general purpose
   - Fast inference
   - Backup option

**Research Note:** As of Dec 2025, `nomic-embed-text-v1.5` and `bge-m3` are considered state-of-the-art for open-source embeddings suitable for RAG applications. Both handle long contexts well, crucial for chat history analysis.

### Hardware-Based Recommendations Chart

| Hardware Profile | Analysis Model | Embedding Model | Expected Speed |
|-----------------|----------------|------------------|----------------|
| 24GB VRAM, 64GB RAM (Your system) | Qwen3-32B + Multi-model | bge-m3 | Fast (2-3 min/submission) |
| 16GB VRAM, 32GB RAM | Qwen3-30B or Gemma3-27B | bge-m3 | Moderate (5-7 min) |
| 8GB VRAM, 16GB RAM | Ministral-3 or Llama3.1-8B | embeddinggemma | Slower (10-15 min) |
| CPU Only | Ministral-3-3B | embeddinggemma | Very slow (20-30 min) |

### Model Performance Testing Protocol

To determine which model works best for this specific task, implement:
1. Test dataset of 5-10 pre-graded submissions
2. Run each model on test dataset
3. Measure:
   - Scoring accuracy vs. human baseline
   - Consistency across runs
   - Quality of feedback text
   - Evidence citation accuracy
   - Inference time
4. Track results in dashboard
5. Recommend best model based on data

---

## Development Roadmap

### Phase 1: MVP (Weeks 1-4)
**Week 1:**
- [ ] Project setup (repo, dependencies)
- [ ] Gradio UI skeleton
- [ ] Ollama integration and model listing
- [ ] File upload (essay, chat history)
- [ ] Basic file parsing (TXT, DOCX)

**Week 2:**
- [ ] PostgreSQL schema design and setup
- [ ] Rubric data model and loading
- [ ] Default rubric integration
- [ ] Chat history parsing (ChatGPT JSON format)
- [ ] Basic form-based rubric editor

**Week 3:**
- [ ] RAG implementation (chunking, embedding, retrieval)
- [ ] Prompt engineering (system, criterion, summary prompts)
- [ ] Single-model assessment pipeline
- [ ] Results storage in database

**Week 4:**
- [ ] Results display UI
- [ ] Evidence citation linking
- [ ] Chat history viewer
- [ ] Basic export (PDF, JSON)
- [ ] Testing and bug fixes

### Phase 2: Enhancement (Weeks 5-6)
- [ ] Multi-model "three judges" feature
- [ ] Multiple passes for hallucination reduction
- [ ] Authenticity/cheating detection
- [ ] Prompt transparency viewer
- [ ] Advanced export options
- [ ] Performance optimization

### Phase 3: Platform Support (Weeks 7-8)
- [ ] Claude format parsing
- [ ] Gemini format parsing
- [ ] Grok format parsing
- [ ] Export format documentation for students
- [ ] Format auto-detection improvements

### Phase 4: Polish & Testing (Weeks 9-10)
- [ ] Comprehensive testing
- [ ] Documentation (user guide, technical docs)
- [ ] Performance benchmarking
- [ ] Model recommendation refinement
- [ ] Deployment packaging

### Phase 5+: Future Enhancements
- [ ] Batch processing
- [ ] Longitudinal tracking
- [ ] Student portal
- [ ] Commercial API integration
- [ ] Advanced analytics

---

## Success Metrics

### Phase 1 Success Criteria:
1. **Functional Completeness:**
   - Successfully process essay + chat history → assessment
   - Generate scores for all rubric criteria
   - Provide evidence citations
   - Export readable report

2. **Accuracy:**
   - Assessment scores within ±10% of human grading on test dataset
   - Evidence citations are relevant and correct
   - No major hallucinations in feedback

3. **Performance:**
   - Process single submission in <5 minutes on recommended hardware
   - UI remains responsive during processing
   - Stable performance across multiple runs

4. **Usability:**
   - Non-technical user can complete full workflow without technical assistance
   - Clear error messages and guidance
   - Intuitive navigation

5. **Reliability:**
   - No crashes or data loss
   - Consistent results across runs (with same settings)
   - Proper error handling

---

## Risk Assessment & Mitigation

### Technical Risks

**Risk 1: Model Hallucinations in Scoring**
- *Impact:* High - Could produce unfair grades
- *Mitigation:*
  - Multiple passes with consistency checks
  - Require evidence citations (harder to hallucinate)
  - Multi-model validation
  - Clear instructor review workflow

**Risk 2: Long Processing Times**
- *Impact:* Medium - Poor user experience
- *Mitigation:*
  - Efficient RAG implementation
  - Model optimization (quantization)
  - Async processing with progress updates
  - Batch processing option

**Risk 3: Chat History Parsing Failures**
- *Impact:* High - Can't assess without chat history
- *Mitigation:*
  - Support multiple input formats
  - Graceful fallback to plain text
  - Clear format documentation for students
  - Format validation before processing

**Risk 4: Database Corruption/Loss**
- *Impact:* High - Loss of assessment data
- *Mitigation:*
  - PostgreSQL with write-ahead logging
  - Regular automated backups
  - Export options for all data
  - Transaction management

### User Experience Risks

**Risk 1: Instructor Doesn't Trust AI Assessment**
- *Impact:* High - Won't use the tool
- *Mitigation:*
  - Transparency in all assessments
  - Show prompts used
  - Always require human review
  - Evidence citations for every score
  - Multi-model comparison option

**Risk 2: Too Complex for Non-Technical Users**
- *Impact:* High - Limits adoption
- *Mitigation:*
  - Simple default workflow
  - Hide advanced features initially
  - Good documentation with screenshots
  - Sensible defaults pre-configured

**Risk 3: Time-Consuming Review Process**
- *Impact:* Medium - Defeats purpose of automation
- *Mitigation:*
  - Good visual design for quick scanning
  - Focus on flagged items first
  - Batch approval for confident assessments
  - Customizable review depth

---

## Documentation Requirements

### User Documentation:
1. **Getting Started Guide**
   - Installation (Ollama, PostgreSQL, app)
   - First-time setup
   - Running your first assessment

2. **User Manual**
   - Complete workflow walkthrough
   - Rubric management
   - File format requirements
   - Interpreting results
   - Adjusting assessments

3. **Student Guidelines**
   - How to export chat history from each platform
   - What file formats to use
   - What to include in submission

### Technical Documentation:
1. **Architecture Documentation**
   - System design
   - Data models
   - API specifications

2. **Deployment Guide**
   - Server deployment
   - Configuration options
   - Scaling considerations

3. **Development Guide**
   - Code structure
   - Contributing guidelines
   - Testing procedures

4. **Prompt Engineering Guide**
   - How to customize prompts
   - Best practices
   - Testing prompt changes

---

## Open Questions & Research Needed

### 1. Optimal Chunking Strategy for Chat Histories
- **Question:** What chunking approach works best?
- **Options:**
  - By exchange (1 student prompt + 1 AI response)
  - By topic (semantic grouping)
  - By time window
  - Sliding window with overlap
- **Research Plan:** Test each on sample chat histories, measure retrieval relevance

### 2. Best Embedding Model for This Use Case
- **Question:** Which embedding model gives best semantic retrieval for educational assessment?
- **Candidates:** bge-m3, nomic-embed-text, embeddinggemma
- **Research Plan:** Benchmark on real chat histories with ground truth relevant exchanges

### 3. Multi-Model Ensemble Strategy
- **Question:** How to best combine multiple model assessments?
- **Options:**
  - Average scores
  - Weighted average (by model reliability)
  - Consensus with outlier flagging
  - Use best model per criterion
- **Research Plan:** Compare strategies on test dataset with human baseline

### 4. Context Window Optimization
- **Question:** How much context to include with each RAG retrieval?
- **Options:**
  - Just the relevant exchange
  - +/- 2 exchanges for context
  - Entire conversation thread
  - Dynamically adjust based on criterion
- **Research Plan:** Test retrieval with different context sizes, measure assessment quality

### 5. Cheating Detection Thresholds
- **Question:** What thresholds trigger red flags without false positives?
- **Areas:**
  - Timestamp regularity (how regular is "too regular"?)
  - Essay-chat alignment percentage (what's normal overlap?)
  - Conversation "cleanness" metrics
- **Research Plan:** Analyze real submissions (clean and suspicious) to establish baselines

### 6. Export Format Research
- **Question:** How does each AI platform format their chat exports?
- **Platforms:** ChatGPT, Claude, Gemini, Grok, Perplexity, others
- **Research Plan:** Obtain sample exports from each, document structure, create parsers

---

## Appendix A: Sample User Workflows

### Workflow 1: First-Time Instructor Setup
1. Install PostgreSQL
2. Install Ollama
3. Download recommended models: `ollama pull qwen3:32b`, `ollama pull bge-m3`
4. Install Process Analyzer application
5. Run database migrations
6. Launch application → opens in browser
7. Review default rubric, make any customizations
8. Ready to assess submissions

### Workflow 2: Assessing One Submission
1. Click "New Assessment"
2. Paste assignment prompt
3. Upload essay (drag DOCX file)
4. Upload chat history (drag ChatGPT JSON export)
5. Verify files parsed correctly (preview)
6. Click "Analyze" (default settings)
7. Wait 3-5 minutes (progress bar)
8. Review results:
   - Check overall score
   - Expand each criterion
   - Click evidence citations to review
   - Check authenticity flags
9. Adjust any scores, add comments
10. Export PDF for student
11. Mark as finalized

### Workflow 3: Comparing Three Models
1. Start new assessment (as above)
2. Enable "Multi-Model Analysis"
3. Select three models: Qwen3-32B, Gemma3-27B, Ministral-3
4. Run analysis (takes ~10 minutes)
5. View comparison table:
   - See where models agree/disagree
   - Check inter-rater reliability score
   - Review consensus items (all agree)
   - Review divergent items (models disagree)
6. Select preferred assessment or create hybrid
7. Note which model performed best for future reference

### Workflow 4: Customizing Assessment Prompts
1. Navigate to Settings → Prompt Management
2. View current prompts (system, criterion, summary)
3. Click "Edit" on criterion assessment prompt
4. Modify prompt text:
   - Add discipline-specific language
   - Adjust tone
   - Add emphasis on particular elements
5. Save as "Philosophy Essay Variant"
6. Test on sample submission
7. Compare results with default prompt
8. Adopt if better, revert if worse

---

## Appendix B: Data Security & Privacy Considerations

### Data Protection Measures:
1. **Local-First Architecture:**
   - All processing happens on instructor's machine
   - No data sent to external servers (unless instructor explicitly uses commercial APIs)
   - Student data never leaves instructor's control

2. **Database Security:**
   - PostgreSQL with encrypted connections
   - Strong password requirements
   - Optional encryption at rest
   - Regular backup reminders

3. **File Handling:**
   - Temporary files cleaned up after processing
   - Original uploads stored securely
   - Option to auto-delete after assessment complete

4. **Access Control (Future):**
   - Multi-user support with role-based access
   - Audit logging
   - Session management

### Compliance Considerations:
- **FERPA** (US): Student data protected by local-only processing
- **GDPR** (EU): Data minimization, right to deletion supported
- **Institution Policies**: Adaptable to various institutional requirements

### Best Practices for Instructors:
1. Use dedicated computer for assessments
2. Enable full-disk encryption
3. Regular backups to secure location
4. Don't share database access
5. Export assessments regularly
6. Clear old data periodically

---

## Appendix C: Rubric JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Assessment Rubric",
  "type": "object",
  "required": ["id", "name", "categories"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "version": {
      "type": "string"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "categories": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "weight", "criteria"],
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "weight": {
            "type": "number",
            "minimum": 0
          },
          "description": {
            "type": "string"
          },
          "criteria": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["id", "name", "points", "levels"],
              "properties": {
                "id": {
                  "type": "string"
                },
                "name": {
                  "type": "string"
                },
                "points": {
                  "type": "number",
                  "minimum": 0
                },
                "description": {
                  "type": "string"
                },
                "levels": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["name", "range", "description"],
                    "properties": {
                      "name": {
                        "type": "string",
                        "enum": ["exemplary", "proficient", "developing", "inadequate"]
                      },
                      "range": {
                        "type": "array",
                        "items": {
                          "type": "number"
                        },
                        "minItems": 2,
                        "maxItems": 2
                      },
                      "description": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## Appendix D: Technical Dependencies

### Python Packages (requirements.txt)
```
# Web Framework
gradio>=4.0.0
fastapi>=0.104.0
uvicorn>=0.24.0

# Database
psycopg2-binary>=2.9.9
sqlalchemy>=2.0.23
alembic>=1.12.1

# LLM & AI
langchain>=0.1.0
langchain-community>=0.1.0
chromadb>=0.4.18
sentence-transformers>=2.2.2

# File Processing
python-docx>=1.1.0
pypdf>=3.17.0
python-multipart>=0.0.6

# Data Processing
pandas>=2.1.3
numpy>=1.26.2

# Utilities
pydantic>=2.5.0
python-dotenv>=1.0.0
requests>=2.31.0

# Ollama Client
ollama>=0.1.0

# Export
reportlab>=4.0.7
markdown>=3.5.1
```

### System Dependencies
- PostgreSQL 14+
- Python 3.10+
- Ollama (latest version)
- CUDA drivers (if using GPU)

---

## Appendix E: FAQ for Instructors

**Q: How long does it take to assess one submission?**
A: With recommended hardware (GPU), 2-5 minutes for standard submissions. Multi-model analysis takes 8-12 minutes.

**Q: Can I use this offline?**
A: Yes! Everything runs locally. You just need Ollama and the models downloaded.

**Q: What if a student uses multiple AI tools?**
A: Great! Ask them to submit all chat histories. The system can process multiple files per submission.

**Q: Do I have to use the default rubric?**
A: No. You can customize it or create entirely new rubrics through the web interface.

**Q: Will this replace my grading entirely?**
A: No. The system provides initial assessment and evidence, but you should always review and adjust. Think of it as a very thorough TA, not a replacement for your judgment.

**Q: What about student privacy?**
A: All data stays on your computer. Nothing is sent to external servers unless you explicitly enable commercial APIs.

**Q: Can I see what prompts are being used?**
A: Yes! There's a dedicated section showing all prompts, and you can customize them.

**Q: What if the AI gets it wrong?**
A: That's why human review is required! You can adjust any score, edit feedback, and add your own comments.

**Q: How much does this cost?**
A: Free for local models via Ollama. If you add commercial API support later, costs depend on usage.

**Q: Can multiple instructors use the same installation?**
A: Phase 1 is single-user, but multi-user support is planned for Phase 2.

---

## Conclusion

The AI-Assisted Writing Process Analyzer represents a paradigm shift in educational assessment, focusing on thinking process rather than just output. By making student-AI collaboration visible and assessable, we can teach the skills that actually matter in the age of AI: critical thinking, intellectual honesty, iterative refinement, and effective human-AI collaboration.

This PRD provides a comprehensive roadmap for building a functional MVP in Phase 1, with clear paths for enhancement in subsequent phases. The emphasis on privacy, transparency, and instructor control ensures that the tool serves educators rather than replacing them.

---

**Next Steps:**
1. Review and approve this PRD
2. Set up development environment
3. Begin Phase 1, Week 1 development
4. Iterate based on testing and feedback

---

**Document Control:**
- **Author:** AI Assistant (with user direction)
- **Last Updated:** December 10, 2025
- **Version:** 1.0
- **Status:** Draft - Pending Approval

