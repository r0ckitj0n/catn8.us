"""
ArcFace-style 5-point alignment shared by Compil8r preload.

Pipeline version must stay in sync with browser tabul8Face.ts and
Tabul8IdentityModel::MODEL_VERSION.

Landmark source (Python): InsightFace buffalo_s SCRFD det_500m.onnx (5 kps).
Browser uses face-api landmarks68 → same 5 points → same ArcFace 112 template.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

import numpy as np

# InsightFace ArcFace 112×112 reference landmarks (left eye, right eye, nose, left mouth, right mouth).
ARCFACE_DST = np.array(
    [
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041],
    ],
    dtype=np.float32,
)

INPUT_SIZE = 112
SCRFD_INPUT = 640


def resolve_onnx_path(filename: str, explicit: Optional[str] = None) -> Path:
    """Resolve model path: explicit → env → script-relative assets → repo assets."""
    if explicit:
        p = Path(explicit)
        if p.is_file():
            return p
        raise FileNotFoundError(f"ONNX not found: {explicit}")

    env_key = "TABUL8_MOBILEFACENET" if "mobilefacenet" in filename else "TABUL8_SCRFD"
    env = os.environ.get(env_key, "").strip()
    if env:
        p = Path(env)
        if p.is_file():
            return p

    script_dir = Path(__file__).resolve().parent
    candidates = [
        # Flattened Compil8r install: /Users/jongraves/catn8-tabul8/assets/...
        script_dir / "assets" / "tabul8" / "onnx" / filename,
        # Install root with scripts/tabul8/*.py
        script_dir.parent / "assets" / "tabul8" / "onnx" / filename,
        # Full catn8.us repo: scripts/tabul8 → ../../assets
        script_dir.parents[1] / "assets" / "tabul8" / "onnx" / filename,
        script_dir.parents[2] / "assets" / "tabul8" / "onnx" / filename
        if len(script_dir.parents) > 2
        else None,
    ]
    for c in candidates:
        if c is not None and c.is_file():
            return c
    raise FileNotFoundError(
        f"{filename} not found. Tried script-dir assets and repo assets. "
        "Run fetch_model.sh or copy assets/tabul8/onnx next to the scripts."
    )


def estimate_norm(lmk: np.ndarray, image_size: int = INPUT_SIZE) -> np.ndarray:
    """Similarity transform 2×3 mapping 5 landmarks → ArcFace template."""
    import cv2

    lmk = np.asarray(lmk, dtype=np.float32).reshape(5, 2)
    dst = ARCFACE_DST.copy()
    if image_size != 112:
        scale = float(image_size) / 112.0
        dst *= scale
    m, _ = cv2.estimateAffinePartial2D(lmk, dst, method=cv2.LMEDS)
    if m is None:
        # Fallback: crude scale/translate from eye distance
        src_c = lmk.mean(axis=0)
        dst_c = dst.mean(axis=0)
        src_d = np.linalg.norm(lmk[0] - lmk[1]) + 1e-6
        dst_d = np.linalg.norm(dst[0] - dst[1])
        s = dst_d / src_d
        m = np.array(
            [[s, 0.0, dst_c[0] - s * src_c[0]], [0.0, s, dst_c[1] - s * src_c[1]]],
            dtype=np.float32,
        )
    return m.astype(np.float32)


def align_face_bgr(bgr: np.ndarray, kps5: np.ndarray, image_size: int = INPUT_SIZE) -> np.ndarray:
    """Warp BGR image to ArcFace 112×112 using 5 landmarks."""
    import cv2

    m = estimate_norm(kps5, image_size=image_size)
    return cv2.warpAffine(bgr, m, (image_size, image_size), borderValue=0.0)


def photos_center_to_pixel(
    center_x: float,
    center_y: float,
    width: int,
    height: int,
    *,
    y_from_bottom: bool = True,
) -> Tuple[float, float]:
    """
    Apple Photos ZDETECTEDFACE center is normalized 0–1.
    Center Y is measured from the BOTTOM of the image — flip to top-origin pixels.
    """
    cx = float(center_x) * float(width)
    if y_from_bottom:
        cy = (1.0 - float(center_y)) * float(height)
    else:
        cy = float(center_y) * float(height)
    return cx, cy


def crop_box_from_photos_face(
    width: int,
    height: int,
    center_x: float,
    center_y: float,
    size: float,
    pad: float = 0.35,
    *,
    y_from_bottom: bool = True,
) -> Tuple[int, int, int, int]:
    """Return integer x0,y0,x1,y1 for a padded square-ish face crop."""
    cx, cy = photos_center_to_pixel(
        center_x, center_y, width, height, y_from_bottom=y_from_bottom
    )
    side = max(float(size) * max(width, height), 1.0)
    half = side * (0.5 + pad)
    x0 = int(max(0, cx - half))
    y0 = int(max(0, cy - half))
    x1 = int(min(width, cx + half))
    y1 = int(min(height, cy + half))
    if x1 <= x0 or y1 <= y0:
        raise ValueError("invalid face box")
    return x0, y0, x1, y1


class ScrfdDetector:
    """Minimal SCRFD (det_500m) runner — boxes + 5 keypoints."""

    def __init__(self, model_path: Optional[str | Path] = None) -> None:
        import onnxruntime as ort

        path = resolve_onnx_path("det_500m.onnx", str(model_path) if model_path else None)
        self.session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.input_size = (SCRFD_INPUT, SCRFD_INPUT)
        self._feat_stride = [8, 16, 32]
        self._num_anchors = 2

    def detect(
        self, bgr: np.ndarray, threshold: float = 0.5, max_num: int = 5
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Returns:
          bboxes: (n, 5) x1,y1,x2,y2,score
          kpss: (n, 5, 2)
        """
        import cv2

        h0, w0 = bgr.shape[:2]
        im_ratio = float(h0) / float(w0)
        model_ratio = 1.0
        if im_ratio > model_ratio:
            new_height = self.input_size[1]
            new_width = int(new_height / im_ratio)
        else:
            new_width = self.input_size[0]
            new_height = int(new_width * im_ratio)
        det_scale = float(new_height) / float(h0)
        resized = cv2.resize(bgr, (new_width, new_height))
        det_img = np.zeros((self.input_size[1], self.input_size[0], 3), dtype=np.uint8)
        det_img[:new_height, :new_width, :] = resized
        blob = cv2.dnn.blobFromImage(
            det_img, 1.0 / 128.0, self.input_size, (127.5, 127.5, 127.5), swapRB=True
        )
        net_outs = self.session.run(None, {self.input_name: blob})

        scores_list: List[np.ndarray] = []
        bboxes_list: List[np.ndarray] = []
        kpss_list: List[np.ndarray] = []
        # det_500m outputs: for each stride → score, bbox, kps (9 outputs)
        fmc = len(self._feat_stride)
        for idx, stride in enumerate(self._feat_stride):
            scores = net_outs[idx]
            bbox_preds = net_outs[idx + fmc]
            kps_preds = net_outs[idx + fmc * 2]
            # det_500m score heads are already probabilities — do NOT apply sigmoid
            # (double-sigmoid pushed every box over threshold and anchored on non-faces).
            scores = scores.reshape(-1)
            bbox_preds = bbox_preds.reshape(-1, 4)
            kps_preds = kps_preds.reshape(-1, 10)
            height = self.input_size[1] // stride
            width = self.input_size[0] // stride
            anchor_centers = np.stack(
                np.mgrid[:height, :width][::-1], axis=-1
            ).astype(np.float32)
            anchor_centers = (anchor_centers * stride).reshape((-1, 2))
            if self._num_anchors > 1:
                anchor_centers = np.stack(
                    [anchor_centers] * self._num_anchors, axis=1
                ).reshape((-1, 2))
            pos = scores >= threshold
            if not np.any(pos):
                continue
            scores_list.append(scores[pos])
            bboxes = np.hstack(
                [
                    anchor_centers[pos] - bbox_preds[pos, :2] * stride,
                    anchor_centers[pos] + bbox_preds[pos, 2:] * stride,
                ]
            )
            bboxes_list.append(bboxes)
            kpss = kps_preds[pos]
            flat = []
            for i in range(kpss.shape[0]):
                pts = kpss[i].reshape(5, 2) * stride + anchor_centers[pos][i]
                flat.append(pts)
            kpss_list.append(np.asarray(flat, dtype=np.float32))

        if not scores_list:
            return np.zeros((0, 5), dtype=np.float32), np.zeros((0, 5, 2), dtype=np.float32)

        scores_cat = np.concatenate(scores_list, axis=0)
        bboxes_cat = np.concatenate(bboxes_list, axis=0) / det_scale
        kpss_cat = np.concatenate(kpss_list, axis=0) / det_scale
        order = scores_cat.argsort()[::-1]
        scores_cat = scores_cat[order]
        bboxes_cat = bboxes_cat[order]
        kpss_cat = kpss_cat[order]
        # NMS
        keep = self._nms(bboxes_cat, scores_cat, 0.4)
        bboxes_cat = bboxes_cat[keep]
        scores_cat = scores_cat[keep]
        kpss_cat = kpss_cat[keep]
        if max_num > 0 and bboxes_cat.shape[0] > max_num:
            bboxes_cat = bboxes_cat[:max_num]
            scores_cat = scores_cat[:max_num]
            kpss_cat = kpss_cat[:max_num]
        out_boxes = np.hstack([bboxes_cat, scores_cat[:, None]]).astype(np.float32)
        return out_boxes, kpss_cat.astype(np.float32)

    @staticmethod
    def _nms(dets: np.ndarray, scores: np.ndarray, thresh: float) -> List[int]:
        x1, y1, x2, y2 = dets[:, 0], dets[:, 1], dets[:, 2], dets[:, 3]
        areas = (x2 - x1 + 1) * (y2 - y1 + 1)
        order = scores.argsort()[::-1]
        keep: List[int] = []
        while order.size > 0:
            i = int(order[0])
            keep.append(i)
            if order.size == 1:
                break
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])
            w = np.maximum(0.0, xx2 - xx1 + 1)
            h = np.maximum(0.0, yy2 - yy1 + 1)
            inter = w * h
            ovr = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
            inds = np.where(ovr <= thresh)[0]
            order = order[inds + 1]
        return keep

    def best_kps_near(
        self, bgr: np.ndarray, cx: float, cy: float, threshold: float = 0.4
    ) -> Optional[np.ndarray]:
        """Pick detection whose box center is closest to (cx, cy) pixel coords."""
        boxes, kpss = self.detect(bgr, threshold=threshold, max_num=10)
        if boxes.shape[0] == 0:
            return None
        centers = np.stack(
            [(boxes[:, 0] + boxes[:, 2]) * 0.5, (boxes[:, 1] + boxes[:, 3]) * 0.5],
            axis=1,
        )
        d = np.linalg.norm(centers - np.array([cx, cy], dtype=np.float32), axis=1)
        return kpss[int(np.argmin(d))]
