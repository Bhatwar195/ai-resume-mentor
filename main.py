from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pdfplumber
import os
import json
import re
from groq import Groq
from io import BytesIO
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

app = FastAPI(title="AI Resume Mentor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_client() -> Groq:
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not set. Add it to your .env file."
        )
    return Groq(api_key=GROQ_API_KEY)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()


def clean_json(raw: str) -> dict:
    raw = re.sub(r"```json\s*", "", raw)
    raw = re.sub(r"```\s*", "", raw)
    raw = raw.strip()
    return json.loads(raw)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def root():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        return f.read()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    job_title: str = Form(""),
    job_description: str = Form(""),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()

    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5 MB.")

    try:
        resume_text = extract_text_from_pdf(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {str(e)}")

    if not resume_text or len(resume_text) < 100:
        raise HTTPException(
            status_code=400,
            detail="Not enough text extracted. Make sure the PDF is not a scanned image."
        )

    jd_section = ""
    if job_title or job_description:
        jd_section = (
            f"\nTARGET JOB TITLE: {job_title}"
            f"\nTARGET JOB DESCRIPTION:\n{job_description}"
        )

    prompt = f"""You are a senior technical recruiter and resume expert.
Analyze the resume below and return ONLY a valid JSON object.
Do NOT include markdown fences, backticks, or any text before or after the JSON.

RESUME:
{resume_text}
{jd_section}

Return this exact JSON structure:
{{
  "score": <integer 1-10>,
  "score_reasoning": "<2-3 sentences explaining the score>",
  "professional_summary": "<exactly 2-sentence professional summary for top of resume>",
  "extracted_skills": ["skill1", "skill2"],
  "extracted_projects": ["Project Name - brief description"],
  "key_keywords": ["keyword1", "keyword2"],

  "ats": {{
    "score": <integer 1-100>,
    "score_label": "<Poor|Fair|Good|Excellent>",
    "score_reasoning": "<2 sentences on ATS score>",
    "missing_keywords": ["keyword1", "keyword2"],
    "formatting_issues": ["issue1", "issue2"],
    "keyword_density_tips": ["tip1", "tip2"],
    "section_present": {{
      "contact": true,
      "summary": false,
      "skills": true,
      "experience": true,
      "education": true,
      "projects": false,
      "certifications": false
    }}
  }},

  "section_feedback": {{
    "contact_info": "<feedback>",
    "summary": "<feedback>",
    "skills": "<feedback>",
    "experience": "<feedback>",
    "projects": "<feedback>",
    "education": "<feedback>"
  }},

  "improvements": [
    {{
      "priority": "High",
      "section": "<section name>",
      "issue": "<what is wrong>",
      "fix": "<exactly what to do to fix it>"
    }}
  ],

  "strengths": ["strength1", "strength2", "strength3"],
  "missing_skills": ["skill1", "skill2"],
  "jd_alignment_score": <integer 1-10 or null if no JD provided>,
  "jd_gaps": ["gap1", "gap2"],
  "ats_keywords_missing": ["keyword1", "keyword2"]
}}

Rules:
- Return at least 5 improvements.
- Set priority to High, Medium, or Low only.
- If no job description is provided, set jd_alignment_score to null and jd_gaps to [].
- Return ONLY the JSON object, nothing else."""

    try:
        client = get_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=3000,
        )
        raw = response.choices[0].message.content.strip()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {str(e)}")

    try:
        result = clean_json(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"LLM returned invalid JSON. Please try again. Error: {str(e)}"
        )

    result["filename"] = file.filename
    result["has_jd"] = bool(job_title or job_description)
    result["resume_text"] = resume_text

    return JSONResponse(content=result)


# ─── Chatbot ──────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    message: str
    resume_text: Optional[str] = ""
    job_title: Optional[str] = ""
    job_description: Optional[str] = ""
    history: Optional[list] = []


@app.post("/chat")
async def resume_chat(body: ChatMessage):
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    system_prompt = """You are an expert resume coach and career advisor. You help users improve their resumes, prepare for interviews, and navigate job applications.

You have deep expertise in:
- Resume writing best practices and ATS optimization
- Identifying skill gaps and suggesting improvements
- Rewriting weak bullet points into strong, quantified achievements
- Tailoring resumes for specific job descriptions
- Career advice for students and early professionals

Guidelines:
- Be concise, direct, and actionable.
- Use short paragraphs. Never use bullet points unless listing 3 or more distinct items.
- Always back advice with specific reasoning.
- If resume text is provided, reference it specifically in your answers."""

    context = ""
    if body.resume_text and body.resume_text.strip():
        context += f"\n\nThe user has shared their resume. Content:\n---\n{body.resume_text[:3000]}\n---"
    if body.job_title and body.job_title.strip():
        context += f"\n\nTarget Job Title: {body.job_title}"
    if body.job_description and body.job_description.strip():
        context += f"\n\nTarget Job Description:\n{body.job_description[:1500]}"

    messages = [{"role": "system", "content": system_prompt + context}]

    for turn in (body.history or [])[-10:]:
        role = turn.get("role", "")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": body.message.strip()})

    try:
        client = get_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.5,
            max_tokens=800,
        )
        reply = response.choices[0].message.content.strip()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {str(e)}")

    return {"reply": reply}