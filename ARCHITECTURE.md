# KoʻzNur — Architecture Contract (Single Source of Truth)

**This file is the shared contract. The MVP and the presentation BOTH read it. Neither is allowed to state anything this file does not authorize. If a claim is not in here, it does not go on a slide and it is not demoed.**

- **Team:** Zeno
- **Project:** KoʻzNur ("eye light")
- **Track:** Medicine — Umummilliy AI Hackathon, Guliston (25–28 June 2026)
- **Audience for this round:** Technical mentor, ~15 min, mostly Q&A. Deck is ~60% technical depth.
- **Presentation language:** Uzbek (Latin script).

---

## 1. Problem (locked)

Diabetic retinopathy (DR) is a leading cause of preventable blindness. It is silent — patients lose vision before they feel symptoms — but it is detectable from a retinal (fundus) photograph and treatable if caught early. Uzbekistan already runs diabetic eye-screening, but grading every fundus image needs an ophthalmologist, and specialists are scarce and concentrated in cities. The bottleneck is **grading throughput**, not cameras. KoʻzNur is an **AI triage assistant** that grades fundus photos in seconds and flags who needs to see a specialist — modernizing the *existing* screening network, not replacing doctors.

**Framing rule (non-negotiable):** This is **triage / decision support, NOT diagnosis.** Every output ends in a referral recommendation, never a final diagnosis. Say "triage" / "skrining yordamchisi", never "tashxis".

---

## 2. How Google did it (the technical reference we replicate at student scale)

These are the facts the deck's "prior art" section uses. All true, all citable:

- **Gulshan et al., *JAMA* 2016** — deep CNN (Inception-v3) trained on **~128,000 fundus images**, each graded by multiple US-licensed ophthalmologists. Achieved **AUC ≈ 0.991** for referable DR on the EyePACS-1 validation set; sensitivity/specificity ≈ 90%/98% at the operating point.
- **ARDA (Automated Retinal Disease Assessment)** — Google's productized version, **prospectively validated in Thailand and India** in real clinics.
- **Grading scale:** International Clinical Diabetic Retinopathy (ICDR) **5 levels** — 0 No DR, 1 Mild, 2 Moderate, 3 Severe, 4 Proliferative. **Referable DR = grade ≥ 2 (moderate or worse).**
- **Our honest framing:** we reproduce this recipe — pretrained CNN backbone fine-tuned on graded fundus data — on **open datasets** at student scale, with **Grad-CAM explainability** added.

---

## 3. Data (locked)

- **Primary:** **APTOS 2019 Blindness Detection** (Kaggle) — 3,662 labeled training fundus images (ICDR 0–4), from Aravind Eye Hospital, India. Small enough to fine-tune in <1 hour.
- **Secondary / scale story:** **Diabetic Retinopathy Detection 2015 (EyePACS)** (Kaggle) — ~35k/88k labeled images. Used to describe scalability; optional for actual training given time.
- **Preprocessing (must match in code and slides):** circular crop to retina, resize to model input (224 or 300 px), optional Ben Graham / CLAHE contrast normalization, ImageNet mean/std normalization. Class imbalance handled via class weights or weighted sampling.
- **Licensing:** open competition data, research use. State it. Do not claim a proprietary dataset.

---

## 4. Model (locked)

