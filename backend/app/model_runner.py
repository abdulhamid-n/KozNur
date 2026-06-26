"""Phase-A DR classifier wrapper + Grad-CAM for KoʻzNur.

Wraps Kontawat/vit-diabetic-retinopathy-classification (ViT-Base/16,
ViTForImageClassification, apache-2.0). Verified against the live HF config:
  - preprocessor uses resize(224) + rescale(/255) + normalize(mean=std=0.5),
    NOT ImageNet stats. We let the bundled ViTImageProcessor do this so we
    never hardcode the wrong constants (the #1 silent-failure risk).
  - id2label = {0..4} is already in canonical ICDR order, so argmax index ==
    ICDR grade and `referable = grade >= 2` is correct directly.

Honest framing (ARCHITECTURE.md §6): this is a demo engine. Predictions are
real model outputs — never fabricated — but no KoʻzNur-measured accuracy is
claimed. Phase B produces our own weights + metrics.json.
"""

from __future__ import annotations

import base64
import io
import logging
import threading

import numpy as np
import torch
from PIL import Image
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from transformers import AutoImageProcessor, AutoModelForImageClassification

from . import config
from .preprocessing import preprocess

logger = logging.getLogger("koznur.model")


def _select_device() -> str:
    """Prefer MPS (Apple Silicon) per ARCHITECTURE.md §5; fall back to CPU."""
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


class _LogitsOnly(torch.nn.Module):
    """Adapter so pytorch-grad-cam sees a plain logits tensor.

    ViTForImageClassification returns an ``ImageClassifierOutput`` (a dict-like
    object), but pytorch-grad-cam's ClassifierOutputTarget expects the model's
    forward to return the logits tensor directly. This thin wrapper unwraps
    ``.logits`` while keeping the underlying module (and its hooks) intact.
    """

    def __init__(self, model: torch.nn.Module) -> None:
        super().__init__()
        self.model = model

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        return self.model(pixel_values=pixel_values).logits


def _vit_reshape_transform(tensor: torch.Tensor, h: int = 14, w: int = 14):
    """Drop the CLS token and reshape 196 patch tokens -> a 14x14 grid.

    224 / 16 = 14 patches per side. Required because ViT tokens are
    [B, 197, C], not a spatial conv map. Standard pytorch-grad-cam ViT recipe.
    """
    result = tensor[:, 1:, :].reshape(tensor.size(0), h, w, tensor.size(-1))
    return result.permute(0, 3, 1, 2)  # [B, C, 14, 14]


class DRModel:
    """Singleton-style wrapper: load once at startup, serve many requests."""

    def __init__(self) -> None:
        self.device: str = _select_device()
        self.processor = None
        self.model = None
        self._cam = None
        self._cam_target_layers = None
        self._lock = threading.Lock()  # serialize Grad-CAM (needs grad + state)
        self._loaded = False

    # -- lifecycle ---------------------------------------------------------
    def load(self) -> None:
        """Resolve + load the checkpoint. Idempotent; call at FastAPI startup."""
        if self._loaded:
            return
        source = config.MODEL_LOCAL_DIR or config.MODEL_ID
        logger.info("Loading DR model '%s' onto device '%s' ...", source, self.device)

        # The repo ships pytorch_model.bin only (no safetensors) — do NOT pass
        # use_safetensors=True; transformers handles the .bin load path.
        self.processor = AutoImageProcessor.from_pretrained(source)
        self.model = AutoModelForImageClassification.from_pretrained(source)
        self.model.to(self.device).eval()

        # Grad-CAM target: LayerNorm at the input of the last transformer block.
        # (A LayerNorm, NOT a conv — the stable pytorch-grad-cam ViT choice.)
        # The target layer must reference the SAME module object Grad-CAM runs
        # forward on, so resolve it through the _LogitsOnly wrapper.
        self._cam_model = _LogitsOnly(self.model)
        self._cam_target_layers = [
            self._cam_model.model.vit.encoder.layer[-1].layernorm_before
        ]
        self._cam = GradCAM(
            model=self._cam_model,
            target_layers=self._cam_target_layers,
            reshape_transform=_vit_reshape_transform,
        )
        self._loaded = True
        logger.info("DR model loaded. id2label=%s", self.model.config.id2label)

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    # -- inference ---------------------------------------------------------
    def predict(self, pil_img: Image.Image) -> dict:
        """Full pipeline: preprocess -> classify -> Grad-CAM -> contract JSON.

        Returns a dict matching ARCHITECTURE.md §5 exactly:
          grade, grade_label, referable, confidence, probabilities,
          gradcam_png_base64, recommendation
        """
        if not self._loaded:
            raise RuntimeError("Model not loaded. Call load() at startup.")

        # Steps (1)-(3): RGB + retina crop (+ optional Ben Graham).
        clean = preprocess(
            pil_img,
            enable_retina_crop=config.ENABLE_RETINA_CROP,
            enable_ben_graham=config.ENABLE_BEN_GRAHAM,
        )

        # Steps (4)-(6): resize/rescale/normalize handled by the bundled
        # ViTImageProcessor — mean=std=0.5, /255. Never hardcode ImageNet stats.
        inputs = self.processor(images=clean, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(self.device)

        with torch.no_grad():
            logits = self.model(pixel_values=pixel_values).logits  # [1, 5]
            probs = torch.softmax(logits, dim=-1)[0]

        grade = int(torch.argmax(probs).item())
        probabilities = [round(float(p), 4) for p in probs]  # ICDR order 0..4
        confidence = round(float(probs[grade].item()), 4)
        referable = grade >= config.REFERABLE_THRESHOLD

        gradcam_b64 = self._gradcam_overlay(pixel_values, clean, grade)

        return {
            "grade": grade,
            "grade_label": config.ICDR_LABELS[grade],
            "referable": referable,
            "confidence": confidence,
            "probabilities": probabilities,
            "gradcam_png_base64": gradcam_b64,
            "recommendation": (
                config.RECOMMENDATION_REFERABLE
                if referable
                else config.RECOMMENDATION_OK
            ),
        }

    # -- Grad-CAM ----------------------------------------------------------
    def _gradcam_overlay(
        self, pixel_values: torch.Tensor, clean_img: Image.Image, grade: int
    ) -> str:
        """Produce a base64 PNG: 14x14 CAM upsampled to 224, overlaid on fundus.

        Highlights hemorrhage / exudate regions for the predicted grade — the
        ARCHITECTURE.md §4 explainability differentiator. Serialized with a lock
        because Grad-CAM toggles gradients/hooks on the shared model.
        """
        with self._lock:
            grayscale_cam = self._cam(
                input_tensor=pixel_values,
                targets=[ClassifierOutputTarget(grade)],
            )[0]  # (224, 224) float in [0, 1]

        # Base image to overlay on = the same 224x224 the model saw, but in
        # plain [0,1] RGB (NOT the 0.5-normalized tensor) so the fundus colours
        # look natural under the heatmap.
        base = clean_img.resize((224, 224), Image.BILINEAR)
        base_rgb = np.asarray(base, dtype=np.float32) / 255.0

        overlay = show_cam_on_image(base_rgb, grayscale_cam, use_rgb=True)
        return self._png_to_base64(overlay)

    @staticmethod
    def _png_to_base64(rgb_array: np.ndarray) -> str:
        """uint8 RGB (H, W, 3) -> base64-encoded PNG string (no data: prefix)."""
        buf = io.BytesIO()
        Image.fromarray(rgb_array.astype(np.uint8), mode="RGB").save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("ascii")


# Module-level singleton used by main.py.
dr_model = DRModel()
