#!/usr/bin/env python3
"""Fetch a small, license-clean demo fundus gallery for KoʻzNur.

ARCHITECTURE.md §3 / §5: pulls a handful of REAL, openly-licensed APTOS 2019
fundus photographs spanning the ICDR DR grades into ``backend/samples/`` and
writes two manifests:

  - ``samples.json``  — full provenance (filename, true_grade, source, license)
  - ``manifest.json`` — the gallery list consumed by ``GET /samples``

Source
------
``sngsfydy/aptos_train`` on the Hugging Face Hub — a PUBLIC / ungated mirror of
the open APTOS 2019 Blindness Detection competition *training* set
(features: ``image``, ``label`` = ICDR grade 0-4). We read it via the HF
datasets-server ``/rows`` JSON API, so this script needs **no** ``datasets``
install, no HF token, and no Kaggle competition rules-accept gate — only the
Python stdlib + ``Pillow``.

(The previous draft of this script targeted ``martinezomg/diabetic-retinopathy``
via ``datasets.load_dataset``; that repo is gated and requires auth, so this
version uses an ungated mirror and the stdlib HTTP client instead.)

Honest framing (ARCHITECTURE.md §6): these images are demo inputs. Their
``true_grade`` is the dataset's ICDR label, used for demo narration only. It is
NOT a KoʻzNur model output, and nothing here implies a measured accuracy claim.

Licensing (ARCHITECTURE.md §3): open Kaggle competition / research-use data
(APTOS 2019). We do NOT claim a proprietary dataset.

Usage
-----
    python backend/scripts/fetch_samples.py                  # default 7 images
    python backend/scripts/fetch_samples.py --per-grade 2    # 2 per ICDR grade
    python backend/scripts/fetch_samples.py --out /path/to/samples

Idempotent: re-running overwrites the sample_*.jpg files and both manifests.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
HF_DATASET = "sngsfydy/aptos_train"
HF_CONFIG = "default"
HF_SPLIT = "train"
ROWS_API = "https://datasets-server.huggingface.co/rows"

ICDR_LABELS = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]
REFERABLE_THRESHOLD = 2

# Default curated spread — 7 images covering no-DR -> proliferative.
# (grade, how_many) ; severe (grade 3) is rarer so we ask for 1.
DEFAULT_PLAN = [(0, 2), (1, 1), (2, 2), (3, 1), (4, 1)]

USER_AGENT = "KoznurFetchSamples/1.0 (+ARCHITECTURE.md hackathon demo)"
SCAN_PAGES = 12          # pages of 100 rows to scan for grade coverage
PAGE_LEN = 100
HTTP_TIMEOUT = 60


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_json(url: str, retries: int = 3) -> dict:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001 - retry any transient failure
            last_err = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"GET failed after {retries} tries: {url}\n  {last_err}")


def _get_bytes(url: str, retries: int = 3) -> bytes:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
                return resp.read()
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"download failed after {retries} tries: {url}\n  {last_err}")


def _collect_candidates(per_grade_needed: dict[int, int]) -> dict[int, list[tuple[int, str]]]:
    """Scan rows; return {grade: [(row_idx, image_src_url), ...]} per grade."""
    found: dict[int, list[tuple[int, str]]] = {g: [] for g in per_grade_needed}
    for offset in range(0, SCAN_PAGES * PAGE_LEN, PAGE_LEN):
        url = (
            f"{ROWS_API}?dataset={urllib.parse.quote(HF_DATASET)}"
            f"&config={HF_CONFIG}&split={HF_SPLIT}"
            f"&offset={offset}&length={PAGE_LEN}"
        )
        data = _get_json(url)
        rows = data.get("rows", [])
        if not rows:
            break
        for row in rows:
            idx = row["row_idx"]
            payload = row["row"]
            grade = payload.get("label")
            img = payload.get("image")
            src = img.get("src") if isinstance(img, dict) else None
            if grade in found and src and len(found[grade]) < per_grade_needed[grade]:
                found[grade].append((idx, src))
        if all(len(found[g]) >= n for g, n in per_grade_needed.items()):
            break
    return found


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> int:
    here = Path(__file__).resolve()
    default_out = here.parent.parent / "samples"  # backend/samples

    ap = argparse.ArgumentParser(description="Fetch APTOS demo fundus samples.")
    ap.add_argument("--out", type=Path, default=default_out,
                    help="output samples dir (default: backend/samples)")
    ap.add_argument("--per-grade", type=int, default=None,
                    help="override: pull N images for EACH ICDR grade 0-4")
    args = ap.parse_args()

    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    if args.per_grade is not None:
        plan = [(g, max(1, args.per_grade)) for g in range(5)]
    else:
        plan = DEFAULT_PLAN

    per_grade_needed: dict[int, int] = {}
    for grade, n in plan:
        per_grade_needed[grade] = per_grade_needed.get(grade, 0) + n

    print(f"[fetch_samples] dataset = {HF_DATASET} (public APTOS 2019 mirror)")
    print(f"[fetch_samples] plan    = {per_grade_needed}")
    print(f"[fetch_samples] out     = {out}")

    try:
        from PIL import Image
    except ImportError:
        print("ERROR: Pillow is required. pip install pillow", file=sys.stderr)
        return 2

    try:
        candidates = _collect_candidates(per_grade_needed)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR scanning dataset rows: {exc}", file=sys.stderr)
        print("If you are offline, place fundus images in the samples dir "
              "manually and list them in manifest.json.", file=sys.stderr)
        return 1

    samples_records: list[dict] = []
    manifest_records: list[dict] = []
    counter = 0
    for grade, n in plan:
        bucket = candidates.get(grade, [])
        for _ in range(n):
            if not bucket:
                print(f"  WARN: ran out of grade-{grade} examples", file=sys.stderr)
                break
            row_idx, src = bucket.pop(0)
            try:
                raw = _get_bytes(src)
                img = Image.open(io.BytesIO(raw)).convert("RGB")
            except Exception as exc:  # noqa: BLE001
                print(f"  WARN: skip row {row_idx} (grade {grade}): {exc}",
                      file=sys.stderr)
                continue

            fname = f"sample_{counter:02d}_grade{grade}.jpg"
            img.save(out / fname, format="JPEG", quality=92)
            sha16 = hashlib.sha256(raw).hexdigest()[:16]
            referable = grade >= REFERABLE_THRESHOLD

            samples_records.append({
                "id": f"sample-{counter:02d}-grade{grade}",
                "filename": fname,
                "true_grade": grade,
                "grade_label": ICDR_LABELS[grade],
                "referable": referable,
                "width": img.width,
                "height": img.height,
                "sha256_16": sha16,
                "source_row_idx": row_idx,
                "source": f"{HF_DATASET} [{HF_SPLIT}]",
                "license": "APTOS 2019 open competition / research-use",
            })
            manifest_records.append({
                "id": f"sample-{counter:02d}-grade{grade}",
                "filename": fname,
                "label": f"{ICDR_LABELS[grade]} (ICDR {grade}) — demo"
                         + (", referable" if referable else ""),
                "expected_grade": grade,
            })
            print(f"  OK {fname}  {img.size}  grade={grade}"
                  f"({ICDR_LABELS[grade]})  referable={referable}")
            counter += 1

    if not samples_records:
        print("ERROR: no samples fetched.", file=sys.stderr)
        return 1

    # --- write samples.json (full provenance) ---
    samples_doc = {
        "_about": (
            "KoʻzNur demo fundus gallery — provenance manifest "
            "(ARCHITECTURE.md §3, §5). Real, openly-licensed APTOS 2019 fundus "
            "photographs spanning ICDR grades. 'true_grade' is the dataset ICDR "
            "label for demo narration only — NOT a model output. "
            "Referable = true_grade >= 2."
        ),
        "dataset": {
            "name": "APTOS 2019 Blindness Detection (Aravind Eye Hospital, India)",
            "grading_scale": ("ICDR 5-level (0 No DR, 1 Mild, 2 Moderate, "
                              "3 Severe, 4 Proliferative)"),
            "referable_threshold": REFERABLE_THRESHOLD,
            "fetch_source": {
                "type": "huggingface_dataset",
                "repo_id": HF_DATASET,
                "split": HF_SPLIT,
                "access": "public / ungated",
                "url": f"https://huggingface.co/datasets/{HF_DATASET}",
                "note": ("Ungated HF mirror of the open APTOS 2019 competition "
                         "training set; rows pulled via the HF datasets-server "
                         "/rows API."),
            },
            "license": ("Open Kaggle competition / research-use data "
                        "(APTOS 2019 Blindness Detection). Not proprietary."),
            "license_url": ("https://www.kaggle.com/competitions/"
                            "aptos2019-blindness-detection/rules"),
            "fetched_at": time.strftime("%Y-%m-%d"),
        },
        "samples": samples_records,
    }
    (out / "samples.json").write_text(json.dumps(samples_doc, indent=2,
                                                 ensure_ascii=False) + "\n",
                                      encoding="utf-8")

    # --- write manifest.json (consumed by GET /samples) ---
    manifest_doc = {
        "_comment": (
            "Curated demo fundus gallery for GET /samples (ARCHITECTURE.md §5). "
            "Generated by scripts/fetch_samples.py — see samples.json for full "
            "provenance + licensing. 'expected_grade' is the dataset ICDR label "
            "for demo narration only, NOT a model output."
        ),
        "samples": manifest_records,
    }
    (out / "manifest.json").write_text(json.dumps(manifest_doc, indent=2,
                                                  ensure_ascii=False) + "\n",
                                       encoding="utf-8")

    print(f"[fetch_samples] wrote {len(samples_records)} images + "
          f"samples.json + manifest.json to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
