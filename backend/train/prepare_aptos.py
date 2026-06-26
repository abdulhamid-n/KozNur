#!/usr/bin/env python3
"""Space-safe APTOS prep: stream train images out of the competition zip,
resize to <=512px JPEG, copy train.csv. NEVER extracts the (large) test set,
so peak disk stays ~= zip size only. Usage: prepare_aptos.py <zip> <out_dir>."""
import io
import os
import sys
import zipfile
from pathlib import Path

from PIL import Image


def main() -> int:
    zip_path = Path(sys.argv[1])
    out = Path(sys.argv[2])
    (out / "train_images").mkdir(parents=True, exist_ok=True)

    n = skipped = 0
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        print(f"[prep] {len(names)} members in zip")
        for name in names:
            if name.endswith("/"):
                continue
            base = os.path.basename(name)
            low = name.lower()
            if base == "train.csv":
                with z.open(name) as f:
                    (out / "train.csv").write_bytes(f.read())
                print("[prep] wrote train.csv")
            elif "train_images/" in name and low.endswith((".png", ".jpg", ".jpeg")):
                stem = Path(name).stem
                try:
                    with z.open(name) as f:
                        img = Image.open(io.BytesIO(f.read())).convert("RGB")
                    img.thumbnail((768, 768))  # keep aspect, cap long side at 768 (>= any model input)
                    img.save(out / "train_images" / f"{stem}.jpg", "JPEG", quality=95)
                    n += 1
                    if n % 500 == 0:
                        print(f"[prep] resized {n} train images ...")
                except Exception as exc:  # noqa: BLE001
                    skipped += 1
                    print(f"[prep] skip {name}: {exc}")
    print(f"[prep] DONE: {n} train images resized, {skipped} skipped -> {out}")
    return 0 if n else 1


if __name__ == "__main__":
    raise SystemExit(main())
