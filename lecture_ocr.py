"""
Lecture materials OCR via LLM.
Flow: get file as bytes -> convert to images (base64) -> send each image to LLM for OCR -> structured JSON per slide.
Multiple files: process each file separately, then combine into one JSON per course for comparison.
"""
import base64
import io
import json
import os
import re
import subprocess
import tempfile
import time

# Optional: pdf2image for PDF -> images (requires poppler)
try:
    from pdf2image import convert_from_bytes
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False

# PyPDF2 for fallback PDF text if no pdf2image
try:
    import PyPDF2
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False


def _pdf_to_base64_images(file_bytes):
    """Convert PDF bytes to list of (page_number, base64_png)."""
    if not PDF2IMAGE_AVAILABLE:
        return None
    try:
        images = convert_from_bytes(file_bytes, dpi=150, fmt="png")
        out = []
        for i, img in enumerate(images, 1):
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.standard_b64encode(buf.getvalue()).decode("ascii")
            out.append((i, b64))
        return out
    except Exception as e:
        print(f"  pdf2image error: {e}")
        return None


def _convert_to_pdf_with_libreoffice(source_path, ext):
    """Convert PPTX or DOCX to PDF using LibreOffice headless. Returns path to PDF or None."""
    # Try common LibreOffice executable names
    for cmd in ["libreoffice", "soffice"]:
        try:
            out_dir = tempfile.mkdtemp()
            subprocess.run(
                [cmd, "--headless", "--convert-to", "pdf", "--outdir", out_dir, source_path],
                check=True,
                capture_output=True,
                timeout=120,
            )
            base = os.path.splitext(os.path.basename(source_path))[0]
            pdf_path = os.path.join(out_dir, base + ".pdf")
            if os.path.exists(pdf_path):
                return pdf_path
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            continue
    return None


def file_bytes_to_base64_images(file_bytes, file_name, extension):
    """
    Convert a lecture file (PDF, PPTX, DOCX) to a list of (page/slide number, base64 PNG).
    Returns list of tuples (page_num, base64_string) or None if conversion not possible.
    """
    ext = (extension or "").lower().lstrip(".")
    if not ext and file_name:
        ext = os.path.splitext(file_name)[1].lstrip(".").lower()

    # PDF: direct to images
    if ext == "pdf":
        return _pdf_to_base64_images(file_bytes)

    # PPTX / DOCX: write to temp file -> LibreOffice -> PDF -> images
    if ext in ("pptx", "docx", "ppt", "doc"):
        suffix = "." + ext
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        try:
            pdf_path = _convert_to_pdf_with_libreoffice(tmp_path, ext)
            if pdf_path and os.path.exists(pdf_path):
                with open(pdf_path, "rb") as f:
                    pdf_bytes = f.read()
                # Remove temp PDF dir (parent of pdf_path)
                try:
                    import shutil
                    shutil.rmtree(os.path.dirname(pdf_path), ignore_errors=True)
                except Exception:
                    pass
                return _pdf_to_base64_images(pdf_bytes)
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
    return None


def ocr_slide_with_gemini(image_base64, slide_number, file_name, api_key, client=None, llm_model=None):
    """
    Send one slide image to Gemini for OCR. Returns structured dict with slide_number, text, bullets, title, notes.
    """
    from prompt_loader import format_prompt

    text_prompt = format_prompt(
        "slide_ocr",
        slide_number=slide_number,
        file_name=file_name or "lecture"
    )

    # Build multimodal content: image + text
    contents = [
        {
            "parts": [
                {"inline_data": {"mime_type": "image/png", "data": image_base64}},
                {"text": text_prompt}
            ]
        }
    ]

    if client is None:
        from google import genai
        client = genai.Client(api_key=api_key)

    if not llm_model:
        raise ValueError("llm_model is required for slide OCR")

    response = client.models.generate_content(
        model=llm_model,
        contents=contents
    )
    raw = (response.text or "").strip()

    # Parse JSON from response (allow markdown code block wrapper)
    if "```json" in raw:
        raw = re.sub(r"^.*?```json\s*", "", raw)
        raw = re.sub(r"\s*```.*$", "", raw)
    elif "```" in raw:
        raw = re.sub(r"^.*?```\s*", "", raw)
        raw = re.sub(r"\s*```.*$", "", raw)
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {
            "slide_number": slide_number,
            "text": raw[:50000] if raw else "",
            "bullets": [],
            "title": "",
            "notes": ""
        }

    data["slide_number"] = data.get("slide_number", slide_number)
    if "error" not in data:
        data.setdefault("text", "")
        data.setdefault("bullets", [])
        data.setdefault("title", "")
        data.setdefault("notes", "")
    return data


