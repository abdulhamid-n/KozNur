# KoʻzNur — Backend (Phase A)

FastAPI service that grades a fundus photo on the **ICDR 0–4** scale, flags
**referable DR (grade ≥ 2)**, and returns a **Grad-CAM** heatmap overlay.

> **Framing (ARCHITECTURE.md §1, non-negotiable):** this is **triage / decision
> support, NOT diagnosis** (skrining yordamchisi, never *tashxis*). Every output
> ends in a referral recommendation. Predictions are real model outputs and are
> **never fabricated**.

This is the **Phase-A** wrap (ARCHITECTURE.md §4): it serves an **openly
licensed, already-trained** DR classifier so the live demo works immediately.
Phase B (our own EfficientNet fine-tune on APTOS → `metrics.json`) swaps in
later.

---

## What it wraps

| | |
|---|---|
| **Model** | [`Kontawat/vit-diabetic-retinopathy-classification`](https://huggingface.co/Kontawat/vit-diabetic-retinopathy-classification) |
| **Arch** | ViT-Base/16, `ViTForImageClassification`, 5-class ICDR head |
| **License** | `apache-2.0` — commercial + redistribution OK **with attribution** (attributed here) |
| **Data lineage** | APTOS-2019-derived (open competition/research data, §3) — **not** claimed as our own |
| **Why this model** | Its `id2label` is already in canonical ICDR order, so `argmax == grade` and `referable = grade ≥ 2` is correct directly |

**Normalization note (important):** ARCHITECTURE.md §3 mentions ImageNet mean/std
as the *general* recipe, but **this checkpoint** was trained with the bundled
`ViTImageProcessor` (resize 224 → /255 → normalize `mean=std=0.5`). The backend
uses that processor and **does not hardcode ImageNet stats** — using the wrong
constants silently degrades predictions. The retina-crop preprocessing from §3
runs *before* the processor.

---

## Requirements

- **Python 3.11+** (works on 3.13)
- macOS Apple Silicon recommended — **MPS** acceleration is used automatically
  (falls back to CUDA, then CPU)
- ~343 MB one-time model download (cached in `~/.cache/huggingface`)

---

## Run (exact commands)

From this `backend/` directory:

```bash
# 1. Create + activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 3. (Recommended) pre-fetch the ~343 MB model so the first request is fast
bash scripts/download_weights.sh

# 4. Launch the API (http://localhost:8000)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The model is **pre-loaded at startup** (FastAPI lifespan), so the first
`/predict` from a judge upload is not slow. Until it finishes loading, `/predict`
returns `503` and `/health` reports `"status": "loading"`.

Interactive docs: <http://localhost:8000/docs>

---

## Demo gallery (optional but recommended)

A curated set of **7 real APTOS 2019 fundus images** (grades 0–4) already ships
in `samples/`, with full provenance + licensing in `samples/samples.json`. So
the demo never depends on the judge having a photo, the gallery is ready out of
the box.

To refresh / re-pull from the open APTOS mirror (stdlib + Pillow only — **no**
`datasets` install, no HF token, no Kaggle rules-accept gate):

```bash
python scripts/fetch_samples.py                 # default 7-image spread (grades 0-4)
python scripts/fetch_samples.py --per-grade 2   # 2 images per ICDR grade
```

This rewrites both `samples/samples.json` (provenance) and `samples/manifest.json`
to match what was saved. You can also drop images in by hand — any `.png/.jpg`
in `samples/` is served even if it is not in a manifest (its `id` becomes the
filename stem). Images are served at `/samples/<filename>`.

---

## API

### `GET /health`
Readiness, device, ICDR labels, preprocessing flags, and the honest Phase-A
disclaimer (§6).

### `GET /samples`
```json
{
  "count": 7,
  "samples": [
    { "id": "sample-moderate-a", "filename": "sample_03_grade2.jpg",
      "url": "/samples/sample_03_grade2.jpg",
      "label": "Moderate (ICDR 2) — referable", "expected_grade": 2,
      "referable": true,
      "license": "APTOS 2019 open competition / research-use" }
  ]
}
```
`expected_grade` is the **dataset** label for narration only — it is not a model
output.

### `POST /predict`
Multipart image upload → JSON **exactly per ARCHITECTURE.md §5**:

```bash
curl -s -X POST http://localhost:8000/predict \
  -F "file=@samples/aptos_grade2.png" | python3 -m json.tool
```

```json
{
  "grade": 2,
  "grade_label": "Moderate",
  "referable": true,
  "confidence": 0.87,
  "probabilities": [0.02, 0.06, 0.74, 0.13, 0.05],
  "gradcam_png_base64": "iVBORw0KGgo...",
  "recommendation": "Mutaxassis ko'rigiga yo'naltirilsin"
}
```

- `grade` — predicted ICDR grade `0..4` (`argmax` of the softmax)
- `grade_label` — `["No DR","Mild","Moderate","Severe","Proliferative"][grade]`
- `referable` — `grade >= 2`
- `confidence` — `softmax.max()`
- `probabilities` — 5 floats in **ICDR order 0..4** (feed straight into the §5 field)
- `gradcam_png_base64` — Grad-CAM heatmap (14×14 ViT CAM upsampled to 224)
  overlaid on the fundus, base64 PNG (no `data:` prefix)
- `recommendation` — Uzbek (Latin):
  - referable → `Mutaxassis ko'rigiga yo'naltirilsin`
  - else → `Yo'naltirish shart emas; rejali kuzatuv`

Render the heatmap in the frontend with:
`<img src={"data:image/png;base64," + gradcam_png_base64} />`

---

## CORS

Open to the Vite dev origin **`http://localhost:5173`** (and `127.0.0.1:5173`)
per ARCHITECTURE.md §5. Add origins in `app/config.py → CORS_ORIGINS`.

---

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `KOZNUR_MODEL_ID` | `Kontawat/vit-diabetic-retinopathy-classification` | HF model id to wrap |
| `KOZNUR_MODEL_DIR` | _(unset)_ | Load from a local snapshot dir instead of the hub |
| `KOZNUR_RETINA_CROP` | `1` | Circular retina crop + bbox crop (set `0` to disable) |
| `KOZNUR_BEN_GRAHAM` | `0` | Ben Graham + CLAHE (off by default — train/serve mismatch; A/B only) |

---

## Grad-CAM (ViT recipe)

ViT tokens are `[B, 197, C]`, not a spatial conv map, so Grad-CAM targets a
**LayerNorm** with a `reshape_transform`:

- target layer: `model.vit.encoder.layer[-1].layernorm_before`
- `reshape_transform`: drop the CLS token, reshape 196 patch tokens → `14×14`
  (`224 / 16 = 14`), permute to `[B, C, 14, 14]`

(If Phase B uses an EfficientNet backbone instead, target the last conv block,
e.g. `model.features[-1]`, with **no** `reshape_transform`.)

---

## Honest-claims guardrail (ARCHITECTURE.md §6)

This wrapped checkpoint is a **demo engine**. Its model-card headline accuracy
(~0.73, no QWK / sensitivity reported) **must not** be presented as
"measured by us." The performance slide stays **form (b)** (target/benchmark,
anchored to Gulshan et al. *JAMA* 2016, AUC ≈ 0.991 for referable DR) until the
**Phase-B `metrics.json`** exists. `/health` surfaces this disclaimer.

---

## File map

```
backend/
├── app/
│   ├── __init__.py
│   ├── config.py          # paths, model id, ICDR labels, toggles, disclaimer
│   ├── preprocessing.py    # retina crop (+ optional Ben Graham/CLAHE)
│   ├── model_runner.py     # ViT load, predict, Grad-CAM overlay
│   ├── samples.py          # /samples manifest loader
│   └── main.py             # FastAPI app: /predict, /health, /samples
├── scripts/
│   ├── download_weights.sh # pre-fetch the ~343 MB checkpoint
│   └── fetch_samples.py    # pull labeled APTOS demo images (HF mirror)
├── samples/
│   └── manifest.json       # demo gallery manifest (+ your fundus images)
├── requirements.txt
├── .gitignore
└── README.md
```
