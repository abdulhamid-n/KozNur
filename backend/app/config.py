"""Central configuration for the KoʻzNur Phase-A backend.

Single source of truth for paths, model id, labels, and the demo flags the
ARCHITECTURE.md contract requires. Nothing here invents performance numbers —
the model wrapped here is a demo engine only (see PHASE_A_DISCLAIMER).
"""

from __future__ import annotations

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
# backend/app/config.py  ->  backend/
BACKEND_DIR: Path = Path(__file__).resolve().parent.parent
SAMPLES_DIR: Path = BACKEND_DIR / "samples"
SAMPLES_MANIFEST: Path = SAMPLES_DIR / "manifest.json"

# ---------------------------------------------------------------------------
# Model (Phase A — wrap an already-trained, openly-licensed DR classifier)
# ---------------------------------------------------------------------------
# Kontawat/vit-diabetic-retinopathy-classification
#   - ViT-Base/16, ViTForImageClassification, 5-class head.
#   - License: apache-2.0 (permissive; commercial + redistribution OK with
#     attribution). Attributed honestly here per ARCHITECTURE.md §4 / §6.
#   - Training-data lineage: APTOS-2019-derived (open competition/research
#     data, ARCHITECTURE.md §3). We do NOT claim it as our own dataset.
#   - id2label = {0:"0",1:"1",2:"2",3:"3",4:"4"} — already in canonical ICDR
#     order, so argmax index == ICDR grade. (The rafalosa fallback is NOT in
#     ICDR order; do not swap without remapping by label string.)
#
# NOTE on the contract: ARCHITECTURE.md §4 names EfficientNet as the *Phase-B*
# backbone WE fine-tune ourselves. For Phase A ("wrap now"), this ViT is the
# cleanest verified, already-trained, ICDR-ordered option. The honest framing
# in §6 still holds: this is a demo engine, not a measured performance claim.
MODEL_ID: str = os.environ.get(
    "KOZNUR_MODEL_ID", "Kontawat/vit-diabetic-retinopathy-classification"
)

# Optional local weights/snapshot dir (set by scripts/download_weights.sh when
# pre-fetching). If unset, transformers resolves from the HF cache / hub.
MODEL_LOCAL_DIR: str | None = os.environ.get("KOZNUR_MODEL_DIR") or None

# International Clinical Diabetic Retinopathy (ICDR) 5-grade scale.
# Index i corresponds to ICDR grade i for THIS checkpoint.
ICDR_LABELS: list[str] = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]

# Referable DR = grade >= 2 (moderate or worse) — ARCHITECTURE.md §2 / §4.
REFERABLE_THRESHOLD: int = 2

# Uzbek (Latin) referral recommendations — wording locked by the task spec.
RECOMMENDATION_REFERABLE: str = "Mutaxassis ko'rigiga yo'naltirilsin"
RECOMMENDATION_OK: str = "Yo'naltirish shart emas; rejali kuzatuv"

# ---------------------------------------------------------------------------
# Preprocessing toggles
# ---------------------------------------------------------------------------
# Circular retina crop + tight bbox crop removes black fundus borders. This
# matches ARCHITECTURE.md §3 ("circular crop to retina") and improves
# robustness on gallery / real-world images. Default ON.
ENABLE_RETINA_CROP: bool = os.environ.get("KOZNUR_RETINA_CROP", "1") != "0"

# Ben Graham / CLAHE contrast normalization is contract-mentioned (§3) but kept
# OFF by default: this checkpoint was trained with the plain ViTImageProcessor
# (resize + 0.5 normalize). Adding heavy Ben-Graham at inference is a
# train/serve mismatch. Exposed as a toggle for A/B only.
ENABLE_BEN_GRAHAM: bool = os.environ.get("KOZNUR_BEN_GRAHAM", "0") == "1"

# ---------------------------------------------------------------------------
# CORS — open to the Vite dev origin (ARCHITECTURE.md §5 frontend).
# ---------------------------------------------------------------------------
CORS_ORIGINS: list[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # KoʻzNur dev server runs on 5180 when 5173 is occupied by another app.
    "http://localhost:5180",
    "http://127.0.0.1:5180",
]

# ---------------------------------------------------------------------------
# Honest-claims guardrail (ARCHITECTURE.md §6). Surfaced in /health so the
# wrapped model can never be misread as a measured KoʻzNur result.
# ---------------------------------------------------------------------------
PHASE: str = "A"
PHASE_A_DISCLAIMER: str = (
    "Phase-A demo engine: wraps the openly-licensed, APTOS-trained "
    "Kontawat/vit-diabetic-retinopathy-classification checkpoint (apache-2.0). "
    "Triage / decision support, NOT diagnosis. Outputs are illustrative; no "
    "KoʻzNur-measured accuracy is claimed until the Phase-B metrics.json exists."
)
