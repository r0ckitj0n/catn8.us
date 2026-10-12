"""
Shared MobileFaceNet embedding helper (InsightFace buffalo_s w600k_mbf.onnx).

Must stay aligned with browser tabul8Face.ts:
  - ArcFace 5-point similarity warp → 112×112 RGB
  - NCHW float32, (pixel - 127.5) / 128
  - L2-normalize output (512-d)
  - MODEL_VERSION bumps when the pipeline changes (old embeddings ignored)
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

import numpy as np

from face_align import (
    INPUT_SIZE,
    ScrfdDetector,
    align_face_bgr,
    crop_box_from_photos_face,
    photos_center_to_pixel,
    resolve_onnx_path,
)

MODEL_NAME = "mobilefacenet"
# Bump when alignment / preprocess changes — server ignores older embeddings.
MODEL_VERSION = "2.0-arcface"
PIPELINE_ID = "arcface5-scrfd-mbf"
EMBEDDING_DIMS = 512


def l2_normalize(vec: np.ndarray) -> np.ndarray:
    vec = np.asarray(vec, dtype=np.float32).reshape(-1)
    n = float(np.linalg.norm(vec))
    if n < 1e-12:
        raise ValueError("zero embedding")
    return (vec / n).astype(np.float32)


def preprocess_bgr_aligned(bgr_112: np.ndarray) -> np.ndarray:
    """Aligned BGR 112×112 → NCHW float32 batch [1,3,112,112]."""
    import cv2

    if bgr_112 is None or bgr_112.size == 0:
        raise ValueError("empty image")
    if bgr_112.shape[0] != INPUT_SIZE or bgr_112.shape[1] != INPUT_SIZE:
        bgr_112 = cv2.resize(bgr_112, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_LINEAR)
    rgb = cv2.cvtColor(bgr_112, cv2.COLOR_BGR2RGB)
    arr = rgb.astype(np.float32)
    arr = (arr - 127.5) / 128.0
    chw = np.transpose(arr, (2, 0, 1))
    return np.expand_dims(chw, axis=0)


class MobileFaceNet:
    def __init__(
        self,
        model_path: Optional[str | Path] = None,
        det_path: Optional[str | Path] = None,
    ) -> None:
        import onnxruntime as ort

        path = resolve_onnx_path(
            "mobilefacenet.onnx", str(model_path) if model_path else None
        )
        self.session = ort.InferenceSession(
            str(path), providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        self.detector = ScrfdDetector(det_path)

    def embed_aligned_bgr(self, bgr_112: np.ndarray) -> List[float]:
        tensor = preprocess_bgr_aligned(bgr_112)
        out = self.session.run([self.output_name], {self.input_name: tensor})[0]
        vec = l2_normalize(np.asarray(out).reshape(-1))
        return [float(x) for x in vec.tolist()]

    def embed_bgr_with_kps(self, bgr: np.ndarray, kps5: np.ndarray) -> List[float]:
        aligned = align_face_bgr(bgr, kps5, image_size=INPUT_SIZE)
        return self.embed_aligned_bgr(aligned)

    def embed_photos_face(
        self,
        bgr: np.ndarray,
        center_x: float,
        center_y: float,
        size: float,
        *,
        y_from_bottom: bool = True,
    ) -> List[float]:
        """
        Align using SCRFD 5-pt near the Photos face center (Y flipped from bottom).
        Falls back to box-estimated landmarks only if SCRFD finds nothing.
        """
        h, w = bgr.shape[:2]
        cx, cy = photos_center_to_pixel(
            center_x, center_y, w, h, y_from_bottom=y_from_bottom
        )
        # Search in a padded crop around the Photos box for speed + accuracy.
        try:
            x0, y0, x1, y1 = crop_box_from_photos_face(
                w, h, center_x, center_y, size, pad=0.6, y_from_bottom=y_from_bottom
            )
            region = bgr[y0:y1, x0:x1]
            kps_local = self.detector.best_kps_near(
                region, cx - x0, cy - y0, threshold=0.35
            )
            if kps_local is not None:
                kps = kps_local.copy()
                kps[:, 0] += x0
                kps[:, 1] += y0
                return self.embed_bgr_with_kps(bgr, kps)
        except Exception:
            pass

        # Full-image SCRFD fallback (still no whole-library file walk).
        kps = self.detector.best_kps_near(bgr, cx, cy, threshold=0.35)
        if kps is not None:
            return self.embed_bgr_with_kps(bgr, kps)

        # Last resort: approximate 5 pts from the Photos box (better than raw resize).
        x0, y0, x1, y1 = crop_box_from_photos_face(
            w, h, center_x, center_y, size, pad=0.2, y_from_bottom=y_from_bottom
        )
        bw, bh = float(x1 - x0), float(y1 - y0)
        kps = np.array(
            [
                [x0 + 0.3 * bw, y0 + 0.35 * bh],
                [x0 + 0.7 * bw, y0 + 0.35 * bh],
                [x0 + 0.5 * bw, y0 + 0.55 * bh],
                [x0 + 0.35 * bw, y0 + 0.75 * bh],
                [x0 + 0.65 * bw, y0 + 0.75 * bh],
            ],
            dtype=np.float32,
        )
        return self.embed_bgr_with_kps(bgr, kps)

    def embed_bgr(self, bgr: np.ndarray) -> List[float]:
        """Detect largest face with SCRFD, align, embed."""
        boxes, kpss = self.detector.detect(bgr, threshold=0.5, max_num=5)
        if boxes.shape[0] == 0:
            raise ValueError("no face detected")
        # Largest box area
        areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
        idx = int(np.argmax(areas))
        return self.embed_bgr_with_kps(bgr, kpss[idx])
