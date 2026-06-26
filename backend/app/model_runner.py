"""KoʻzNur serving engine — SE-ResNeXt50 diabetic-retinopathy grader.

INTEGRATED REFERENCE MODEL (not weights we trained ourselves):
  Openly published, MIT-licensed APTOS-2019 solution by `4uiiurz1`
  (https://github.com/4uiiurz1/kaggle-aptos2019-blindness-detection,
  private leaderboard QWK 0.930). See REFERENCE_MODEL.md for full provenance
  and the upstream MIT license. We use the released weights as the
  production reference engine; our own trained baseline lives separately
  under train/ with its own metrics. Predictions here are real model
  outputs — never fabricated.

Inference pipeline replicates the original exactly:
  scale-radius (Ben Graham) crop @288  ->  resize 256  ->  ImageNet normalize
  ->  SE-ResNeXt50 (regression, 1 output)  ->  round at [0.5,1.5,2.5,3.5].
Ensembles the 5 cross-validation folds (mean of regression outputs).
"""

from __future__ import annotations

import base64
import io
import logging
import threading

import cv2
import numpy as np
import torch
import torch.nn as nn
import torchvision.transforms as T
import pretrainedmodels
from PIL import Image
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

from . import config

logger = logging.getLogger("koznur.model")

_WEIGHTS_DIR = config.BACKEND_DIR / "models" / "aptos_winner" / "se_resnext50_32x4d"
_THRS = [0.5, 1.5, 2.5, 3.5]      # regression -> ICDR grade (their thresholds)
_INPUT = 256                       # model input size
_SCALE_IMG = 288                   # scale-radius target diameter


def _select_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _scale_radius(src: np.ndarray, img_size: int = _SCALE_IMG) -> np.ndarray:
    """Ben Graham retina crop: find fundus radius + centroid, crop, rescale so
    the retina diameter == img_size. Falls back to a plain resize on failure."""
    try:
        x = src[src.shape[0] // 2, ...].sum(axis=1)
        r = int((x > x.mean() / 10).sum() // 2)
        if r < 10:
            raise ValueError("tiny radius")
        yx = src.sum(axis=2)
        ys, xs = np.nonzero(yx > yx.mean() / 10)
        yc, xc = int(round(ys.mean())), int(round(xs.mean()))
        x1, x2 = max(xc - r, 0), min(xc + r, src.shape[1] - 1)
        y1, y2 = max(yc - r, 0), min(yc + r, src.shape[0] - 1)
        dst = src[y1:y2, x1:x2]
        return cv2.resize(dst, None, fx=img_size / (2 * r), fy=img_size / (2 * r))
    except Exception:
        return cv2.resize(src, (img_size, img_size))


_TFM = T.Compose([
    T.Resize((_INPUT, _INPUT)),
    T.ToTensor(),
    T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def _build() -> nn.Module:
    m = pretrainedmodels.se_resnext50_32x4d(num_classes=1000, pretrained=None)
    m.avg_pool = nn.AdaptiveAvgPool2d(1)
    m.last_linear = nn.Linear(2048, 1)   # regression head
    return m


def _soft_probs(reg: float, sigma: float = 0.7) -> np.ndarray:
    """Derive a 5-way pseudo-distribution from the regression value, so the UI
    keeps a probabilities[5] + confidence. Honest: it reflects how close the
    regression output is to each integer ICDR grade, not a softmax."""
    grades = np.arange(5)
    w = np.exp(-((grades - reg) ** 2) / (2 * sigma * sigma))
    return w / w.sum()


class DRModel:
    """Load the 5-fold SE-ResNeXt50 ensemble once; serve many requests."""

    def __init__(self) -> None:
        self.device = _select_device()
        self.models: list[nn.Module] = []
        self._cam = None
        self._cam_model = None
        self._lock = threading.Lock()
        self._loaded = False

    def load(self) -> None:
        if self._loaded:
            return
        logger.info("Loading SE-ResNeXt50 5-fold ensemble from %s on %s",
                    _WEIGHTS_DIR, self.device)
        for f in range(1, 6):
            m = _build()
            sd = torch.load(_WEIGHTS_DIR / f"model_{f}.pth",
                            map_location="cpu", weights_only=True)
            m.load_state_dict(sd)
            self.models.append(m.eval().to(self.device))
        # Grad-CAM on the best fold (fold 2, CV QWK 0.933); last conv block.
        self._cam_model = self.models[1]
        self._cam = GradCAM(model=self._cam_model,
                            target_layers=[self._cam_model.layer4[-1]])
        self._loaded = True
        logger.info("SE-ResNeXt50 ensemble loaded (%d folds).", len(self.models))

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def predict(self, pil_img: Image.Image) -> dict:
        if not self._loaded:
            raise RuntimeError("Model not loaded. Call load() at startup.")
        rgb = np.asarray(pil_img.convert("RGB"))
        cropped = _scale_radius(rgb)
        x = _TFM(Image.fromarray(cropped)).unsqueeze(0).to(self.device)

        with torch.no_grad():
            regs = [float(m(x).cpu().numpy()[0, 0]) for m in self.models]
        reg = float(np.mean(regs))

        grade = int(np.digitize([reg], _THRS)[0])           # 0..4
        probs = _soft_probs(reg)
        confidence = round(float(probs[grade]), 4)
        referable = bool(reg >= _THRS[1])                    # grade >= 2

        gradcam_b64 = self._gradcam(x, cropped)
        return {
            "grade": grade,
            "grade_label": config.ICDR_LABELS[grade],
            "referable": referable,
            "confidence": confidence,
            "probabilities": [round(float(p), 4) for p in probs],
            "gradcam_png_base64": gradcam_b64,
            "recommendation": (
                config.RECOMMENDATION_REFERABLE if referable
                else config.RECOMMENDATION_OK
            ),
        }

    def _gradcam(self, x: torch.Tensor, cropped_rgb: np.ndarray) -> str:
        """CAM for the regression output (regions driving higher severity)."""
        with self._lock:
            cam = self._cam(input_tensor=x,
                            targets=[ClassifierOutputTarget(0)])[0]
        base = cv2.resize(cropped_rgb, (_INPUT, _INPUT)).astype(np.float32) / 255.0
        overlay = show_cam_on_image(base, cam, use_rgb=True)
        buf = io.BytesIO()
        Image.fromarray(overlay.astype(np.uint8), "RGB").save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("ascii")


# Module-level singleton used by main.py.
dr_model = DRModel()
