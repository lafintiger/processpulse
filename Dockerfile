# ProcessPulse Backend Dockerfile
# Multi-stage build for smaller image size

# Stage 1: Build dependencies
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY app/ ./app/
COPY RubricDocs/ ./RubricDocs/
COPY run.py .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV DATABASE_URL=sqlite+aiosqlite:///./data/process_analyzer.db
ENV OLLAMA_BASE_URL=http://ollama:11434
ENV PERPLEXICA_BASE_URL=http://perplexica:3000

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run the application
CMD ["python", "run.py"]

