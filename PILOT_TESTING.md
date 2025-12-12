# ProcessPulse Pilot Testing Guide

Quick setup for student pilot testing.

## Desktop Setup (5090 GPU)

### 1. Clone & Install

```powershell
# Clone
git clone https://github.com/lafintiger/processpulse.git
cd processpulse

# Python backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Frontend
cd frontend
npm install
cd ..
```

### 2. Setup Ollama Models

```powershell
# Pull required models (use your 5090!)
ollama pull qwen3:32b       # Best quality for assessment (19GB) - OR use qwen3:latest (4.9GB)
ollama pull bge-m3          # Embeddings

# Verify
ollama list
```

### 3. Start the App

**Terminal 1 - Backend:**
```powershell
.\venv\Scripts\Activate.ps1
python run.py
# Runs at http://localhost:8000
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev -- --host
# Runs at http://localhost:5175 and your LAN IP
```

### 4. Setup ngrok

```powershell
# Expose frontend to internet
ngrok http 5175

# You'll get a URL like: https://abc123.ngrok.io
# Share THIS URL with students
```

---

## Student Instructions

Share this with your pilot students:

---

### For Students: How to Use ProcessPulse

1. **Go to the URL** your instructor gave you
2. Click **"Writer"**
3. Click **"New Document"**
4. **Enter your name** (required) and optional Student ID
5. Enter a **document title** and the assignment prompt
6. Click **"Create"**
7. **Write your essay** in the editor
8. **Use the AI chat** on the right side - this is expected and encouraged!
9. When done, click the green **"Submit"** button
10. You'll see a confirmation - your work is now saved!

**Tips:**
- Right-click on selected text for AI editing options
- Press Ctrl+F for Find, Ctrl+H for Find & Replace
- Press Ctrl+/ for keyboard shortcuts help
- Your work auto-saves, but always click Submit when done

---

## Instructor Workflow

### Viewing Submissions

1. Go to the home page
2. Click **"Submissions"**
3. Browse all student submissions
4. Download MD (essay) or JSON (full session data) files

### Assessing a Submission

1. Go to **"Analyzer"**
2. Upload the student's essay (MD file)
3. Upload the session JSON file
4. Click **"Analyze Submission"**
5. Wait for AI assessment (~1-3 minutes)
6. Review scores and evidence
7. Export PDF report if needed

---

## Troubleshooting

### "Cannot connect to backend"
- Make sure `python run.py` is running in Terminal 1
- Check http://localhost:8000/health

### "AI provider not connected"
- Make sure Ollama is running: `ollama serve`
- Verify models: `ollama list`

### Students can't access the URL
- Make sure ngrok is running
- Share the HTTPS URL (not HTTP)
- Check firewall isn't blocking

### Assessment returns all zeros
- The model might not support JSON mode
- Use `qwen3:latest` or `qwen3:32b`, NOT `gpt-oss:latest`

### Ollama hanging
```powershell
# Kill and restart
taskkill /f /im ollama.exe
ollama serve
```

---

## Disk Space Needed

| Component | Size |
|-----------|------|
| qwen3:32b (recommended) | ~19 GB |
| qwen3:latest (faster) | ~4.9 GB |
| bge-m3 (embeddings) | ~1.2 GB |
| Node modules | ~300 MB |
| Python venv | ~200 MB |

---

## Quick Verification Checklist

- [ ] `python run.py` starts without errors
- [ ] `npm run dev -- --host` shows local + network URLs
- [ ] http://localhost:5175 loads the app
- [ ] "Writer" → "New Document" works
- [ ] AI chat responds (green indicator)
- [ ] Submit button saves to server
- [ ] "Submissions" dashboard shows the test submission
- [ ] ngrok URL works from phone/another device

---

*Good luck with your pilot! 🚀*

