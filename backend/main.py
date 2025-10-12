import os, re, io, json, asyncio, pdfplumber, asyncpg
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai

DATABASE_URL = os.getenv("DATABASE_URL", "postgres://user:pass@db:5432/resumes")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/data/uploads")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def create_pool_with_retry(dsn, attempts=20, delay=1):
    for i in range(attempts):
        try:
            return await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=4)
        except Exception as e:
            print(f"asyncpg connect attempt {i+1}/{attempts} failed: {e}")
            await asyncio.sleep(delay)
    raise RuntimeError("Failed to connect to Postgres after retries")

@app.on_event("startup")
async def startup():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    app.state.pool = await create_pool_with_retry(DATABASE_URL)
    async with app.state.pool.acquire() as c:
        await c.execute(
            """
            DROP TABLE IF EXISTS resumes;  -- Recreate table to ensure schema is correct
            CREATE TABLE IF NOT EXISTS resumes (
                id SERIAL PRIMARY KEY,
                filename TEXT NOT NULL,
                uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                display_name TEXT,
                email TEXT,
                phone TEXT,
                linkedin TEXT,
                portfolio TEXT,
                summary TEXT,
                work_experience JSONB,
                education JSONB,
                technical_skills JSONB,
                soft_skills JSONB,
                projects JSONB,
                certifications JSONB,
                resume_rating INTEGER,
                improvement_areas TEXT,
                upskill_suggestions JSONB,
                llm_raw TEXT
            )
            """
        )

def pdf_to_text_bytes(b: bytes) -> str:
    with pdfplumber.open(io.BytesIO(b) if isinstance(b, (bytes, bytearray)) else b) as pdf:
        parts = []
        for p in pdf.pages:
            t = p.extract_text()
            if t:
                parts.append(t)
    return "\n".join(parts)

def pdf_to_text(path: str) -> str:
    parts = []
    with pdfplumber.open(path) as pdf:
        for p in pdf.pages:
            t = p.extract_text()
            if t:
                parts.append(t)
    return "\n".join(parts)

def extract_json_from_text(raw: str):
    if not raw:
        return None
    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None

def build_prompt(resume_text: str) -> str:
    return (
        "You are an expert technical recruiter and career coach. Analyze the following resume text and extract the information into a valid JSON object. "
        "The JSON object must conform to the following structure, and all fields must be populated. Do not include any text or markdown formatting before or after the JSON object.\n\n"
        "Resume Text:\n\"\"\"\n" + resume_text + "\n\"\"\"\n\n"
        "JSON Structure:\n{\n"
        '  "name": "string | null",\n'
        '  "email": "string | null",\n'
        '  "phone": "string | null",\n'
        '  "linkedin_url": "string | null",\n'
        '  "portfolio_url/github": "string | null",\n'
        '  "summary": "string | null",\n'
        '  "work_experience": [{ "role": "string", "company": "string", "duration": "string", "description": ["string"] }],\n'
        '  "education": [{ "degree": "string", "institution": "string", "graduation_year": "string" }],\n'
        '  "technical_skills": ["string"],\n'
        '  "soft_skills": ["string"],\n'
        '  "projects": [{"name":"string","description":"string"}],\n'
        '  "certifications": ["string"],\n'
        '  "resume_rating": "number (1-10)",\n'
        '  "improvement_areas": "string",\n'
        '  "upskill_suggestions": ["string"]\n}\n'
    )

def call_gemini_parse(text: str):
    prompt = build_prompt(text[:30000])
    models_to_try = ["gemini-2.5-flash"]
    last_raw = None
    for name in models_to_try:
        try:
            model = genai.GenerativeModel(name)
            resp = model.generate_content(prompt)
            raw = resp.text if hasattr(resp, "text") else str(resp)
            last_raw = raw
            parsed = extract_json_from_text(raw)
            if parsed is not None:
                parsed["llm_raw"] = raw
                return parsed
        except Exception as e:
            print(f"model {name} failed: {e}")
            continue
    return {"llm_error": "all_models_failed_or_no_valid_json", "llm_raw": last_raw}

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF resumes supported")

    dest = os.path.join(UPLOAD_DIR, f"{os.urandom(4).hex()}_{file.filename}")
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    text = pdf_to_text(dest)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")

    parsed = call_gemini_parse(text)
    if parsed.get("llm_error"):
        raise HTTPException(status_code=500, detail="LLM failed to produce valid JSON")

    name = parsed.get("name")
    email = parsed.get("email")
    phone = parsed.get("phone")
    linkedin_url = parsed.get("linkedin_url")
    portfolio_url = parsed.get("portfolio_url/github") or parsed.get("portfolio_url") or parsed.get("github")
    summary = parsed.get("summary")
    work_experience = parsed.get("work_experience") or []
    education = parsed.get("education") or []
    technical_skills = parsed.get("technical_skills") or []
    soft_skills = parsed.get("soft_skills") or []
    projects = parsed.get("projects") or []
    certifications = parsed.get("certifications") or []
    resume_rating = parsed.get("resume_rating")
    improvement_areas = parsed.get("improvement_areas")
    upskill_suggestions = parsed.get("upskill_suggestions") or []
    llm_raw = parsed.get("llm_raw")

    async with app.state.pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO resumes (
                filename, display_name, email, phone, linkedin, portfolio, summary,
                work_experience, education, technical_skills, soft_skills, projects, certifications,
                resume_rating, improvement_areas, upskill_suggestions, llm_raw
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
            ) RETURNING *
            """,
            file.filename,
            name, email, phone, linkedin_url, portfolio_url, summary,
            json.dumps(work_experience),
            json.dumps(education),
            json.dumps(technical_skills),
            json.dumps(soft_skills),
            json.dumps(projects),
            json.dumps(certifications),
            resume_rating,
            improvement_areas,
            json.dumps(upskill_suggestions),
            llm_raw
        )

    resp = dict(row)
    if "uploaded_at" in resp:
        resp.pop("uploaded_at", None)
    return JSONResponse(resp)

@app.get("/resumes")
async def list_resumes():
    async with app.state.pool.acquire() as c:
        rows = await c.fetch(
            """
            SELECT id, filename, display_name as name, email, phone, resume_rating 
            FROM resumes ORDER BY id DESC
            """
        )
    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "file_name": r["filename"],
            "name": r["name"],
            "email": r["email"],
            "phone": r["phone"],
            "resume_rating": r["resume_rating"]
        })
    return out

@app.get("/resumes/{rid}")
async def get_resume(rid: int):
    async with app.state.pool.acquire() as c:
        row = await c.fetchrow(
            """
            SELECT id, filename, display_name as name, email, phone, linkedin as linkedin_url,
                   portfolio as portfolio_url, summary, work_experience, education, technical_skills,
                   soft_skills, projects, certifications, resume_rating, improvement_areas,
                   upskill_suggestions, llm_raw
            FROM resumes WHERE id=$1
            """, 
            rid
        )
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id": row["id"],
        "file_name": row["filename"],
        "name": row["name"],
        "email": row["email"],
        "phone": row["phone"],
        "linkedin_url": row["linkedin_url"],
        "portfolio_url": row["portfolio_url"],
        "summary": row["summary"],
        "work_experience": row["work_experience"],
        "education": row["education"],
        "technical_skills": row["technical_skills"],
        "soft_skills": row["soft_skills"],
        "projects": row["projects"],
        "certifications": row["certifications"],
        "resume_rating": row["resume_rating"],
        "improvement_areas": row["improvement_areas"],
        "upskill_suggestions": row["upskill_suggestions"],
        "llm_raw": row["llm_raw"]
    }