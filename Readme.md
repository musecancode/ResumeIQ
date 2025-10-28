# ResumeIQ – AI-Powered Resume Analyzer
ResumeIQ is an **AI-driven resume parser and reviewer** that helps candidates understand and improve their resumes.
Users can upload a PDF resume, which is then analyzed by Google Gemini (via LangChain) to extract structured data, provide resume ratings, and generate personalized upskilling suggestions — all displayed through a sleek React UI.

## Features
* **PDF Upload:** Drag & drop or select a resume for instant parsing.
* **AI-Powered Extraction:** Uses **Gemini API (Google GenAI)** to extract key details like:
  - Name, Email, Phone, Links
  - Summary, Work Experience, Education
  - Technical & Soft Skills
  - Projects, Certifications
  - Resume Rating, Improvement Areas, Upskill Suggestions
* **Database:** Structured data stored securely in **PostgreSQL**.
* **Frontend Interface:** 
  - Upload tab – upload and parse resumes  
  - History tab – list of previous uploads  
  - Details modal – view full parsed details
 * **Fully Containerized:** Easily run the app using **Docker Compose**.

## Tech stack
* **Backend**: FastAPI, asyncpg, pdfplumber, google-generativeai SDK
* **Frontend:** React (Vite), single-file app at `frontend/src/App.jsx`
* **DB:** PostgreSQL (containerized)
* **AI Model:** Gemini API via LangChain  
* **DevOps:** Docker, Docker Compose

  ---

## Quick start (recommended)
### 1. Clone the repo:
   ```
   git clone <repo-url>
   cd <repo-directory>
   ```

### 2. Modify a `.env` file in the repo root with these values:

   ```
   GOOGLE_API_KEY=your_google_ai_studio_key_here
   ```

   * Add your Gemini/Generative AI API key from Google AI Studio as `GOOGLE_API_KEY`

### 3. Start with Docker Compose:
   ```
   docker compose up -d --build
   ```

   - Frontend: [http://localhost:5173]
   - Backend API docs: [http://localhost:8000/docs]
    - Postgres: port 5432 (containerized)

4. Open the UI in your browser at `http://localhost:5173`.
   - Drag & drop or click the upload area to send a PDF.
   - After parsing, a detailed card appears. Close it to see the entry in History.


## Files of interest
* `backend/main.py` — FastAPI app and LLM calling logic.
* `frontend/src/App.jsx` — single-file React UI (Upload, History, Details).
* `docker-compose.yml` — services and env mapping.
* `Dockerfile` (frontend / backend) — container build definitions.


## Example workflow
1. Add your Google AI Studio key to `.env` as `GOOGLE_API_KEY`.
2. `docker compose up -d --build`
3. Open `http://localhost:5173`, upload a PDF. Wait a few seconds for parsing.
4. Check `GET /resumes` or click History → Details to see the parsed card.

## Screenshots
Here’s a quick preview of the project in action:
| Upload Page | History Page | Resume Details |
|--------------|---------------|----------------|
| ![Upload Page](./screenshots/ss1.png) | ![History Page](./screenshots/ss2.png) | ![Details](./screenshots/ss3.png) |