- **Backbone:** **EfficientNet** (B0 for speed, B3 if accuracy needs it), **ImageNet-pretrained**, fine-tuned on APTOS. (We may reference Inception-v3 as Google's choice and note EfficientNet is the modern equivalent.)
- **Head / output:** 5-class softmax over ICDR grades 0–4. **Referable flag = (predicted grade ≥ 2)**. Report a **confidence** (softmax max or calibrated).
- **Two-phase reality (the honest version of "wrap now, train later"):**
  - **Phase A — demo-ready now:** MVP wraps an **open, already-trained DR classifier** (e.g. a public APTOS-fine-tuned EfficientNet/Inception) so the live demo works immediately and reliably. This is attributed honestly in code/comments.
  - **Phase B — our fine-tune (runs in background):** real fine-tuning pipeline on APTOS that produces **our own weights + `metrics.json`**. When it finishes, weights swap into the MVP and the deck reports our measured numbers.
- **Explainability:** **Grad-CAM** on the last conv block → heatmap overlay highlighting hemorrhages / exudates / neovascularization. This is a core differentiator and must appear in BOTH demo and deck.

---

## 5. Stack (locked — this is exactly what the architecture slide shows)

```
[ React (Vite + Tailwind) frontend ]  --HTTP-->  [ FastAPI (Python) backend ]
   upload / drag fundus image                       preprocessing (OpenCV/Pillow)
   result card + Grad-CAM overlay                   PyTorch + torchvision model
   sample-image gallery for demo                    pytorch-grad-cam
   referral recommendation                          POST /predict -> JSON
```

- **Backend:** Python 3.11+, FastAPI, PyTorch, torchvision, `grad-cam` (pytorch-grad-cam), OpenCV/Pillow, uvicorn. MPS (Apple Silicon) acceleration.
  - **`POST /predict`** — multipart image in → JSON out:
    ```json
    {
      "grade": 2,
      "grade_label": "Moderate",
      "referable": true,
      "confidence": 0.87,
      "probabilities": [0.02, 0.06, 0.74, 0.13, 0.05],
      "gradcam_png_base64": "...",
      "recommendation": "Mutaxassis ko'rigiga yo'naltirilsin"
    }
    ```
  - **`GET /health`**, **`GET /samples`** (curated demo fundus images).
- **Frontend:** React + Vite + TailwindCSS. Clinical, calm, branded. Flow: upload/drag → loading → result card (grade badge, referable banner, confidence bar, Grad-CAM toggle, plain-language referral). Demo gallery of pre-loaded fundus images so the demo never depends on the judge having a photo.
- **Model serving:** server-side (Grad-CAM + preprocessing need Python). No in-browser inference.

---

## 6. Honest-claims policy (the contract that stops the deck and code from contradicting)

**Allowed on slides / in Q&A:**
- "We fine-tune a pretrained EfficientNet on APTOS 2019." (true — pipeline exists and runs)
- Performance numbers reported in **one** of two forms, whichever is true at showtime:
  - **(a) Measured:** "On our held-out validation split we measure QWK = X, referable sensitivity = Y, specificity = Z." — only if `metrics.json` exists from our run.
  - **(b) Target/benchmark:** "Target QWK ≥ 0.90, benchmarked to the APTOS leaderboard and Gulshan et al. JAMA 2016 (AUC 0.991 for referable DR); our validation is running." — clearly labeled as target.
- "Triage / decision support" — always.

**Forbidden:**
- Any specific accuracy number presented as *measured by us* when no such measurement exists.
- The word "diagnosis" / "tashxis" as the product's output.
- Claiming a proprietary dataset, FDA/regulatory clearance, or clinical deployment.

The performance slide is built as form (b) and **upgraded to form (a) automatically** if/when `metrics.json` lands. Both forms survive a technical Q&A.

---

## 7. Presentation spec (locked)

- **Format:** professional **HTML deck** (self-contained, runs in browser, exportable). NOT text-on-slides — branded, designed, motion where it earns attention.
- **Build skills:** Hyperframes (layout/branding system) + Motion Graphics (tasteful transitions/animated diagrams). Clean. **No AI slop** — no stocky gradients-for-the-sake-of-it, no lorem filler, no clip-art.
- **Brand:** name **KoʻzNur**; palette navy `#0B3D66` + teal `#0F838C` + clean light bg + one warm accent for the "referable" alert; medical-clean typography; consistent slide furniture (page numbers, footer "Zeno · KoʻzNur", section dividers).
- **Language:** **Uzbek (Latin).** Technical terms kept in English where standard (EfficientNet, Grad-CAM, QWK, API), explained in Uzbek.
- **Length:** ~12–14 slides. Pacing for a 15-min slot: ~3 min problem/solution, ~9 min technical, ~3 min demo + roadmap.
- **Slide order (technical-mentor cut):**
  1. Title — KoʻzNur, Zeno, one-line tagline
  2. Problem — silent blindness, specialist bottleneck (1 strong stat each)
  3. Solution in one sentence + where it sits in the screening flow (diagram)
  4. How Google did it — Gulshan 2016 / ARDA (credibility anchor)
  5. System architecture — the React↔FastAPI↔PyTorch diagram (§5)
  6. Data — APTOS / EyePACS, preprocessing pipeline (visual)
  7. Model — EfficientNet fine-tuning, ICDR 5-grade output, referable threshold
  8. Explainability — Grad-CAM heatmap (real example image)
  9. Performance — per §6, honest form
  10. Live demo — what we show (mirrors the MVP exactly)
  11. Limitations & safety — triage-not-diagnosis, image-quality dependence, needs prospective validation (this slide *builds* trust with a specialist)
  12. Roadmap — fine-tune at scale, local clinic validation, integrate into existing screening network
  13. (optional) Team / ask
- **Demo↔deck rule:** slide 10 lists ONLY what the MVP actually does in §5. If the MVP can't do it, it's not on slide 10.

---

## 8. What must stay in sync (the anti-contradiction checklist)

| Claim source | MVP must have | Deck must say |
|---|---|---|
| Input | fundus image upload + samples | "fundus photo in" |
| Output | grade 0–4 + referable + confidence | ICDR 5-grade + referable ≥2 |
| Explainability | Grad-CAM overlay endpoint | Grad-CAM slide w/ real heatmap |
| Architecture | React + FastAPI + PyTorch | the §5 diagram, verbatim |
| Data | APTOS loader/preprocess code | APTOS 2019 (+EyePACS scale) |
| Numbers | `metrics.json` if trained | §6 form (a) or (b), never fabricated |
| Framing | "recommendation" text, not "diagnosis" | "triage", never "tashxis" |

---

## 9. Build order

1. MVP workflow scaffolds backend + frontend, wraps Phase-A pretrained model → working demo.
2. Kick off Phase-B fine-tune in background (once APTOS is available) → `metrics.json` + sample Grad-CAM images + UI screenshots.
3. Presentation workflow builds the HTML deck from THIS file + the MVP's real screenshots/heatmaps/metrics.
4. Final sync pass: verify every §8 row holds before the meeting.
