# KoʻzNur — Phase-B Fine-Tune (APTOS 2019)

Fine-tunes an **ImageNet-pretrained EfficientNet (timm)** on **APTOS 2019**
fundus images and writes **our own** weights + **measured** metrics:

```
backend/models/koznur_efficientnet.pt    # state_dict + config + class info
backend/models/metrics.json              # QWK, referable sens/spec, AUC, history
```

This is the honest **Phase B** of `ARCHITECTURE.md` §4. When `metrics.json`
lands, the deck's performance slide upgrades from §6 form (b) *target* to form
(a) *measured*. **Triage / decision support, NOT diagnosis.**

> Contract anchors: ICDR 5-grade head (§2/§4), **referable = grade ≥ 2**,
> APTOS 2019 data (§3), EfficientNet backbone (§4), MPS acceleration (§5),
> measured-on-held-out-stratified-split numbers (§6).

---

## 1. Install

Use the backend venv (or a fresh one), then add the train deps:

```bash
cd "<repo>/KozNur"
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt -r backend/train/requirements.txt
```

---

## 2. Get the APTOS 2019 data

Pick **one** path. All three give the **same 3,662 labeled training images**
(`id_code`, `diagnosis` = ICDR 0–4).

### Path A — Kaggle competition (canonical)

Requires a Kaggle API token at `~/.kaggle/kaggle.json` **and** accepting the
competition rules once on the website
(<https://www.kaggle.com/competitions/aptos2019-blindness-detection/rules>).

```bash
pip install kaggle
# place kaggle.json, then:
chmod 600 ~/.kaggle/kaggle.json
kaggle competitions download -c aptos2019-blindness-detection -p ./data/aptos2019
unzip -q ./data/aptos2019/aptos2019-blindness-detection.zip -d ./data/aptos2019
# -> ./data/aptos2019/train.csv  (id_code,diagnosis)
# -> ./data/aptos2019/train_images/<id_code>.png
```

### Path B — Kaggle dataset mirror (no rules-accept gate)

Same images + labels, plain dataset (still needs `kaggle.json`):

```bash
kaggle datasets download -d mariaherrerot/aptos2019 -p ./data/aptos2019 --unzip
# -> ./data/aptos2019/train.csv + ./data/aptos2019/train_images/
```

### Path C — Hugging Face repackage (no Kaggle at all)

The trainer can stream the HF repackage directly (no manual download):

```bash
# nothing to download — pass --hf-dataset (see §3)
```

---

## 3. Train — the exact command

**Default (EfficientNet-B0, 224 px, 12 epochs, class-weighted, stratified split):**

```bash
python backend/train/finetune_aptos.py --data-root ./data/aptos2019
```

That writes `backend/models/koznur_efficientnet.pt` and
`backend/models/metrics.json`.

**Higher accuracy (EfficientNet-B3 @ 300 px):**

```bash
python backend/train/finetune_aptos.py \
    --data-root ./data/aptos2019 \
    --backbone tf_efficientnet_b3_ns --img-size 300 --epochs 15
```

**Hugging Face fallback (no Kaggle download — Path C):**

```bash
python backend/train/finetune_aptos.py --hf-dataset martinezomg/diabetic-retinopathy
```

**Quick smoke test (3 epochs):**

```bash
python backend/train/finetune_aptos.py --data-root ./data/aptos2019 --epochs 3
```

### Key flags

| Flag | Default | Meaning |
|---|---|---|
| `--data-root` | _(none)_ | Kaggle dir with `train.csv` + `train_images/` (Path A/B) |
| `--hf-dataset` | _(none)_ | HF repackage id, e.g. `martinezomg/diabetic-retinopathy` (Path C) |
| `--backbone` | `tf_efficientnet_b0_ns` | timm EfficientNet (B0 speed / B3 accuracy) |
| `--img-size` | `224` | 224 for B0, 300 for B3 |
| `--epochs` | `12` | training epochs |
| `--batch-size` | `16` | lower to 8 if MPS/GPU memory is tight |
| `--lr` | `3e-4` | AdamW LR (cosine-annealed) |
| `--val-frac` | `0.15` | held-out **stratified** validation fraction |
| `--ben-graham` | off | enable Ben Graham + CLAHE preprocessing (§3) |
| `--no-class-weights` | off | disable inverse-frequency class-weighted loss |
| `--out-dir` | `backend/models` | where the `.pt` + `metrics.json` are written |

> Provide **either** `--data-root` **or** `--hf-dataset`. Class imbalance is
> handled by inverse-frequency **class weights** by default (§3).

---

## 4. What gets measured (`metrics.json`)

Evaluated on the held-out **stratified** val split (§6) — real numbers, never
fabricated:

- **`quadratic_weighted_kappa`** — the APTOS leaderboard metric (ordinal-aware).
- **`referable_sensitivity` / `referable_specificity`** — for the binary
  referable task (grade ≥ 2), the numbers a clinician cares about.
- **`referable_auc`** — ROC-AUC using `P(grade ≥ 2)` (sum of softmax over
  grades 2–4); comparable to Gulshan et al. JAMA 2016 (AUC 0.991).
- **`accuracy`**, per-class val support, the referable 2×2 confusion matrix,
  and a per-epoch `history`.

The checkpoint saved is the epoch with the **best validation QWK**.

---

## 5. Swap into the MVP

`backend/models/` is git-ignored (weights are large / regenerated). After a run:

- `metrics.json` is what the deck reads for §6 form (a).
- `koznur_efficientnet.pt` carries `backbone`, `img_size`, `normalize`
  (ImageNet mean/std), and `referable_threshold` so the serving wrapper can
  rebuild the exact timm model and preprocessing. (Note: the Phase-A wrapper
  serves a ViT with `mean=std=0.5`; this EfficientNet uses **ImageNet** stats —
  the `.pt` records its own normalization so they never get crossed.)

---

## 6. Notes / gotchas

- **Device:** auto-selects **MPS → CUDA → CPU** (§5). On an M-series Mac you get
  MPS automatically. CPU works but is slow; prefer B0 for a CPU smoke test.
- **`num_workers`:** on macOS/MPS, if you hit dataloader fork issues, run with
  `--num-workers 0`.
- **Train/serve parity:** preprocessing reuses `backend/app/preprocessing.py`
  (`retina_crop`, `ben_graham_clahe`) when importable, so what the model trains
  on matches what it serves on.
- **Honest claims (§6):** `metrics.json` includes the triage-not-diagnosis
  disclaimer and a `benchmark_context`. No FDA clearance, no proprietary-data
  claim, image-quality dependent, needs prospective validation.
