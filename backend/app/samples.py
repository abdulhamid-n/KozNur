"""Curated demo fundus gallery for GET /samples (ARCHITECTURE.md §5).

Serves images from backend/samples/ plus a manifest so the frontend gallery
never depends on the judge having a photo.

Manifest resolution (first that exists wins for an entry):
  1. samples/samples.json  — the rich provenance manifest (APTOS lineage,
     `true_grade`, `grade_label`, license). Preferred.
  2. samples/manifest.json — simple {filename,label,expected_grade} list.
  3. bare image files       — any .png/.jpg not covered above (id = stem).

Entries whose file is missing on disk are skipped so the gallery never points
at a 404. `true_grade` / `expected_grade` are the DATASET label for demo
narration only — they are NOT KoʻzNur model outputs.
"""

from __future__ import annotations

import json
import logging

from . import config

logger = logging.getLogger("koznur.samples")

_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
# Rich provenance manifest written by scripts/fetch_samples.py / curation.
_PROVENANCE_MANIFEST = "samples.json"


def load_manifest() -> list[dict]:
    """Return the sample manifest as a list of normalized entries.

    Each entry: {id, filename, url, label, expected_grade, referable, license}.
    `url` is served by the static mount in main.py at /samples/<filename>.
    """
    if not config.SAMPLES_DIR.exists():
        return []

    on_disk = {
        p.name
        for p in config.SAMPLES_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in _IMAGE_EXTS
    }

    entries: list[dict] = []
    used: set[str] = set()

    # 1) Rich provenance manifest (samples.json), if present.
    prov_path = config.SAMPLES_DIR / _PROVENANCE_MANIFEST
    if prov_path.exists():
        for item in _read_items(prov_path):
            fname = item.get("filename")
            if not fname or fname not in on_disk:
                if fname:
                    logger.warning("samples.json references missing file: %s", fname)
                continue
            entries.append(_normalize_entry(item, fname))
            used.add(fname)

    # 2) Simple manifest (manifest.json) for any not yet covered.
    if config.SAMPLES_MANIFEST.exists():
        for item in _read_items(config.SAMPLES_MANIFEST):
            fname = item.get("filename")
            if not fname or fname not in on_disk or fname in used:
                if fname and fname not in on_disk:
                    logger.warning("manifest.json references missing file: %s", fname)
                continue
            entries.append(_normalize_entry(item, fname))
            used.add(fname)

    # 3) Bare image files not covered by either manifest.
    for fname in sorted(on_disk - used):
        entries.append(_normalize_entry({}, fname))

    # Stable order by filename for a predictable gallery.
    entries.sort(key=lambda e: e["filename"])
    return entries


def _read_items(path) -> list[dict]:
    """Parse a manifest file -> list of sample dicts (tolerant of shape)."""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to parse %s: %s", path.name, exc)
        return []
    if isinstance(raw, dict):
        items = raw.get("samples", [])
    elif isinstance(raw, list):
        items = raw
    else:
        items = []
    return [i for i in items if isinstance(i, dict)]


def _normalize_entry(item: dict, fname: str) -> dict:
    """Map either manifest schema onto the response shape the frontend reads."""
    # Grade can come from 'true_grade' (samples.json) or 'expected_grade'.
    grade = item.get("true_grade", item.get("expected_grade"))
    grade = int(grade) if isinstance(grade, (int, float)) else None

    grade_label = item.get("grade_label")
    if grade_label is None and grade is not None and 0 <= grade < len(config.ICDR_LABELS):
        grade_label = config.ICDR_LABELS[grade]

    # Human label for the gallery card.
    label = item.get("label")
    if label is None:
        if grade is not None:
            ref = " — referable" if grade >= config.REFERABLE_THRESHOLD else ""
            label = f"{grade_label} (ICDR {grade}){ref}"
        else:
            label = _stem(fname)

    referable = item.get("referable")
    if referable is None and grade is not None:
        referable = grade >= config.REFERABLE_THRESHOLD

    return {
        "id": str(item.get("id") or _stem(fname)),
        "filename": fname,
        "url": f"/samples/{fname}",
        "label": label,
        "expected_grade": grade,
        "referable": referable,
        "license": item.get("license"),
    }


def _stem(fname: str) -> str:
    return fname.rsplit(".", 1)[0]
