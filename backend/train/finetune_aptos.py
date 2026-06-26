#!/usr/bin/env python3
"""KoʻzNur — Phase-B fine-tune pipeline (ARCHITECTURE.md §4).

Fine-tunes an **ImageNet-pretrained EfficientNet (timm)** on **APTOS 2019**
fundus images (ICDR grades 0-4) and writes OUR OWN weights + measured metrics:

  - ``models/koznur_efficientnet.pt``   (state_dict + config + class info)
  - ``models/metrics.json``             (QWK, referable sens/spec, AUC, ...)

This is the honest "Phase B" half of ARCHITECTURE.md §4: when ``metrics.json``
lands, the deck's performance slide upgrades from §6 form (b) target to form (a)
measured, and the weights can swap into the MVP.

Contract anchors
----------------
- §2/§4  ICDR 5-grade head; **referable DR = predicted grade >= 2**.
- §3     APTOS 2019 (3,662 labeled training fundus images, id_code + diagnosis).
         Preprocessing: circular retina crop -> resize (224 B0 / 300 B3) ->
         ImageNet mean/std normalize. Optional Ben Graham / CLAHE.
         Class imbalance -> class weights (default) or weighted sampling.
- §4     EfficientNet (B0 for speed, B3 if accuracy needs it), ImageNet-pretrained.
- §5     MPS (Apple Silicon) acceleration; CUDA / CPU fallback.
- §6     We report MEASURED numbers from a held-out, **stratified** val split.
         Nothing is fabricated — metrics.json is written only from real eval.

Data layouts supported (auto-detected, in priority order)
---------------------------------------------------------
1. Kaggle competition / dataset unzip:
       <data-root>/train.csv            (columns: id_code, diagnosis)
       <data-root>/train_images/<id_code>.png
2. Hugging Face repackage fallback (no Kaggle rules-accept gate):
       --hf-dataset martinezomg/diabetic-retinopathy   (load_dataset; image,label)

Usage
-----
    # after downloading APTOS (see train/README.md):
    python backend/train/finetune_aptos.py --data-root ./data/aptos2019

    # quick smoke run, B0, 3 epochs:
    python backend/train/finetune_aptos.py --data-root ./data/aptos2019 \
        --backbone tf_efficientnet_b0_ns --epochs 3

    # higher-accuracy B3 @ 300px:
    python backend/train/finetune_aptos.py --data-root ./data/aptos2019 \
        --backbone tf_efficientnet_b3_ns --img-size 300 --epochs 15

    # HF fallback (no Kaggle download):
    python backend/train/finetune_aptos.py --hf-dataset martinezomg/diabetic-retinopathy

Ready-to-run once: (a) the deps in train/requirements.txt are installed, and
(b) the APTOS data is present (Kaggle token + rules-accept, OR the HF fallback).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

# --- repo-relative imports so we reuse the SAME preprocessing as serving ------
# backend/train/finetune_aptos.py -> add backend/ to sys.path -> import app.*
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

ICDR_LABELS = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]
REFERABLE_THRESHOLD = 2  # ARCHITECTURE.md §2/§4 — grade >= 2 is referable
NUM_CLASSES = 5


# ===========================================================================
# Device (ARCHITECTURE.md §5 — MPS first on Apple Silicon)
# ===========================================================================
def select_device():
    import torch

    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


# ===========================================================================
# Preprocessing (ARCHITECTURE.md §3)
# ===========================================================================
def _retina_crop(pil_img):
    """Circular retina crop. Reuse app.preprocessing if importable, else inline.

    Using the serving code path guarantees train/serve preprocessing parity.
    """
    try:
        from app.preprocessing import retina_crop  # type: ignore

        return retina_crop(pil_img)
    except Exception:
        # Inline fallback (matches app/preprocessing.retina_crop semantics).
        import cv2  # noqa: WPS433
        from PIL import Image

        img = np.asarray(pil_img.convert("RGB"), dtype=np.uint8)
        gray = img.max(axis=2)
        mask = gray > 7
        coords = np.argwhere(mask)
        if coords.size == 0:
            return pil_img
        y0, x0 = coords.min(axis=0)
        y1, x1 = coords.max(axis=0) + 1
        cropped = img[y0:y1, x0:x1]
        h, w = cropped.shape[:2]
        if h < 8 or w < 8:
            return pil_img
        circ = np.zeros((h, w), dtype=np.uint8)
        cv2.circle(circ, (w // 2, h // 2), min(h, w) // 2, 1, thickness=-1)
        masked = cropped * circ[:, :, None]
        return Image.fromarray(masked.astype(np.uint8), mode="RGB")


def _ben_graham(pil_img):
    try:
        from app.preprocessing import ben_graham_clahe  # type: ignore

        return ben_graham_clahe(pil_img)
    except Exception:
        return pil_img  # if cv2 path unavailable, skip gracefully


class _Preprocess:
    """Picklable preprocessing callable. Module-level (NOT a closure) so the
    DataLoader's worker processes can pickle it under macOS 'spawn'. Converts to
    RGB -> retina crop -> optional Ben Graham, reusing the serving code path."""

    def __init__(self, ben_graham: bool):
        self.ben_graham = ben_graham

    def __call__(self, pil_img):
        out = pil_img.convert("RGB")
        out = _retina_crop(out)
        if self.ben_graham:
            out = _ben_graham(out)
        return out


def build_transforms(img_size: int, ben_graham: bool, train: bool, precropped: bool = False):
    """timm EfficientNet expects ImageNet mean/std. (Distinct from the Phase-A
    ViT's 0.5 stats — correct, because this is OUR pretrained backbone.)
    """
    import torch
    from torchvision import transforms

    IMAGENET_MEAN = (0.485, 0.456, 0.406)
    IMAGENET_STD = (0.229, 0.224, 0.225)

    if train:
        aug = [
            transforms.RandomResizedCrop(img_size, scale=(0.85, 1.0), ratio=(0.9, 1.1)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomVerticalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.1, contrast=0.1),
        ]
    else:
        aug = [transforms.Resize((img_size, img_size))]

    # Cached dataset is already retina-cropped -> skip the per-epoch crop.
    pre = [] if precropped else [_Preprocess(ben_graham)]
    return transforms.Compose(
        [*pre, *aug, transforms.ToTensor(),
         transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD)]
    )


# ===========================================================================
# Dataset loading
# ===========================================================================
def _resolve_image_path(images_dir: Path, id_code: str) -> Path | None:
    for ext in (".png", ".jpg", ".jpeg", ".PNG", ".JPG"):
        p = images_dir / f"{id_code}{ext}"
        if p.exists():
            return p
    # id_code may already include an extension
    p = images_dir / id_code
    return p if p.exists() else None


def load_kaggle_index(data_root: Path) -> tuple[list[Path], list[int]]:
    """Read train.csv (id_code,diagnosis) + train_images/<id_code>.png."""
    import pandas as pd

    csv_path = data_root / "train.csv"
    images_dir = data_root / "train_images"
    if not csv_path.exists():
        raise FileNotFoundError(f"train.csv not found at {csv_path}")
    if not images_dir.exists():
        raise FileNotFoundError(f"train_images/ not found at {images_dir}")

    df = pd.read_csv(csv_path)
    if not {"id_code", "diagnosis"}.issubset(df.columns):
        raise ValueError(
            f"train.csv must have columns id_code,diagnosis; got {list(df.columns)}"
        )

    paths: list[Path] = []
    labels: list[int] = []
    missing = 0
    for _, row in df.iterrows():
        ip = _resolve_image_path(images_dir, str(row["id_code"]))
        if ip is None:
            missing += 1
            continue
        paths.append(ip)
        labels.append(int(row["diagnosis"]))
    if missing:
        print(f"  WARN: {missing} rows had no matching image file (skipped).")
    if not paths:
        raise RuntimeError("No images resolved from train.csv / train_images.")
    print(f"  Kaggle layout: {len(paths)} labeled images at {data_root}")
    return paths, labels


class FundusPathDataset:
    """torch Dataset over (image_path, label) with a transform."""

    def __init__(self, paths, labels, transform):
        self.paths = paths
        self.labels = labels
        self.transform = transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, i):
        from PIL import Image

        img = Image.open(self.paths[i]).convert("RGB")
        return self.transform(img), int(self.labels[i])


class FundusHFDataset:
    """torch Dataset wrapping an in-memory HF dataset (image, label)."""

    def __init__(self, hf_split, transform, label_key, image_key):
        self.ds = hf_split
        self.transform = transform
        self.label_key = label_key
        self.image_key = image_key

    def __len__(self):
        return len(self.ds)

    def __getitem__(self, i):
        row = self.ds[int(i)]
        img = row[self.image_key].convert("RGB")
        return self.transform(img), int(row[self.label_key])


# ===========================================================================
# Metrics (ARCHITECTURE.md §6)
# ===========================================================================
def compute_metrics(y_true, y_pred, referable_prob) -> dict:
    """Quadratic Weighted Kappa + referable sensitivity / specificity + AUC."""
    from sklearn.metrics import (
        cohen_kappa_score,
        confusion_matrix,
        roc_auc_score,
    )

    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    referable_prob = np.asarray(referable_prob)

    qwk = float(cohen_kappa_score(y_true, y_pred, weights="quadratic"))

    # Referable = grade >= 2 (binary).
    true_ref = (y_true >= REFERABLE_THRESHOLD).astype(int)
    pred_ref = (y_pred >= REFERABLE_THRESHOLD).astype(int)

    # Sensitivity / specificity from the 2x2 confusion matrix.
    tn, fp, fn, tp = confusion_matrix(true_ref, pred_ref, labels=[0, 1]).ravel()
    sensitivity = float(tp / (tp + fn)) if (tp + fn) else float("nan")
    specificity = float(tn / (tn + fp)) if (tn + fp) else float("nan")

    # Referable AUC uses P(referable) = sum of softmax over grades >= 2.
    try:
        auc = float(roc_auc_score(true_ref, referable_prob))
    except ValueError:
        auc = float("nan")  # only one class present in val (degenerate split)

    accuracy = float((y_true == y_pred).mean())

    # Per-class support for the deck's honesty (imbalance is visible).
    per_class_support = {
        ICDR_LABELS[c]: int((y_true == c).sum()) for c in range(NUM_CLASSES)
    }

    return {
        "quadratic_weighted_kappa": round(qwk, 4),
        "referable_sensitivity": round(sensitivity, 4),
        "referable_specificity": round(specificity, 4),
        "referable_auc": round(auc, 4),
        "accuracy": round(accuracy, 4),
        "referable_confusion": {
            "tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn),
        },
        "val_per_class_support": per_class_support,
    }


# ===========================================================================
# Focal loss (down-weights easy majority examples; targets the rare grades)
# ===========================================================================
class FocalLoss:
    def __init__(self, gamma=2.0, weight=None):
        import torch.nn as nn

        self.gamma = gamma
        self.ce = nn.CrossEntropyLoss(weight=weight, reduction="none")

    def __call__(self, logits, target):
        import torch

        ce = self.ce(logits, target)
        pt = torch.exp(-ce)
        return ((1 - pt) ** self.gamma * ce).mean()


# ===========================================================================
# Train / eval loops
# ===========================================================================
def run_epoch(model, loader, criterion, optimizer, device, train: bool):
    import torch

    model.train(train)
    total_loss, n = 0.0, 0
    all_true, all_pred, all_refprob = [], [], []

    ctx = torch.enable_grad() if train else torch.no_grad()
    with ctx:
        for images, labels in loader:
            images = images.to(device, non_blocking=True)
            labels = labels.to(device, non_blocking=True)

            if train:
                optimizer.zero_grad(set_to_none=True)

            logits = model(images)
            loss = criterion(logits, labels)

            if train:
                loss.backward()
                # Gradient clipping as a divergence safety net only. Keep it
                # GENEROUS (10.0): clipping too tightly (e.g. 1.0 vs natural norms
                # ~10-30) shrinks every step and neutralizes class rebalancing,
                # collapsing the model to the majority (No-DR). Imbalance is
                # handled by the data sampler, not by amplifying the loss.
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=10.0)
                optimizer.step()

            total_loss += float(loss.item()) * images.size(0)
            n += images.size(0)

            probs = torch.softmax(logits.detach(), dim=1)
            preds = probs.argmax(dim=1)
            ref_prob = probs[:, REFERABLE_THRESHOLD:].sum(dim=1)  # P(grade>=2)

            all_true.append(labels.detach().cpu().numpy())
            all_pred.append(preds.cpu().numpy())
            all_refprob.append(ref_prob.cpu().numpy())

    y_true = np.concatenate(all_true)
    y_pred = np.concatenate(all_pred)
    refprob = np.concatenate(all_refprob)
    return total_loss / max(n, 1), y_true, y_pred, refprob


# ===========================================================================
# Main
# ===========================================================================
def main() -> int:
    ap = argparse.ArgumentParser(description="KoʻzNur Phase-B APTOS fine-tune.")
    # Data
    ap.add_argument("--data-root", type=Path, default=None,
                    help="Kaggle APTOS dir with train.csv + train_images/.")
    ap.add_argument("--hf-dataset", type=str, default=None,
                    help="HF fallback dataset id (e.g. martinezomg/diabetic-retinopathy).")
    # Model
    ap.add_argument("--backbone", type=str, default="tf_efficientnet_b3_ns",
                    help="timm EfficientNet backbone (B0 speed / B3 accuracy).")
    ap.add_argument("--img-size", type=int, default=300,
                    help="Input size (224 for B0, 300 for B3).")
    # Optimization
    ap.add_argument("--epochs", type=int, default=15)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--weight-decay", type=float, default=1e-4)
    ap.add_argument("--val-frac", type=float, default=0.15)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--num-workers", type=int, default=4)
    ap.add_argument("--ben-graham", action="store_true",
                    help="Enable Ben Graham + CLAHE preprocessing (default off).")
    ap.add_argument("--precropped", action="store_true",
                    help="Images already retina-cropped (skip per-epoch crop) — for the cached dataset.")
    ap.add_argument("--no-class-weights", action="store_true",
                    help="Disable class-weighted loss (default: weighted).")
    # Imbalance handling — the core fix for the severe-grade (3/4) collapse.
    ap.add_argument("--sampler", choices=["none", "inverse", "sqrt"], default="inverse",
                    help="WeightedRandomSampler oversampling rare grades 3/4 (default inverse).")
    ap.add_argument("--loss", choices=["ce", "focal"], default="ce",
                    help="ce (label-smoothed) or focal (gamma). With --sampler on, ce is the safer default.")
    ap.add_argument("--focal-gamma", type=float, default=2.0)
    ap.add_argument("--label-smoothing", type=float, default=0.05)
    # Output
    ap.add_argument("--out-dir", type=Path, default=_BACKEND_DIR / "models",
                    help="Where to write koznur_efficientnet.pt + metrics.json.")
    args = ap.parse_args()

    import torch
    from sklearn.model_selection import train_test_split
    from torch.utils.data import DataLoader, WeightedRandomSampler

    try:
        import timm
    except ImportError:
        print("ERROR: timm is required. pip install -r backend/train/requirements.txt",
              file=sys.stderr)
        return 2

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    device = select_device()
    print(f"[finetune] device   = {device}")
    print(f"[finetune] backbone = {args.backbone} @ {args.img_size}px")
    args.out_dir.mkdir(parents=True, exist_ok=True)

    # -- transforms --------------------------------------------------------
    train_tf = build_transforms(args.img_size, args.ben_graham, train=True, precropped=args.precropped)
    val_tf = build_transforms(args.img_size, args.ben_graham, train=False, precropped=args.precropped)

    # -- load data + stratified split -------------------------------------
    if args.data_root is not None:
        paths, labels = load_kaggle_index(args.data_root)
        labels_arr = np.asarray(labels)
        idx = np.arange(len(paths))
        train_idx, val_idx = train_test_split(
            idx, test_size=args.val_frac, random_state=args.seed,
            stratify=labels_arr,
        )
        train_ds = FundusPathDataset(
            [paths[i] for i in train_idx], [labels[i] for i in train_idx], train_tf)
        val_ds = FundusPathDataset(
            [paths[i] for i in val_idx], [labels[i] for i in val_idx], val_tf)
        train_labels = labels_arr[train_idx]
        data_source = f"Kaggle APTOS 2019 @ {args.data_root}"

    elif args.hf_dataset is not None:
        from datasets import load_dataset

        print(f"[finetune] loading HF dataset {args.hf_dataset} ...")
        full = load_dataset(args.hf_dataset, split="train")
        cols = full.column_names
        label_key = "diagnosis" if "diagnosis" in cols else "label"
        image_key = "image"
        all_labels = np.asarray(full[label_key])
        idx = np.arange(len(full))
        train_idx, val_idx = train_test_split(
            idx, test_size=args.val_frac, random_state=args.seed,
            stratify=all_labels,
        )
        train_ds = FundusHFDataset(full.select(train_idx), train_tf, label_key, image_key)
        val_ds = FundusHFDataset(full.select(val_idx), val_tf, label_key, image_key)
        train_labels = all_labels[train_idx]
        data_source = f"HF {args.hf_dataset}"
    else:
        print("ERROR: provide --data-root (Kaggle) or --hf-dataset (fallback).",
              file=sys.stderr)
        return 2

    print(f"[finetune] train={len(train_ds)}  val={len(val_ds)}  source={data_source}")

    # -- WeightedRandomSampler: oversample rare grades 3/4 (the severe-collapse fix)
    train_sampler = None
    if args.sampler != "none":
        counts = np.bincount(np.asarray(train_labels), minlength=NUM_CLASSES).astype(np.float64)
        counts = np.where(counts > 0, counts, 1.0)
        per_class = 1.0 / counts if args.sampler == "inverse" else 1.0 / np.sqrt(counts)
        sample_w = per_class[np.asarray(train_labels)]
        train_sampler = WeightedRandomSampler(
            weights=torch.as_tensor(sample_w, dtype=torch.double),
            num_samples=len(train_labels), replacement=True,
        )
        print(f"[finetune] sampler = {args.sampler} (per-class w={[round(float(x), 5) for x in per_class]})")

    train_loader = DataLoader(
        train_ds, batch_size=args.batch_size,
        shuffle=(train_sampler is None), sampler=train_sampler,
        num_workers=args.num_workers, pin_memory=(device.type == "cuda"),
        persistent_workers=args.num_workers > 0, drop_last=False,
    )
    val_loader = DataLoader(
        val_ds, batch_size=args.batch_size, shuffle=False,
        num_workers=args.num_workers, pin_memory=(device.type == "cuda"),
        persistent_workers=args.num_workers > 0,
    )

    # -- class weights for imbalance (ARCHITECTURE.md §3) ------------------
    class_counts = np.bincount(train_labels, minlength=NUM_CLASSES).astype(np.float64)
    if args.no_class_weights:
        class_weights = None
        print(f"[finetune] class weights: DISABLED (counts={class_counts.tolist()})")
    else:
        # inverse-frequency, normalized to mean 1.0; guard against empty classes
        inv = np.where(class_counts > 0, class_counts.sum() / (NUM_CLASSES * class_counts), 0.0)
        inv = np.where(class_counts > 0, inv, inv[inv > 0].mean() if (inv > 0).any() else 1.0)
        class_weights = torch.tensor(inv, dtype=torch.float32, device=device)
        print(f"[finetune] class counts  = {class_counts.tolist()}")
        print(f"[finetune] class weights = {[round(float(w),3) for w in inv]}")

    # -- model -------------------------------------------------------------
    model = timm.create_model(
        args.backbone, pretrained=True, num_classes=NUM_CLASSES)
    model.to(device)

    # Avoid double-correcting: if the sampler already balances classes, keep the
    # loss unweighted (class weights on TOP of balanced sampling tanks specificity).
    loss_weight = None if args.sampler != "none" else class_weights
    if args.loss == "focal":
        criterion = FocalLoss(gamma=args.focal_gamma, weight=loss_weight)
        print(f"[finetune] loss = focal(gamma={args.focal_gamma}, weighted={loss_weight is not None})")
    else:
        criterion = torch.nn.CrossEntropyLoss(
            weight=loss_weight, label_smoothing=args.label_smoothing)
        print(f"[finetune] loss = CE(label_smoothing={args.label_smoothing}, weighted={loss_weight is not None})")
    optimizer = torch.optim.AdamW(
        model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=args.epochs)

    # -- train loop, select best by val QWK --------------------------------
    best_qwk = -1.0
    best_state = None
    best_metrics: dict | None = None
    history = []
    t0 = time.time()

    for epoch in range(1, args.epochs + 1):
        tr_loss, *_ = run_epoch(model, train_loader, criterion, optimizer, device, train=True)
        va_loss, y_true, y_pred, refprob = run_epoch(
            model, val_loader, criterion, optimizer, device, train=False)
        scheduler.step()

        m = compute_metrics(y_true, y_pred, refprob)
        history.append({"epoch": epoch, "train_loss": round(tr_loss, 4),
                        "val_loss": round(va_loss, 4), **m})
        print(f"[epoch {epoch:02d}/{args.epochs}] "
              f"train_loss={tr_loss:.4f} val_loss={va_loss:.4f} "
              f"QWK={m['quadratic_weighted_kappa']:.4f} "
              f"sens={m['referable_sensitivity']:.4f} "
              f"spec={m['referable_specificity']:.4f} "
              f"AUC={m['referable_auc']:.4f}")

        if m["quadratic_weighted_kappa"] > best_qwk:
            best_qwk = m["quadratic_weighted_kappa"]
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            best_metrics = m
            # Hang/crash-safe: persist the best checkpoint to disk IMMEDIATELY,
            # so a later MPS stall still leaves a usable model on disk.
            torch.save(
                {"state_dict": best_state, "backbone": args.backbone,
                 "img_size": args.img_size, "num_classes": NUM_CLASSES,
                 "icdr_labels": ICDR_LABELS, "referable_threshold": REFERABLE_THRESHOLD,
                 "normalize": {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
                 "ben_graham": bool(args.ben_graham), "framework": "timm",
                 "best_epoch": epoch, "metrics": best_metrics},
                args.out_dir / "koznur_efficientnet.pt",
            )
            print(f"  -> saved best checkpoint (epoch {epoch}, QWK={best_qwk:.4f})", flush=True)

    elapsed = round(time.time() - t0, 1)

    if best_state is None or best_metrics is None:
        print("ERROR: training produced no checkpoint.", file=sys.stderr)
        return 1

    # -- persist weights (models/koznur_efficientnet.pt) -------------------
    weights_path = args.out_dir / "koznur_efficientnet.pt"
    torch.save(
        {
            "state_dict": best_state,
            "backbone": args.backbone,
            "img_size": args.img_size,
            "num_classes": NUM_CLASSES,
            "icdr_labels": ICDR_LABELS,
            "referable_threshold": REFERABLE_THRESHOLD,
            "normalize": {"mean": [0.485, 0.456, 0.406],
                          "std": [0.229, 0.224, 0.225]},
            "ben_graham": bool(args.ben_graham),
            "framework": "timm",
        },
        weights_path,
    )
    print(f"[finetune] wrote weights -> {weights_path}")

    # -- persist metrics (models/metrics.json) -----------------------------
    metrics_doc = {
        "_about": (
            "KoʻzNur Phase-B MEASURED metrics on a held-out, stratified APTOS "
            "validation split (ARCHITECTURE.md §4/§6). These are real eval "
            "outputs — when this file exists the deck's performance slide may "
            "use §6 form (a). Triage / decision support, NOT diagnosis."
        ),
        "phase": "B",
        "project": "KoʻzNur",
        "team": "Zeno",
        "model": {
            "backbone": args.backbone,
            "framework": "timm (EfficientNet, ImageNet-pretrained)",
            "img_size": args.img_size,
            "num_classes": NUM_CLASSES,
            "icdr_labels": ICDR_LABELS,
            "referable_threshold": REFERABLE_THRESHOLD,
        },
        "data": {
            "source": data_source,
            "dataset": "APTOS 2019 Blindness Detection (ICDR 0-4)",
            "license": "Open Kaggle competition / research-use data (not proprietary).",
            "train_size": len(train_ds),
            "val_size": len(val_ds),
            "stratified_split": True,
            "val_frac": args.val_frac,
            "seed": args.seed,
            "class_weighted_loss": not args.no_class_weights,
            "ben_graham_clahe": bool(args.ben_graham),
        },
        "metrics": best_metrics,
        "selected_by": "best validation quadratic_weighted_kappa",
        "epochs_run": args.epochs,
        "train_seconds": elapsed,
        "history": history,
        "benchmark_context": {
            "target_qwk": 0.90,
            "reference": ("Gulshan et al. JAMA 2016 (AUC 0.991 for referable DR); "
                          "APTOS 2019 leaderboard."),
        },
        "honest_claims": (
            "Numbers above are measured by us on our own validation split. "
            "No FDA/regulatory clearance; no clinical deployment; "
            "image-quality dependent; needs prospective validation."
        ),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    metrics_path = args.out_dir / "metrics.json"
    metrics_path.write_text(
        json.dumps(metrics_doc, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"[finetune] wrote metrics -> {metrics_path}")
    print(f"[finetune] BEST val QWK={best_qwk:.4f} "
          f"sens={best_metrics['referable_sensitivity']:.4f} "
          f"spec={best_metrics['referable_specificity']:.4f} "
          f"AUC={best_metrics['referable_auc']:.4f}  ({elapsed}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
