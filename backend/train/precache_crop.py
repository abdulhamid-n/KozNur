#!/usr/bin/env python3
"""One-time pre-crop: retina-crop + resize each train image and cache to disk,
so training (num_workers=0, no DataLoader multiprocessing) skips the expensive
per-epoch cv2 work. Usage: precache_crop.py <src_dir> <dst_dir> [size=384]."""
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def retina_crop(pil):
    img = np.asarray(pil.convert("RGB"), dtype=np.uint8)
    gray = img.max(axis=2)
    coords = np.argwhere(gray > 7)
    if coords.size == 0:
        return pil
    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0) + 1
    cropped = img[y0:y1, x0:x1]
    h, w = cropped.shape[:2]
    if h < 8 or w < 8:
        return pil
    circ = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(circ, (w // 2, h // 2), min(h, w) // 2, 1, thickness=-1)
    return Image.fromarray((cropped * circ[:, :, None]).astype(np.uint8), "RGB")


def main() -> int:
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    size = int(sys.argv[3]) if len(sys.argv) > 3 else 384
    (dst / "train_images").mkdir(parents=True, exist_ok=True)
    shutil.copy(src / "train.csv", dst / "train.csv")
    imgs = sorted((src / "train_images").glob("*.jpg"))
    n = 0
    for p in imgs:
        try:
            img = retina_crop(Image.open(p))
            img.thumbnail((size, size))
            img.save(dst / "train_images" / p.name, "JPEG", quality=92)
            n += 1
            if n % 500 == 0:
                print(f"  cached {n}/{len(imgs)}", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"skip {p.name}: {exc}", flush=True)
    print(f"DONE cached {n} -> {dst}", flush=True)
    return 0 if n else 1


if __name__ == "__main__":
    raise SystemExit(main())
