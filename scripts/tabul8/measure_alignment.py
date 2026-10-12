#!/usr/bin/env python3
"""
Measure same-person vs different-person cosine similarity after ArcFace alignment.

Usage:
  python3.14 measure_alignment.py
  python3.14 measure_alignment.py --images /path/to/face_jpgs

Downloads a few public sample faces when --images is omitted (cached under /tmp).
Prints recommended GREET / MATCH thresholds from the measured gap.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path
from typing import List, Tuple

import numpy as np

from mobilefacenet_embed import MODEL_VERSION, PIPELINE_ID, MobileFaceNet


def cos(a: List[float], b: List[float]) -> float:
    va = np.asarray(a, dtype=np.float32)
    vb = np.asarray(b, dtype=np.float32)
    return float(np.dot(va, vb))


SAMPLE_URLS = [
    # Public example faces (small set for offline-ish CI / Compil8r smoke)
    (
        "obama1",
        "https://raw.githubusercontent.com/ageitgey/face_recognition/master/examples/obama.jpg",
    ),
    (
        "obama2",
        "https://raw.githubusercontent.com/ageitgey/face_recognition/master/examples/obama2.jpg",
    ),
    (
        "biden",
        "https://raw.githubusercontent.com/ageitgey/face_recognition/master/examples/biden.jpg",
    ),
]


def load_bgr(path: Path):
    import cv2
    from PIL import Image, ImageOps
    import numpy as np

    try:
        from pillow_heif import register_heif_opener

        register_heif_opener()
    except Exception:
        pass
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        rgb = np.array(im.convert("RGB"))
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def ensure_samples(cache: Path) -> List[Tuple[str, Path]]:
    cache.mkdir(parents=True, exist_ok=True)
    out = []
    for name, url in SAMPLE_URLS:
        dest = cache / f"{name}.jpg"
        if not dest.is_file():
            print(f"Downloading {name}…")
            urllib.request.urlretrieve(url, dest)
        out.append((name, dest))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="")
    ap.add_argument("--det-model", default="")
    ap.add_argument("--images", default="", help="Directory of face images (optional)")
    ap.add_argument(
        "--cache",
        default="/tmp/tabul8_face_samples",
        help="Cache dir for downloaded samples",
    )
    args = ap.parse_args()

    print(f"Pipeline {PIPELINE_ID} model_version={MODEL_VERSION}")
    model = MobileFaceNet(args.model or None, args.det_model or None)

    paths: List[Tuple[str, Path]] = []
    if args.images:
        d = Path(args.images)
        for p in sorted(d.iterdir()):
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".heic"}:
                paths.append((p.stem, p))
    else:
        try:
            paths = ensure_samples(Path(args.cache))
        except Exception as exc:  # noqa: BLE001
            print(f"Sample download failed: {exc}", file=sys.stderr)
            print("Pass --images DIR with at least 2 face photos.", file=sys.stderr)
            return 2

    embeddings = {}
    for name, path in paths:
        try:
            bgr = load_bgr(path)
            vec = model.embed_bgr(bgr)
            embeddings[name] = vec
            print(f"  embedded {name} ({path.name})")
        except Exception as exc:  # noqa: BLE001
            print(f"  FAIL {name}: {exc}")

    names = list(embeddings.keys())
    if len(names) < 2:
        print("Need at least 2 successful embeddings", file=sys.stderr)
        return 1

    # Same-person: if we have obama1/obama2 use that pair; also self-sim.
    same_scores = []
    for n in names:
        same_scores.append(cos(embeddings[n], embeddings[n]))
    if "obama1" in embeddings and "obama2" in embeddings:
        same_scores.append(cos(embeddings["obama1"], embeddings["obama2"]))
        print(
            f"  same-person obama1↔obama2 = {cos(embeddings['obama1'], embeddings['obama2']):.4f}"
        )

    # Re-embed one image twice (pipeline stability)
    if paths:
        bgr = load_bgr(paths[0][1])
        a = model.embed_bgr(bgr)
        b = model.embed_bgr(bgr)
        stab = cos(a, b)
        same_scores.append(stab)
        print(f"  re-embed stability {paths[0][0]} = {stab:.4f}")

    diff_scores = []
    for i, n1 in enumerate(names):
        for n2 in names[i + 1 :]:
            if {n1, n2} == {"obama1", "obama2"}:
                continue
            s = cos(embeddings[n1], embeddings[n2])
            diff_scores.append(s)
            print(f"  different {n1}↔{n2} = {s:.4f}")

    same_arr = np.array(same_scores, dtype=np.float32)
    diff_arr = np.array(diff_scores, dtype=np.float32) if diff_scores else np.array([0.0])
    same_min = float(same_arr.min())
    same_mean = float(same_arr.mean())
    diff_max = float(diff_arr.max())
    diff_mean = float(diff_arr.mean())
    gap = same_min - diff_max

    # Place thresholds in the gap with margin.
    # MATCH midway toward different; GREET a bit higher.
    if gap > 0.08:
        match = round(diff_max + gap * 0.35, 2)
        greet = round(diff_max + gap * 0.55, 2)
    elif gap > 0.0:
        match = round(diff_max + gap * 0.4, 2)
        greet = round(diff_max + gap * 0.7, 2)
    else:
        # Overlap — fall back to conservative defaults for aligned MobileFaceNet.
        match = 0.38
        greet = 0.42
        print("WARNING: same/different distributions overlap; using conservative defaults")

    report = {
        "model_version": MODEL_VERSION,
        "pipeline": PIPELINE_ID,
        "same_person": {"min": round(same_min, 4), "mean": round(same_mean, 4), "n": len(same_scores)},
        "different_person": {
            "max": round(diff_max, 4),
            "mean": round(diff_mean, 4),
            "n": len(diff_scores),
        },
        "gap_same_min_minus_diff_max": round(gap, 4),
        "recommended_MATCH_THRESHOLD": match,
        "recommended_GREET_THRESHOLD": greet,
        "note": "Unaligned Photos crops previously measured same≈0.17–0.50 vs greet 0.55",
    }
    print("\n=== Alignment similarity report ===")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
