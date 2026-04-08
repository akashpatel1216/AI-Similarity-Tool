"""
Copy this file to config.py and adjust (config.py is gitignored).

Or set environment variables — user-entered keys in the app UI take priority.

AI_API_KEY / GEMINI_API_KEY: optional server default for LLM calls (same value; use either name).
"""

import os

AI_API_KEY = (os.environ.get("AI_API_KEY") or os.environ.get("GEMINI_API_KEY") or "").strip()
GEMINI_API_KEY = AI_API_KEY  # alias

LLM_MODEL = (
    os.environ.get("LLM_MODEL")
    or os.environ.get("AI_MODEL")
    or os.environ.get("GEMINI_MODEL")
    or ""
).strip()

# Default Canvas instance URL (users can change in the app)
CANVAS_BASE_URL = os.environ.get(
    "CANVAS_BASE_URL", "https://usflearn.instructure.com"
).strip()
