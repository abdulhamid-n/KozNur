"""KoʻzNur — FastAPI backend (Phase A).

ARCHITECTURE.md §5 contract:
  [ React (Vite + Tailwind) ] --HTTP--> [ FastAPI + PyTorch + pytorch-grad-cam ]

Endpoints:
  POST /predict  — multipart fundus image -> JSON (grade, grade_label,
                   referable, confidence, probabilities[5], gradcam_png_base64,
                   recommendation). Shape matches §5 verbatim.
  GET  /health   — readiness + device + honest Phase-A disclaimer (§6).
  GET  /samples  — curated demo gallery manifest (§5).
  /samples/<f>   — static mount serving the gallery images.

Framing rule (§1, non-negotiable): triage / decision support, NOT diagnosis.
Predictions are real model outputs and are never fabricated.
"""

from __future__ import annotations

import io
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

from . import config
from .model_runner import dr_model
from .samples import load_manifest

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("koznur.api")

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB guard for fundus uploads


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-warm the ~343 MB model at startup so the first /predict isn't slow."""
    logger.info("KoʻzNur backend starting — pre-loading DR model ...")
    try:
        dr_model.load()
        logger.info("Model ready on device '%s'.", dr_model.device)
    except Exception:  # noqa: BLE001 — log + keep server up; /health reports not-ready
        logger.exception("Model failed to load at startup; /predict will 503.")
    yield
    logger.info("KoʻzNur backend shutting down.")


app = FastAPI(
    title="KoʻzNur — Diabetic Retinopathy Triage API",
    description=(
        "Phase-A triage assistant. Grades fundus photos on the ICDR 0–4 scale, "
        "flags referable DR (grade ≥ 2), and returns a Grad-CAM overlay. "
        "Triage / decision support, NOT diagnosis."
    ),
    version="0.1.0-phaseA",
    lifespan=lifespan,
)

# Open CORS to the Vite dev origin (ARCHITECTURE.md §5 frontend).
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static mount for gallery images referenced by /samples url fields.
if config.SAMPLES_DIR.exists():
    app.mount("/samples", StaticFiles(directory=str(config.SAMPLES_DIR)), name="samples")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    """Readiness + environment + honest Phase-A framing (§6)."""
    return {
        "status": "ok" if dr_model.is_loaded else "loading",
        "model_loaded": dr_model.is_loaded,
        "model_id": config.MODEL_ID,
        "device": dr_model.device,
        "phase": config.PHASE,
        "task": "diabetic-retinopathy-triage",
        "framing": "triage / decision support, NOT diagnosis",
        "icdr_labels": config.ICDR_LABELS,
        "referable_threshold": config.REFERABLE_THRESHOLD,
        "preprocessing": {
            "scale_radius_crop": True,
            "ben_graham": True,
            "input_size": 256,
            "normalization": "Ben-Graham scale-radius @288 → resize 256 → ImageNet mean/std",
        },
        "disclaimer": config.MODEL_DISCLAIMER,
    }


@app.get("/samples")
def samples() -> dict:
    """Curated demo fundus gallery manifest. Images served at /samples/<file>."""
    items = load_manifest()
    return {"count": len(items), "samples": items}


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict:
    """Grade one fundus image. Returns the ARCHITECTURE.md §5 JSON exactly."""
    if not dr_model.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model is still loading. Retry shortly (see GET /health).",
        )

    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=415,
            detail=f"Expected an image upload, got content-type '{file.content_type}'.",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty upload.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )

    try:
        pil_img = Image.open(io.BytesIO(raw))
        pil_img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=400, detail=f"Could not decode image: {exc}"
        ) from exc

    try:
        result = dr_model.predict(pil_img)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Prediction failed.")
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}") from exc

    return result


# ---------------------------------------------------------------------------
# Serve the built frontend (single-origin) so ONE url/tunnel serves the whole
# app (UI + API), with no CORS/localhost issues for remote viewers. Mounted
# LAST so it never shadows the API routes above; html=True falls back to
# index.html for client-side routes. If dist/ isn't built yet, expose a tiny
# JSON index instead of 404ing.
# ---------------------------------------------------------------------------
_DIST_DIR = config.BACKEND_DIR.parent / "frontend" / "dist"
if _DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(_DIST_DIR), html=True), name="frontend")
else:
    @app.get("/")
    def root() -> dict:
        """Minimal index so a bare GET / is informative, not a 404."""
        return {
            "service": "KoʻzNur — Diabetic Retinopathy Triage API",
            "phase": config.PHASE,
            "endpoints": ["POST /predict", "GET /health", "GET /samples", "GET /docs"],
            "framing": "triage / decision support, NOT diagnosis",
        }
