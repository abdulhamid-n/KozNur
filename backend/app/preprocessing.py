"""Fundus image preprocessing for KoʻzNur (ARCHITECTURE.md §3).

Pipeline order:
  (1) load RGB                                  -> done by the caller (PIL)
  (2) circular retina crop + tight bbox crop    -> retina_crop()        [default ON]
  (3) Ben Graham / CLAHE contrast normalization -> ben_graham_clahe()   [default OFF]
  (4) resize 224x224 bilinear  ┐
  (5) rescale /255             ├─ done by the bundled ViTImageProcessor
  (6) normalize mean=std=0.5   ┘  (model_runner.py — do NOT hardcode stats)

Steps 4-6 are intentionally NOT done here. This checkpoint expects the plain
ViTImageProcessor (resize + 0.5 normalization), so we hand it a clean RGB PIL
image and let the processor do the resize/rescale/normalize. Hardcoding
ImageNet mean/std here would degrade predictions (train/serve mismatch).
"""

from __future__ import annotations

import cv2
import numpy as np
from PIL import Image


def _to_rgb_array(pil_img: Image.Image) -> np.ndarray:
    """PIL (any mode) -> contiguous uint8 RGB numpy array (H, W, 3)."""
    return np.asarray(pil_img.convert("RGB"), dtype=np.uint8)


def retina_crop(pil_img: Image.Image, tol: int = 7) -> Image.Image:
    """Crop the black border around a circular fundus and mask to a circle.

    Finds the non-black region (per-pixel max channel > tol), crops to its
    tight bounding box, then applies a circular mask inscribed in that box so
    the dark corners do not bias the ViT. Falls back to the original image if
    the retina region cannot be located (e.g. an already-tight crop).
    """
    img = _to_rgb_array(pil_img)
    gray = img.max(axis=2)  # brighter than a luminance average for red fundus
    mask = gray > tol

    coords = np.argwhere(mask)
    if coords.size == 0:
        return pil_img  # all-black / empty — leave untouched

    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0) + 1
    cropped = img[y0:y1, x0:x1]

    h, w = cropped.shape[:2]
    if h < 8 or w < 8:
        return pil_img  # degenerate crop — bail out safely

    # Circular mask inscribed in the cropped bounding box.
    circ = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(circ, (w // 2, h // 2), min(h, w) // 2, 1, thickness=-1)
    masked = cropped * circ[:, :, None]

    return Image.fromarray(masked.astype(np.uint8), mode="RGB")


def ben_graham_clahe(
    pil_img: Image.Image,
    sigma_x: int = 10,
    clahe_clip: float = 2.0,
) -> Image.Image:
    """Optional Ben Graham + CLAHE contrast normalization (default OFF).

    Ben Graham (APTOS 2019 winner): subtract a heavy Gaussian blur to flatten
    illumination and amplify lesions:
        img = addWeighted(img, 4, GaussianBlur(img, sigmaX=10), -4, 128)
    Followed by CLAHE on the L channel. KEEP OFF for the Phase-A wrap unless
    A/B-tested — this checkpoint was trained on plain-processor images.
    """
    img = _to_rgb_array(pil_img)

    blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=sigma_x)
    img = cv2.addWeighted(img, 4, blurred, -4, 128)

    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clahe_clip, tileGridSize=(8, 8))
    l = clahe.apply(l)
    img = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2RGB)

    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), mode="RGB")


def preprocess(
    pil_img: Image.Image,
    *,
    enable_retina_crop: bool = True,
    enable_ben_graham: bool = False,
) -> Image.Image:
    """Run steps (1)-(3); return a clean RGB PIL image for the ViTImageProcessor.

    The processor handles resize/rescale/normalize (steps 4-6) downstream.
    """
    out = pil_img.convert("RGB")
    if enable_retina_crop:
        out = retina_crop(out)
    if enable_ben_graham:
        out = ben_graham_clahe(out)
    return out
