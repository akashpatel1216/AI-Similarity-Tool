# AI Course Similarity Tool

Compares course materials (syllabus, lecture files, graded assignments) between two Canvas courses using an AI/LLM API (currently Google Gemini-compatible endpoints).

**Built by Akash Patel.**  
LinkedIn: [www.linkedin.com/in/akashp1216](https://www.linkedin.com/in/akashp1216)

---

## Quick start (run the app)

In a terminal, go to the project folder (the one that contains `app.py`).

**First time** on this machine — install dependencies, then start:

```bash
pip install -r requirements.txt
python app.py
```

**Next times** — dependencies are already installed, so only:

```bash
python app.py
```

When it’s running, open in your browser:

**http://localhost:5000**

---

## Obtain a Canvas API token

You may follow the steps below or watch this short video tutorial:  
[https://www.youtube.com/watch?v=UCskVWcoGOg](https://www.youtube.com/watch?v=UCskVWcoGOg)

### Steps to generate a Canvas API token

1. Log in to Canvas: [https://usflearn.instructure.com](https://usflearn.instructure.com)
2. Go to **Account → Settings**
3. Scroll down to **Approved Integrations**
4. Click **+ New Access Token**
5. Set the purpose to: **“Assessment Data Retrieval”**
6. Enter an expiration date
7. Click **Generate Token**
8. Copy and securely save the token

**Important:** You will not be able to view this token again.

### What you need to run comparisons

Have all of these ready before you use the app:

- **Canvas API token** — from the steps above (you can add up to five professor profiles, each with its own token).
- **LLM API key** — your AI provider’s API key; enter it under **Configure Canvas** in the app.
- **Exact model name** — the precise model id your provider expects (e.g. `gemini-2.5-flash`); enter it in the same **Configure Canvas** panel as the LLM key.

---

## Prerequisites

- Python 3.10+
- A **Canvas API token**, **LLM API key**, and **exact model name** (see [Obtain a Canvas API token](#obtain-a-canvas-api-token) and [Setup](#setup))

---

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. AI / LLM API key (per user)

**Recommended:** Under **Configure Canvas**, enter **AI / LLM API key** and **Model name** (the model id your provider expects, e.g. `gemini-2.5-flash`). Values are kept in the browser session and sent to **your** Flask server when you run extraction/comparison.

**Optional server default:** Copy `config.example.py` to `config.py` (gitignored) and/or set environment variables:

```bash
export AI_API_KEY="your-key"           # preferred name
# or
export GEMINI_API_KEY="your-key"       # still supported
export LLM_MODEL="gemini-2.5-flash"    # or AI_MODEL / GEMINI_MODEL
export CANVAS_BASE_URL="https://your-institution.instructure.com"
```

Request body may send `ai_api_key` / `llm_api_key` / `gemini_api_key`, and `llm_model` / `ai_model` for the model id. Browser values override server env/config.

> For USF the default Canvas URL is `https://usflearn.instructure.com`.

### 3. Canvas API token

See **[Obtain a Canvas API token](#obtain-a-canvas-api-token)** above (video + step-by-step).

---

## How to Use

1. **Configure Canvas + AI**  
   Open **Configure Canvas**. Add your **AI / LLM API key** and **model name** (required for syllabus filtering, lecture OCR, and reports). Then add up to **5 Canvas API tokens** with **Add API Key**.  
   Each Canvas key is validated and mapped to that professor's identity + courses.

2. **Pick Professor A and Professor B**  
   You can use **two different** saved profiles, or the **same** profile for both sides if you only have one API key — in that case pick **two different courses** to compare.  
   Course dropdowns are filtered to each selected professor's courses.

3. **Select Course A and Course B**  
   Pick one course under each professor.  
   Course labels include term info when available (for example: `Fall 2024`).

4. **Choose material type**  
   - **Syllabus** — compares course description, learning outcomes, and topics/schedule
   - **Lecture Materials** — compare selected lecture files (`.pdf`, `.pptx`, `.docx`)
   - **Graded Materials** — compare selected assignments/quizzes

5. **Select specific items (if applicable)**  
   For lecture and graded-material flows, select exactly which files/items to include.

6. **Run extraction and comparison**  
   The app extracts materials for each side using that side's API token, then Gemini generates a concept-overlap report.

7. **Review report + export**  
   On the report page you can copy text or export the report as a PDF.

---

## Customising AI Prompts

All prompts sent to Gemini live in the `prompts/` folder as JSON files. You can view and edit them directly from the app via the **Prompts** tab in the navigation, or edit the JSON files manually:

| File | Purpose |
|------|---------|
| `prompts/syllabus_filtering.json` | Extract only description/outcomes/topics from raw syllabus |
| `prompts/syllabus_comparison.json` | Concept overlap report for syllabus |
| `prompts/lectures_comparison.json` | Concept overlap report for lecture materials |
| `prompts/generic_comparison.json` | Concept overlap report for generic material sets |
| `prompts/material_comparison.json` | Pairwise material-level concept overlap |
| `prompts/quiz_question_comparison.json` | Pairwise quiz-question concept overlap |

---

## Export as PDF

- On the comparison report page, use **Export as PDF**
- Includes title, course info, term info, full report body, and page footer
- Filename format: `Similarity_Report_<CourseA>_and_<CourseB>.pdf`

---

## Data Storage

Extracted course data is saved under `data/courses/course_{id}/`:

```
data/courses/course_12345/
├── metadata.json
├── syllabus/
│   ├── syllabus_filtered.json
│   └── syllabus_raw.json
├── graded_assignments/
│   └── graded_assignments_combined.json
└── lecture_materials/
    └── lectures_combined.json
```

Re-running an extraction for **Lecture Materials** or **Graded Materials** always fetches fresh data. Syllabus is cached after the first extraction; use **Force Refresh** if you need to re-pull it.
