# AI Resume Mentor

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-LLM-orange?style=flat-square)
![HTML](https://img.shields.io/badge/HTML5-CSS3-E34F26?style=flat-square&logo=html5&logoColor=white)
![Render](https://img.shields.io/badge/Deployed%20on-Render-46E3B7?style=flat-square&logo=render&logoColor=white)

AI Resume Mentor is an AI-powered web application that helps students and professionals analyze and improve their resumes using Large Language Models (LLMs). The platform allows users to upload their resume and optionally provide a job description, after which the system evaluates the resume, identifies missing skills, and generates actionable suggestions for improvement.

---

## Demo

**[Watch Demo Video](#)** — [Google Drive link](https://drive.google.com/file/d/1PGd-SDOWJFmXJrXqvAY0WeiV6MpixDoE/view?usp=sharing)

**[Live App](#)** - https://ai-resume-mentor.onrender.com/

---

## Features

- **Resume Scoring** — rates your resume out of 10 for clarity and impact
- **ATS Score** — 0 to 100 score with label (Poor / Fair / Good / Excellent)
- **Section Feedback** — detailed feedback for Contact, Summary, Skills, Experience, Projects, Education
- **Improvement Suggestions** — prioritized High / Medium / Low with specific fixes
- **Professional Summary** — AI-generated 2-sentence summary ready to paste
- **JD Alignment** — compares resume against a job description, shows missing skills and gaps
- **Resume Coach Chatbot** — conversational AI with full resume context for personalized advice

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI (Python 3.11) |
| LLM | Groq API — llama-3.3-70b-versatile |
| PDF Parsing | pdfplumber |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Deployment | Render |

---

## Project Structure

```
ai-resume-mentor/
├── main.py                  # FastAPI app — all routes and LLM logic
├── requirements.txt         # Python dependencies
├── render.yaml              # Render deployment config
├── .python-version          # Pins Python 3.11 for Render
├── .env.example             # Environment variable template
├── .gitignore
├── README.md
├── templates/
│   └── index.html           # Frontend SPA
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

---

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/ai-resume-mentor.git
cd ai-resume-mentor

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
cp .env.example .env
# Edit .env and add your Groq API key

# 5. Run the server
uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000` in your browser.

> Get a free Groq API key at [console.groq.com](https://console.groq.com)

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Your Groq API key — get it from console.groq.com |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serves the frontend |
| POST | `/analyze` | Analyzes uploaded PDF resume |
| POST | `/chat` | Resume coach chatbot |
| GET | `/health` | Health check |

---
AI Resume Mentor helps users analyze, improve, and align their resumes with modern job requirements using AI.
