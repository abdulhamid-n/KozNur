# KoʻzNur — Frontend

AI triage assistant for diabetic retinopathy (DR) screening. React + Vite + TailwindCSS.
This is the **frontend** described in `../ARCHITECTURE.md` §5 — it talks to the FastAPI
backend over HTTP and never runs inference in the browser.

> **Triage, not diagnosis.** Per the contract: this is a screening aid
> ("skrining yordamchisi"), never a diagnosis ("tashxis").

## Stack

- React 18 + Vite 5
- TailwindCSS 3 (brand palette: navy `#0B3D66`, teal `#0F838C`, light bg, warm accent `#E8833A` used **only** for the referable alert)
- Uzbek (Latin) UI

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build -> dist/
npm run preview  # serve the built dist/
```

API base defaults to `http://localhost:8000`. Override with `VITE_API_BASE`
(see `.env.example`).

## Backend contract used (ARCHITECTURE §5)

- `GET /health` — liveness (drives the header status dot)
- `GET /samples` — curated demo fundus images for the gallery
- `POST /predict` — multipart `file` in → JSON out:
  `{ grade, grade_label, referable, confidence, probabilities[5], gradcam_png_base64, recommendation }`
- Optional `POST /predict/sample/{id}` — if absent, the gallery fetches the
  sample image and re-POSTs it to `/predict`.

## Flow

Header (logotype) → drag-&-drop / upload zone + "Namuna rasmlar" gallery →
loading state → result card:
grade badge (0–4, Uzbek label) · referable banner (calm green
"Yo‘naltirish shart emas" vs amber "Mutaxassis ko‘rigiga yo‘naltirilsin") ·
confidence bar · Grad-CAM overlay toggle · recommendation text.
Persistent footer disclaimer: "Bu vosita tashxis emas, faqat skrining yordamchisi."