def process_lecture_file_with_ocr(file_url, headers, file_name, file_id, extension, api_key, client=None, llm_model=None):
    """
    Download one lecture file, convert to images, OCR each with LLM, return structured result per file.
    Returns dict: { file_id, file_name, slides: [ { slide_number, text, bullets, title, notes }, ... ] }
    If conversion to images fails, returns None (caller can fall back to text extraction).
    """
    import requests

    try:
        resp = requests.get(file_url, headers=headers, timeout=60)
        if resp.status_code != 200:
            print(f"  Failed to download {file_name}: {resp.status_code}")
            return None
        file_bytes = resp.content
    except Exception as e:
        print(f"  Error downloading {file_name}: {e}")
        return None

    images = file_bytes_to_base64_images(file_bytes, file_name, extension)
    if not images:
        print(f"  Could not convert {file_name} to images (install pdf2image + poppler; for PPTX/DOCX install LibreOffice)")
        return None

    if client is None:
        from google import genai
        client = genai.Client(api_key=api_key)

    if not llm_model:
        print("  OCR skipped: no llm_model set")
        return None

    slides = []
    for page_num, b64 in images:
        try:
            slide_data = ocr_slide_with_gemini(b64, page_num, file_name, api_key, client=client, llm_model=llm_model)
            slides.append(slide_data)
            time.sleep(0.3)  # gentle rate limit
        except Exception as e:
            print(f"  OCR error slide {page_num} of {file_name}: {e}")
            slides.append({
                "slide_number": page_num,
                "text": "",
                "bullets": [],
                "title": "",
                "notes": "",
                "error": str(e)
            })

    return {
        "file_id": file_id,
        "file_name": file_name,
        "extension": extension or os.path.splitext(file_name)[1].lstrip("."),
        "slide_count": len(slides),
        "slides": slides
    }


def combine_ocr_lecture_files(per_file_results):
    """
    Combine per-file OCR results into one JSON per course (for comparison).
    Returns dict with: total_files, file_index, files (per-file OCR data), combined_content (single string).
    """
    if not per_file_results:
        return None

    file_index = []
    combined_parts = []

    for idx, file_data in enumerate(per_file_results, 1):
        name = file_data.get("file_name", f"File {idx}")
        file_index.append({
            "index": idx,
            "name": name,
            "file_id": file_data.get("file_id"),
            "slide_count": file_data.get("slide_count", 0)
        })
        for s in file_data.get("slides", []):
            text = s.get("text", "")
            title = s.get("title", "")
            if title:
                combined_parts.append(f"[{name} - Slide {s.get('slide_number', '')}] {title}\n{text}")
            else:
                combined_parts.append(f"[{name} - Slide {s.get('slide_number', '')}]\n{text}")

    combined_content = "\n\n".join(combined_parts)

    return {
        "id": "lectures_combined",
        "name": "All Lecture Materials (OCR Combined)",
        "type": "lectures_combined",
        "total_files": len(per_file_results),
        "file_index": file_index,
        "files": per_file_results,
        "combined_content": combined_content,
        "total_length": len(combined_content),
        "graded": False,
        "source_type": "combined_lectures_ocr"
    }
