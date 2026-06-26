# KoʻzNur — AI-assisted diabetic retinopathy screening

**Triage, not diagnosis.** KoʻzNur grades a fundus (retina) photograph on the international
ICDR 0–4 scale, flags **referable** disease (grade ≥ 2), and shows a **Grad-CAM heatmap** of
the regions the model looked at — so a non-specialist can run a reliable screen and only the
referable cases reach a scarce ophthalmologist.

> Team **Zeno** · Medicine track · Umummilliy AI Hackathon — Guliston, 2026.

---

## Why

Diabetic retinopathy is a leading cause of preventable blindness. It is silent until late, and
every fundus photo currently needs an ophthalmologist to grade. The bottleneck is **grading
throughput**, not cameras. KoʻzNur modernises the existing screening network by removing the
specialist from the *grading* step — a nurse + camera + AI screens everyone, the specialist
sees only the ~30–40% who are referable.

## How it works

```
[ React + Vite + Tailwind UI ]  --HTTP-->  [ FastAPI + PyTorch + pytorch-grad-cam ]
        fundus photo            POST /predict        grade • referable • confidence • Grad-CAM
```

- **POST `/predict`** — multipart fundus image → `{ grade, grade_label, referable, confidence,
  probabilities[5], gradcam_png_base64, recommendation }`
- **GET `/health`** — readiness, device, honest phase disclaimer
- **GET `/samples`** — curated demo gallery

The backend also serves the built frontend, so a single origin (and a single tunnel) serves the
whole app.

## Model

- **Phase A (demo engine):** wraps an open, APTOS-trained classifier so the app works end-to-end.
  Real model outputs — never fabricated — but no KoʻzNur-measured accuracy is claimed.
- **Phase B (our own model):** fine-tunes a pretrained EfficientNet on **APTOS 2019** with
  **class-imbalance handling** (WeightedRandomSampler oversampling the rare severe grades),
  evaluated by **Quadratic Weighted Kappa** and **referable sensitivity / specificity / AUC** on a
  held-out, stratified split. See [`backend/train/`](backend/train/).

## Honest limitations

- This is a **screening / decision-support** tool, **not** a diagnosis. The final decision is the
  clinician's.
- Performance is **image-quality dependent** and needs **prospective clinical validation**.
- No regulatory clearance; research/educational use.

## Data

Trained on the **APTOS 2019 Blindness Detection** open competition dataset (Aravind Eye Hospital).
The images are **not** redistributed in this repo — the Kaggle competition rules prohibit it.
See [`backend/train/README.md`](backend/train/README.md) to fetch them.

## Run it

```bash
# Backend (serves UI + API on :8000)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000

# Frontend (dev)
cd frontend
npm install
npm run dev
```

## Repo layout

| Path | What |
|---|---|
| `backend/app/` | FastAPI service, model runner, preprocessing, Grad-CAM |
| `backend/train/` | Phase-B APTOS fine-tune pipeline + data prep |
| `frontend/` | React + Vite + Tailwind clinical UI (Uzbek) |
| `presentation/` | Pitch deck |
| `ARCHITECTURE.md` | Design contract (the source of truth) |
