# ProcessPulse Development Roadmap

**Last Updated:** December 12, 2025  
**Status:** Phase 1 Complete, Phase 2 Planning

---

## Current State

ProcessPulse is a working prototype with:
- ✅ Writer interface for AI-assisted writing with process capture
- ✅ Analyzer interface for rubric-based assessment
- ✅ PDF/JSON export for assessment reports
- ✅ Docker deployment ready
- ✅ Single-user functionality

**Priority:** Validate that assessment analysis is accurate and useful before scaling.

---

## Phase 1: Core Functionality ✅ COMPLETE

| Feature | Status |
|---------|--------|
| Writer interface with TipTap | ✅ Done |
| AI chat sidebar (Ollama/OpenAI/Claude) | ✅ Done |
| Process capture (all events timestamped) | ✅ Done |
| Academic integrity tracking | ✅ Done |
| Analyzer with file upload | ✅ Done |
| 11-criterion rubric assessment | ✅ Done |
| Evidence-based scoring | ✅ Done |
| PDF export for reports | ✅ Done |
| Docker deployment | ✅ Done |

---

## Phase 2: Assessment Validation 🔄 IN PROGRESS

**Goal:** Ensure the AI assessment is accurate, fair, and useful for educators.

### 2.1 Prompt Tuning
- [x] Add stricter detection of AI over-dependence
- [x] Add copy-paste delegation red flags
- [ ] Test with diverse student submissions
- [ ] Calibrate against human grader scores
- [ ] Adjust scoring thresholds based on feedback

### 2.2 Testing & Validation
- [ ] Collect 10-20 real student submissions
- [ ] Have human graders score the same submissions
- [ ] Compare AI scores vs human scores
- [ ] Identify criteria that need adjustment
- [ ] Document inter-rater reliability

### 2.3 Rubric Refinement
- [ ] Review rubric with educators
- [ ] Clarify ambiguous criteria
- [ ] Add examples for each scoring level
- [ ] Consider discipline-specific variations

### 2.4 Edge Cases
- [ ] Test with minimal AI usage
- [ ] Test with heavy AI usage (delegation)
- [ ] Test with genuine collaboration
- [ ] Test with manipulated/fake chat histories
- [ ] Test with non-English submissions

---

## Phase 3: Multi-User Support (Future)

### 3.1 User Authentication

**Options (in order of complexity):**

| Method | Effort | Best For |
|--------|--------|----------|
| Email/Password | Low | Small pilots |
| Google OAuth | Medium | Student ease |
| Microsoft OAuth | Medium | Schools with O365 |
| SAML/SSO | High | Institutional deployment |
| LTI Integration | High | LMS integration (Canvas, Blackboard) |

**Implementation Plan:**
```
1. Add FastAPI-Users or custom JWT auth
2. Create User model (id, email, name, role, institution_id)
3. Add role-based access control (student, instructor, admin)
4. Protect API routes with auth middleware
5. Add login/register UI in frontend
```

### 3.2 Data Model Changes

```sql
-- New tables for multi-user support

CREATE TABLE institutions (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),  -- For email domain validation
    settings JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),  -- NULL if OAuth only
    role VARCHAR(50) NOT NULL,  -- 'student', 'instructor', 'admin'
    institution_id UUID REFERENCES institutions(id),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE TABLE courses (
    id UUID PRIMARY KEY,
    institution_id UUID REFERENCES institutions(id),
    instructor_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE enrollments (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    course_id UUID REFERENCES courses(id),
    role VARCHAR(50) DEFAULT 'student',  -- 'student', 'ta', 'instructor'
    enrolled_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

CREATE TABLE assignments (
    id UUID PRIMARY KEY,
    course_id UUID REFERENCES courses(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    rubric_id UUID,  -- Which rubric to use
    due_date TIMESTAMP,
    settings JSONB,  -- AI restrictions, word limits, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE submissions (
    id UUID PRIMARY KEY,
    assignment_id UUID REFERENCES assignments(id),
    student_id UUID REFERENCES users(id),
    session_id UUID REFERENCES writing_sessions(id),
    submitted_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'submitted', 'graded'
    grade VARCHAR(10),
    instructor_notes TEXT
);

-- Modify existing tables
ALTER TABLE writing_sessions ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE assessments ADD COLUMN submission_id UUID REFERENCES submissions(id);
ALTER TABLE assessments ADD COLUMN grader_id UUID REFERENCES users(id);
```

### 3.3 Assignment Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     INSTRUCTOR WORKFLOW                      │
└─────────────────────────────────────────────────────────────┘

