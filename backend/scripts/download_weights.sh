#!/usr/bin/env bash
#
# Pre-fetch the Phase-A DR checkpoint so the first /predict isn't blocked on a
# ~343 MB cold download. Idempotent: re-running just re-validates the cache.
#
# Model: Kontawat/vit-diabetic-retinopathy-classification (apache-2.0, public,
#        no auth/gating). Ships pytorch_model.bin (no safetensors).
#
# Usage:
#   bash scripts/download_weights.sh            # cache to ~/.cache/huggingface
#   KOZNUR_MODEL_DIR=./models/dr-vit \
#       bash scripts/download_weights.sh        # snapshot into a local dir
#
set -euo pipefail

MODEL_ID="${KOZNUR_MODEL_ID:-Kontawat/vit-diabetic-retinopathy-classification}"
TARGET_DIR="${KOZNUR_MODEL_DIR:-}"

echo "KoʻzNur — pre-fetching Phase-A model: ${MODEL_ID}"

# Resolve the active Python (prefer the venv if it's sourced).
PY="${PYTHON:-python3}"

if [[ -n "${TARGET_DIR}" ]]; then
  echo "Snapshotting into local dir: ${TARGET_DIR}"
  "${PY}" - "${MODEL_ID}" "${TARGET_DIR}" <<'PYEOF'
import sys
from huggingface_hub import snapshot_download

model_id, target = sys.argv[1], sys.argv[2]
path = snapshot_download(repo_id=model_id, local_dir=target)
print(f"Downloaded snapshot to: {path}")
print("Set KOZNUR_MODEL_DIR to this path before launching uvicorn.")
PYEOF
else
  echo "Warming the Hugging Face cache (~/.cache/huggingface) ..."
  "${PY}" - "${MODEL_ID}" <<'PYEOF'
import sys
from transformers import AutoImageProcessor, AutoModelForImageClassification

model_id = sys.argv[1]
# Touch both artifacts so processor config + weights are cached.
AutoImageProcessor.from_pretrained(model_id)
AutoModelForImageClassification.from_pretrained(model_id)
print("Cache warmed. Model + processor are ready for fast startup.")
PYEOF
fi

echo "Done."
