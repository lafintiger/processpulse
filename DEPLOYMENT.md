# ProcessPulse Deployment Guide

One-command deployment for educational institutions.

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/lafintiger/processpulse.git
cd processpulse

# 2. Copy and edit configuration (optional)
cp env.example .env
# Edit .env if you need to change ports or models

# 3. Start everything
docker-compose up -d

# 4. Wait for models to download (first run only, ~5-15 minutes)
docker-compose logs -f ollama-init

# 5. Access ProcessPulse
# Open http://localhost in your browser
```

---

## System Requirements

### Minimum Requirements
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **RAM** | 16 GB | 32 GB |
| **CPU** | 4 cores | 8+ cores |
| **Disk** | 20 GB free | 50 GB free |
| **Docker** | 20.10+ | Latest |

### Disk Space Breakdown
| Component | Size |
|-----------|------|
| Docker images | ~2.5 GB |
| Chat model (llama3.1:8b) | ~4.7 GB |
| Embedding model | ~275 MB |
| Database (grows with usage) | ~100 MB initial |
| **Total** | **~7.5 GB minimum** |

### Optional: GPU Acceleration
- NVIDIA GPU with 8GB+ VRAM
- nvidia-docker2 installed
- Makes AI responses 10-50x faster

---

## Detailed Setup Instructions

### Step 1: Install Docker

**Windows:**
1. Download [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Install and restart your computer
3. Open Docker Desktop and wait for it to start

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in
```

**macOS:**
1. Download [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
2. Install and open Docker Desktop

### Step 2: Clone and Configure

```bash
# Clone the repository
git clone https://github.com/lafintiger/processpulse.git
cd processpulse

# Create your configuration file
cp env.example .env

# (Optional) Edit configuration
nano .env  # or use any text editor
```

### Step 3: Launch ProcessPulse

```bash
# Start all services
docker-compose up -d

# Watch the model download progress
docker-compose logs -f ollama-init
```

First run will:
1. Build the ProcessPulse containers (~2-5 minutes)
2. Download AI models (~5-15 minutes depending on internet speed)
3. Start all services

### Step 4: Verify Installation

```bash
# Check all services are running
docker-compose ps

# Expected output:
# NAME                        STATUS
# processpulse-frontend       Up (healthy)
# processpulse-backend        Up (healthy)
# processpulse-ollama         Up
# processpulse-perplexica     Up
# processpulse-searxng        Up
```

### Step 5: Access the Application

Open your browser to: **http://localhost**

---

## Configuration Options

### Change Ports

Edit `.env`:
```env
FRONTEND_PORT=8080        # If port 80 is taken
OLLAMA_PORT=11434
PERPLEXICA_PORT=3000
```

### Use Different AI Models

Edit `.env`:
```env
# Smaller/faster model
CHAT_MODEL=mistral:7b

# Larger/better model (needs more RAM)
CHAT_MODEL=llama3.1:70b
```

### Enable GPU Acceleration

1. Install nvidia-docker2:
```bash
# Ubuntu
sudo apt-get install nvidia-docker2
sudo systemctl restart docker
```

2. Edit `docker-compose.yml`, uncomment the GPU section under `ollama`:
```yaml
ollama:
  ...
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

3. Restart:
```bash
docker-compose down
docker-compose up -d
```

### Use External Ollama

If you already have Ollama running on your server:

1. Edit `.env`:
```env
OLLAMA_EXTERNAL=true
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

2. Comment out the `ollama` and `ollama-init` services in `docker-compose.yml`

---

## Management Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend

# Restart a service
docker-compose restart backend

# Update to latest version
git pull
docker-compose build --no-cache
docker-compose up -d

# Remove everything (including data!)
docker-compose down -v
```

---

## Troubleshooting

### "Port 80 already in use"
Edit `.env` and change `FRONTEND_PORT=8080`, then access via http://localhost:8080

### Models not downloading
```bash
# Check ollama-init logs
docker-compose logs ollama-init

# Manually pull models
docker exec -it processpulse-ollama ollama pull llama3.1:8b
docker exec -it processpulse-ollama ollama pull nomic-embed-text
```

### Out of memory
- Reduce model size in `.env`: `CHAT_MODEL=mistral:7b`
- Or increase Docker memory limit in Docker Desktop settings

### Services not starting
```bash
# Check for errors
docker-compose logs

# Rebuild everything
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Reset everything
```bash
# WARNING: This deletes all data!
docker-compose down -v
docker-compose up -d
```

---

## Production Deployment

### Using a Custom Domain

1. Set up a reverse proxy (nginx, Traefik, etc.)
2. Point your domain to the server
3. Add SSL certificate (Let's Encrypt recommended)

Example nginx config:
```nginx
server {
    listen 443 ssl;
    server_name processpulse.youruniversity.edu;
    
    ssl_certificate /etc/letsencrypt/live/processpulse.youruniversity.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/processpulse.youruniversity.edu/privkey.pem;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Backup Data

```bash
# Backup database
docker cp processpulse-backend:/app/data/process_analyzer.db ./backup/

# Backup all volumes
docker run --rm -v processpulse-data:/data -v $(pwd)/backup:/backup alpine tar cvf /backup/data.tar /data
```

---

## Support

- **Issues:** https://github.com/lafintiger/processpulse/issues
- **License:** Polyform Noncommercial 1.0.0 (free for education)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         ProcessPulse                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌────────────┐     ┌────────────┐     ┌────────────────┐     │
│   │  Frontend  │────▶│  Backend   │────▶│    Ollama      │     │
│   │  (nginx)   │     │  (FastAPI) │     │  (Local AI)    │     │
│   │   :80      │     │   :8000    │     │   :11434       │     │
│   └────────────┘     └────────────┘     └────────────────┘     │
│                            │                                     │
│                            ▼                                     │
│                      ┌────────────┐     ┌────────────────┐     │
│                      │  SQLite    │     │   Perplexica   │     │
│                      │  Database  │     │  (Web Search)  │     │
│                      └────────────┘     └────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```