1. Create Course
   └── Add students (email invite or bulk import)

2. Create Assignment
   ├── Title, description, instructions
   ├── Select rubric (default or custom)
   ├── Set due date
   ├── Configure AI settings
   │   ├── Allow chat sidebar? (default: yes)
   │   ├── Allow inline editing? (default: yes)
   │   ├── Allow web search? (default: yes)
   │   └── Require minimum word count?
   └── Publish to students

3. Review Submissions
   ├── See list of all submissions
   ├── Run AI assessment (batch or individual)
   ├── Review AI scores and evidence
   ├── Adjust scores if needed
   ├── Add instructor comments
   └── Release grades to students

┌─────────────────────────────────────────────────────────────┐
│                      STUDENT WORKFLOW                        │
└─────────────────────────────────────────────────────────────┘

1. View Assignments
   └── See all assignments for enrolled courses

2. Start Writing
   ├── Click "Start Assignment"
   ├── Writer opens with assignment context pre-loaded
   ├── Write with AI assistance
   ├── Auto-save tracks all progress
   └── See word count, time spent, AI usage stats

3. Submit
   ├── Click "Submit for Grading"
   ├── Confirm submission (can't edit after)
   ├── Session + essay exported automatically
   └── Receive confirmation

4. View Feedback
   ├── See grade when released
   ├── View detailed rubric scores
   ├── Read instructor comments
   └── Download PDF report
```

### 3.4 API Changes for Multi-User

```
# New endpoints

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/oauth/google

GET    /api/courses
POST   /api/courses
GET    /api/courses/{id}
PUT    /api/courses/{id}
DELETE /api/courses/{id}

GET    /api/courses/{id}/assignments
POST   /api/courses/{id}/assignments
GET    /api/assignments/{id}
PUT    /api/assignments/{id}
DELETE /api/assignments/{id}

GET    /api/assignments/{id}/submissions
POST   /api/assignments/{id}/submit
GET    /api/submissions/{id}
POST   /api/submissions/{id}/assess
PUT    /api/submissions/{id}/grade

# Modified endpoints (add auth)
GET    /api/sessions          # Filter by user
POST   /api/sessions/save     # Associate with user
GET    /api/assessments       # Filter by permissions
```

---

## Phase 4: Scalability (Future)

### 4.1 Database Migration

**SQLite → PostgreSQL**

```yaml
# docker-compose.yml addition
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: processpulse
      POSTGRES_USER: processpulse
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U processpulse"]
      interval: 5s
      timeout: 5s
      retries: 5
```

**Migration Steps:**
1. Update SQLAlchemy connection string
2. Run Alembic migrations
3. Export data from SQLite
4. Import into PostgreSQL
5. Verify data integrity

### 4.2 Redis for Queuing

**Purpose:**
- Queue AI requests for fair access
- Cache frequently accessed data
- Rate limiting per user
- Real-time notifications (WebSocket pub/sub)

```yaml
# docker-compose.yml addition
services:
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
```

**Queue Design:**
```python
# AI Request Queue
class AIRequestQueue:
    QUEUES = {
        'chat': 'high',      # Interactive, needs fast response
        'inline_edit': 'high',
        'assessment': 'low',  # Can run in background
        'batch': 'low',
    }
    
    async def submit(self, user_id: str, request_type: str, payload: dict):
        priority = self.QUEUES.get(request_type, 'medium')
        job_id = str(uuid4())
        await redis.lpush(f'queue:{priority}', json.dumps({
            'job_id': job_id,
            'user_id': user_id,
            'type': request_type,
            'payload': payload,
            'submitted_at': datetime.utcnow().isoformat()
        }))
        return job_id
    
    async def get_status(self, job_id: str):
        return await redis.hget('job_status', job_id)
```

### 4.3 Horizontal Scaling

**Architecture for 100+ Concurrent Users:**

```
                    ┌─────────────┐
                    │   Traefik   │
                    │   (LB/TLS)  │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────┴────┐       ┌────┴────┐       ┌────┴────┐
    │ Backend │       │ Backend │       │ Backend │
    │   (1)   │       │   (2)   │       │   (3)   │
    └────┬────┘       └────┬────┘       └────┬────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────┴────┐  ┌────┴────┐  ┌────┴────┐
         │ Postgres│  │  Redis  │  │ Ollama  │
         │ Primary │  │ Cluster │  │  Pool   │
         └─────────┘  └─────────┘  └─────────┘
```

**Kubernetes Option:**
```yaml
# For cloud deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: processpulse-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: processpulse-backend
  template:
    spec:
      containers:
      - name: backend
        image: processpulse/backend:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

### 4.4 GPU Resource Management

**H100 (80GB VRAM) Capacity:**

| Model | VRAM | Instances | Concurrent Requests |
|-------|------|-----------|---------------------|
| qwen3:8b | 8GB | 8-10 | 80-100 |
| qwen3:32b | 20GB | 3-4 | 30-40 |
| qwen3:72b | 45GB | 1 | 10-15 |

**Recommended Configuration:**
```yaml
# For production with H100
ollama_config:
  models:
    - name: qwen3:8b
      instances: 6
      purpose: chat, inline_edit  # Fast responses needed
    - name: qwen3:32b
      instances: 2
      purpose: assessment  # Better reasoning, can be slower
  
  routing:
    chat_requests: qwen3:8b
    inline_edit: qwen3:8b
    assessment: qwen3:32b
```

**vLLM Alternative:**
For higher throughput, consider vLLM instead of Ollama:
- Better batching
- Continuous batching for higher throughput
- PagedAttention for memory efficiency
- 2-4x higher throughput than Ollama

---

## Phase 5: Advanced Features (Future)

### 5.1 Analytics Dashboard

**For Instructors:**
- Class-wide statistics (avg scores, common weaknesses)
- Individual student progress over time
- AI usage patterns across class
- Identify students who need intervention

**For Administrators:**
- System usage metrics
- GPU utilization
- Response times
- Error rates

### 5.2 Custom Rubrics

- Instructor can create custom rubrics
- Import/export rubric templates
- Share rubrics across institution
- Discipline-specific rubric templates

### 5.3 Plagiarism Integration

- Integration with Turnitin API
- Cross-reference against submission database
- Flag similar AI prompts across students

### 5.4 LMS Integration

**LTI 1.3 Integration:**
- Launch ProcessPulse from Canvas/Blackboard/Moodle
- Single sign-on via LTI
- Grade passback to LMS gradebook
- Assignment sync

### 5.5 Mobile Support

- Responsive design for tablets
- Mobile-friendly Writer interface
- Push notifications for due dates

---

## Implementation Timeline

| Phase | Features | Effort | Priority |
|-------|----------|--------|----------|
| **Phase 2** | Assessment validation | 2-4 weeks | 🔴 HIGH |
| **Phase 3.1** | User authentication | 1-2 weeks | 🟡 MEDIUM |
| **Phase 3.2** | Assignment management | 2-3 weeks | 🟡 MEDIUM |
| **Phase 4.1** | PostgreSQL migration | 1 week | 🟡 MEDIUM |
| **Phase 4.2** | Redis queuing | 1-2 weeks | 🟢 LOW |
| **Phase 4.3** | Horizontal scaling | 2-3 weeks | 🟢 LOW |
| **Phase 5** | Advanced features | Ongoing | 🟢 LOW |

---

## Technical Debt & Improvements

### Code Quality
- [ ] Add unit tests for backend services
- [ ] Add integration tests for API endpoints
- [ ] Add E2E tests for frontend flows
- [ ] Set up CI/CD pipeline
- [ ] Add code coverage reporting

### Performance
- [ ] Profile and optimize slow endpoints
- [ ] Add database query optimization
- [ ] Implement caching for rubric data
- [ ] Optimize frontend bundle size

### Security
- [ ] Security audit of authentication
- [ ] Rate limiting on all endpoints
- [ ] Input validation and sanitization
- [ ] CORS configuration review
- [ ] Secret management (vault)

### Monitoring
- [ ] Add structured logging
- [ ] Set up error tracking (Sentry)
- [ ] Add performance monitoring (APM)
- [ ] Set up alerting for critical issues

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-10 | Use Ollama for local AI | Privacy, no API costs, works offline |
| 2025-12-10 | 80/20 assessment split | Process matters more than product |
| 2025-12-11 | TipTap for editor | Best React editor, extensible |
| 2025-12-11 | Zustand for state | Lightweight, TypeScript-friendly |
| 2025-12-11 | SQLite for MVP | Fast iteration, easy setup |
| 2025-12-12 | qwen3 for assessment | Reliable JSON mode support |
| 2025-12-12 | Polyform NC license | Free for education, protect commercial |

---

## Contributing

See [Agents.md](Agents.md) for technical documentation and session logs.

---

*This roadmap should be updated as priorities change and features are completed.*



