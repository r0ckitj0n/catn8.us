/**
 * Tabul8 face embeddings — MobileFaceNet ONNX + ArcFace 5-point alignment.
 * Landmarks: SCRFD det_500m.onnx via onnxruntime-web (same model/kps as Compil8r).
 * face-api TinyFaceDetector+landmarks68 is fallback only if SCRFD finds no face.
 * Must match scripts/tabul8/face_align.py ArcFace template + MODEL_VERSION.
 */

declare global {
  interface Window {
    faceapi?: any;
    ort?: any;
  }
}

const DETECT_MODEL_URL = '/assets/tabul8/models';
const FACE_API_SCRIPT = '/assets/tabul8/face-api.min.js';
const ORT_SCRIPT = '/assets/tabul8/onnx/ort.min.js';
const MOBILEFACENET_URL = '/assets/tabul8/onnx/mobilefacenet.onnx';
const SCRFD_URL = '/assets/tabul8/onnx/det_500m.onnx';

export const TABUL8_MODEL_NAME = 'mobilefacenet';
/** Bump with Python/PHP when alignment pipeline changes — old embeddings ignored. */
export const TABUL8_MODEL_VERSION = '2.0-arcface';
export const TABUL8_PIPELINE_ID = 'arcface5-scrfd-mbf';
export const TABUL8_INPUT_SIZE = 112;
const SCRFD_INPUT = 640;

/**
 * Cosine similarity thresholds (L2-normalized, ArcFace-aligned, SCRFD kps both sides).
 * Photos-data (Compil8r): same-person median 0.44 (49% ≥0.45, 64% ≥0.35); diff max 0.20.
 * GREET 0.40 sits between diff-max and same-median with SCRFD identity across pipelines.
 * Must match Tabul8IdentityModel constants.
 */
export const TABUL8_GREET_THRESHOLD = 0.40;
export const TABUL8_MATCH_THRESHOLD = 0.35;

/** InsightFace ArcFace 112×112 reference (left eye, right eye, nose, left mouth, right mouth). */
const ARCFACE_DST: Array<[number, number]> = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

let faceApiPromise: Promise<any> | null = null;
let ortBundlePromise: Promise<{ ort: any; mbf: any; scrfd: any }> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function loadTabul8FaceApi(): Promise<any> {
  if (faceApiPromise) return faceApiPromise;
  faceApiPromise = (async () => {
    await loadScript(FACE_API_SCRIPT);
    const faceapi = window.faceapi;
    if (!faceapi) throw new Error('face-api not available');
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(DETECT_MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(DETECT_MODEL_URL),
    ]);
    return faceapi;
  })();
  return faceApiPromise;
}

async function loadOrtBundle(): Promise<{ ort: any; mbf: any; scrfd: any }> {
  if (ortBundlePromise) return ortBundlePromise;
  ortBundlePromise = (async () => {
    await loadScript(ORT_SCRIPT);
    const ort = window.ort;
    if (!ort) throw new Error('onnxruntime-web not available');
    ort.env.wasm.wasmPaths = '/assets/tabul8/onnx/';
    const [mbf, scrfd] = await Promise.all([
      ort.InferenceSession.create(MOBILEFACENET_URL, { executionProviders: ['wasm'] }),
      ort.InferenceSession.create(SCRFD_URL, { executionProviders: ['wasm'] }),
    ]);
    return { ort, mbf, scrfd };
  })();
  return ortBundlePromise;
}

function l2Normalize(vec: Float32Array | number[]): number[] {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1;
  const out: number[] = new Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

type Pt = [number, number];

/** landmarks68 → ArcFace 5 points (fallback only). */
function landmarks68To5(positions: Array<{ x: number; y: number }>): Pt[] {
  const avg = (idxs: number[]): Pt => {
    let x = 0;
    let y = 0;
    for (const i of idxs) {
      x += positions[i].x;
      y += positions[i].y;
    }
    return [x / idxs.length, y / idxs.length];
  };
  return [
    avg([36, 37, 38, 39, 40, 41]),
    avg([42, 43, 44, 45, 46, 47]),
    [positions[30].x, positions[30].y],
    [positions[48].x, positions[48].y],
    [positions[54].x, positions[54].y],
  ];
}

/** Similarity transform mapping src → ArcFace dst (matches Python estimate_norm). */
export function estimateNorm(src: Pt[], dst: Pt[] = ARCFACE_DST): number[][] {
  const n = Math.min(src.length, dst.length);
  if (n < 2) return [[1, 0, 0], [0, 1, 0]];
  let srcCx = 0;
  let srcCy = 0;
  let dstCx = 0;
  let dstCy = 0;
  for (let i = 0; i < n; i++) {
    srcCx += src[i][0];
    srcCy += src[i][1];
    dstCx += dst[i][0];
    dstCy += dst[i][1];
  }
  srcCx /= n;
  srcCy /= n;
  dstCx /= n;
  dstCy /= n;
  const angSrc = Math.atan2(src[1][1] - src[0][1], src[1][0] - src[0][0]);
  const angDst = Math.atan2(dst[1][1] - dst[0][1], dst[1][0] - dst[0][0]);
  const ang = angDst - angSrc;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const srcEye = Math.hypot(src[1][0] - src[0][0], src[1][1] - src[0][1]) || 1;
  const dstEye = Math.hypot(dst[1][0] - dst[0][0], dst[1][1] - dst[0][1]);
  const s = dstEye / srcEye;
  const a = s * ca;
  const b = -s * sa;
  const c = s * sa;
  const d = s * ca;
  const tx = dstCx - (a * srcCx + b * srcCy);
  const ty = dstCy - (c * srcCx + d * srcCy);
  return [
    [a, b, tx],
    [c, d, ty],
  ];
}

function invertAffine2x3(m: number[][]): number[][] {
  const [[a, b, tx], [c, d, ty]] = m;
  const det = a * d - b * c || 1e-12;
  const ia = d / det;
  const ib = -b / det;
  const ic = -c / det;
  const id = a / det;
  return [
    [ia, ib, -(ia * tx + ib * ty)],
    [ic, id, -(ic * tx + id * ty)],
  ];
}

function sourceToImageData(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): { data: ImageData; w: number; h: number } {
  const sw = 'videoWidth' in source && source.videoWidth
    ? source.videoWidth
    : (source as HTMLCanvasElement | HTMLImageElement).width || 640;
  const sh = 'videoHeight' in source && source.videoHeight
    ? source.videoHeight
    : (source as HTMLCanvasElement | HTMLImageElement).height || 480;
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = sw;
  srcCanvas.height = sh;
  const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!sctx) throw new Error('Canvas unavailable');
  sctx.drawImage(source as CanvasImageSource, 0, 0, sw, sh);
  return { data: sctx.getImageData(0, 0, sw, sh), w: sw, h: sh };
}

function warpAffineTo112FromImageData(srcData: ImageData, sw: number, sh: number, affine: number[][]): ImageData {
  const size = TABUL8_INPUT_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  const inv = invertAffine2x3(affine);
  const out = ctx.createImageData(size, size);
  const [[ia, ib, itx], [ic, id, ity]] = inv;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = ia * x + ib * y + itx;
      const sy = ic * x + id * y + ity;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const fx = sx - x0;
      const fy = sy - y0;
      const o = (y * size + x) * 4;
      if (x0 < 0 || y0 < 0 || x1 >= sw || y1 >= sh) {
        out.data[o] = 0;
        out.data[o + 1] = 0;
        out.data[o + 2] = 0;
        out.data[o + 3] = 255;
        continue;
      }
      const i00 = (y0 * sw + x0) * 4;
      const i01 = (y0 * sw + x1) * 4;
      const i10 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      for (let c = 0; c < 3; c++) {
        out.data[o + c] =
          srcData.data[i00 + c] * (1 - fx) * (1 - fy) +
          srcData.data[i01 + c] * fx * (1 - fy) +
          srcData.data[i10 + c] * (1 - fx) * fy +
          srcData.data[i11 + c] * fx * fy;
      }
      out.data[o + 3] = 255;
    }
  }
  return out;
}

function imageDataToNchwTensor(imageData: ImageData, ort: any): any {
  const size = TABUL8_INPUT_SIZE * TABUL8_INPUT_SIZE;
  const { data } = imageData;
  const float = new Float32Array(3 * size);
  for (let i = 0; i < size; i++) {
    float[i] = (data[i * 4] - 127.5) / 128;
    float[size + i] = (data[i * 4 + 1] - 127.5) / 128;
    float[2 * size + i] = (data[i * 4 + 2] - 127.5) / 128;
  }
  return new ort.Tensor('float32', float, [1, 3, TABUL8_INPUT_SIZE, TABUL8_INPUT_SIZE]);
}

function nms(boxes: number[][], scores: number[], thresh: number): number[] {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const keep: number[] = [];
  const areas = boxes.map((b) => (b[2] - b[0] + 1) * (b[3] - b[1] + 1));
  while (order.length > 0) {
    const i = order[0];
    keep.push(i);
    const rest: number[] = [];
    for (let k = 1; k < order.length; k++) {
      const j = order[k];
      const xx1 = Math.max(boxes[i][0], boxes[j][0]);
      const yy1 = Math.max(boxes[i][1], boxes[j][1]);
      const xx2 = Math.min(boxes[i][2], boxes[j][2]);
      const yy2 = Math.min(boxes[i][3], boxes[j][3]);
      const w = Math.max(0, xx2 - xx1 + 1);
      const h = Math.max(0, yy2 - yy1 + 1);
      const inter = w * h;
      const ovr = inter / (areas[i] + areas[j] - inter + 1e-6);
      if (ovr <= thresh) rest.push(j);
    }
    order.length = 0;
    order.push(...rest);
  }
  return keep;
}

/**
 * SCRFD det_500m — same postprocess as scripts/tabul8/face_align.py
 * (scores are already probabilities; no sigmoid).
 */
async function scrfdDetect(
  ort: any,
  session: any,
  rgba: ImageData,
  w0: number,
  h0: number,
  threshold = 0.5,
): Promise<{ boxes: number[][]; kpss: Pt[][]; scores: number[] }> {
  const imRatio = h0 / w0;
  let newHeight: number;
  let newWidth: number;
  if (imRatio > 1) {
    newHeight = SCRFD_INPUT;
    newWidth = Math.floor(newHeight / imRatio);
  } else {
    newWidth = SCRFD_INPUT;
    newHeight = Math.floor(newWidth * imRatio);
  }
  const detScale = newHeight / h0;
  const canvas = document.createElement('canvas');
  canvas.width = SCRFD_INPUT;
  canvas.height = SCRFD_INPUT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SCRFD_INPUT, SCRFD_INPUT);
  // Draw resized source into letterbox
  const tmp = document.createElement('canvas');
  tmp.width = w0;
  tmp.height = h0;
  const tctx = tmp.getContext('2d');
  if (!tctx) throw new Error('Canvas unavailable');
  tctx.putImageData(rgba, 0, 0);
  ctx.drawImage(tmp, 0, 0, w0, h0, 0, 0, newWidth, newHeight);
  const letter = ctx.getImageData(0, 0, SCRFD_INPUT, SCRFD_INPUT);
  const size = SCRFD_INPUT * SCRFD_INPUT;
  const float = new Float32Array(3 * size);
  for (let i = 0; i < size; i++) {
    float[i] = (letter.data[i * 4] - 127.5) / 128;
    float[size + i] = (letter.data[i * 4 + 1] - 127.5) / 128;
    float[2 * size + i] = (letter.data[i * 4 + 2] - 127.5) / 128;
  }
  const inputName = session.inputNames[0];
  const feeds: Record<string, unknown> = {};
  feeds[inputName] = new ort.Tensor('float32', float, [1, 3, SCRFD_INPUT, SCRFD_INPUT]);
  const results = await session.run(feeds);
  const outs = session.outputNames.map((n: string) => results[n].data as Float32Array);

  const strides = [8, 16, 32];
  const fmc = 3;
  const numAnchors = 2;
  const scoresList: number[] = [];
  const boxesList: number[][] = [];
  const kpsList: Pt[][] = [];

  for (let idx = 0; idx < strides.length; idx++) {
    const stride = strides[idx];
    const scores = outs[idx];
    const bboxPreds = outs[idx + fmc];
    const kpsPreds = outs[idx + fmc * 2];
    const height = SCRFD_INPUT / stride;
    const width = SCRFD_INPUT / stride;
    const anchorCenters: Array<[number, number]> = [];
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const cx = dx * stride;
        const cy = dy * stride;
        for (let a = 0; a < numAnchors; a++) {
          anchorCenters.push([cx, cy]);
        }
      }
    }
    const n = scores.length;
    for (let i = 0; i < n; i++) {
      const sc = scores[i];
      if (sc < threshold) continue;
      const ax = anchorCenters[i][0];
      const ay = anchorCenters[i][1];
      const l = bboxPreds[i * 4] * stride;
      const t = bboxPreds[i * 4 + 1] * stride;
      const r = bboxPreds[i * 4 + 2] * stride;
      const b = bboxPreds[i * 4 + 3] * stride;
      scoresList.push(sc);
      boxesList.push([ax - l, ay - t, ax + r, ay + b]);
      const pts: Pt[] = [];
      for (let k = 0; k < 5; k++) {
        pts.push([
          kpsPreds[i * 10 + k * 2] * stride + ax,
          kpsPreds[i * 10 + k * 2 + 1] * stride + ay,
        ]);
      }
      kpsList.push(pts);
    }
  }

  if (scoresList.length === 0) {
    return { boxes: [], kpss: [], scores: [] };
  }
  // Scale back to original image
  const boxes = boxesList.map((b) => b.map((v) => v / detScale));
  const kpss = kpsList.map((pts) => pts.map(([x, y]) => [x / detScale, y / detScale] as Pt));
  const keep = nms(boxes, scoresList, 0.4);
  return {
    boxes: keep.map((i) => boxes[i]),
    kpss: keep.map((i) => kpss[i]),
    scores: keep.map((i) => scoresList[i]),
  };
}

async function faceAlignedTensor(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<{ tensor: any; score: number }> {
  const { ort, scrfd } = await loadOrtBundle();
  const { data, w, h } = sourceToImageData(source);

  let kps5: Pt[] | null = null;
  let score = 0;
  try {
    const det = await scrfdDetect(ort, scrfd, data, w, h, 0.5);
    if (det.kpss.length > 0) {
      // Largest box
      let best = 0;
      let bestArea = -1;
      for (let i = 0; i < det.boxes.length; i++) {
        const b = det.boxes[i];
        const area = (b[2] - b[0]) * (b[3] - b[1]);
        if (area > bestArea) {
          bestArea = area;
          best = i;
        }
      }
      kps5 = det.kpss[best];
      score = det.scores[best];
    }
  } catch {
    // fall through to face-api
  }

  if (!kps5) {
    const faceapi = await loadTabul8FaceApi();
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
    const detection = await faceapi.detectSingleFace(source, options).withFaceLandmarks(true);
    if (!detection) {
      throw new Error('No face detected — center your face and try again');
    }
    kps5 = landmarks68To5(detection.landmarks.positions);
    score = detection.detection?.score || detection.score || 0;
  }

  const affine = estimateNorm(kps5, ARCFACE_DST);
  const aligned = warpAffineTo112FromImageData(data, w, h, affine);
  const tensor = imageDataToNchwTensor(aligned, ort);
  return { tensor, score };
}

/** MobileFaceNet embedding as L2-normalized number[]. */
export async function computeFaceEmbedding(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<number[]> {
  const { mbf } = await loadOrtBundle();
  const { tensor } = await faceAlignedTensor(source);
  const inputName = mbf.inputNames[0];
  const feeds: Record<string, unknown> = {};
  feeds[inputName] = tensor;
  const results = await mbf.run(feeds);
  const outName = mbf.outputNames[0];
  const out = results[outName];
  const data = out?.data as Float32Array | number[] | undefined;
  if (!data || (data as ArrayLike<number>).length < 64) {
    throw new Error('Embedding model returned empty output');
  }
  return l2Normalize(data as Float32Array);
}

export type PackIdentity = {
  identity_id: number;
  display_name: string;
  guest_id?: number | null;
  admin_named?: number;
  greetable?: number;
  embeddings: number[][];
};

export type LocalMatch = {
  matched: boolean;
  identity_id: number | null;
  display_name: string | null;
  similarity: number;
  threshold: number;
};

export function matchLocalEmbedding(
  probe: number[],
  identities: PackIdentity[],
  threshold: number = TABUL8_MATCH_THRESHOLD,
): LocalMatch {
  let bestSim = -1;
  let best: PackIdentity | null = null;
  const normalized = l2Normalize(probe);
  for (const ident of identities) {
    for (const emb of ident.embeddings || []) {
      const sim = cosineSimilarity(normalized, emb);
      if (sim > bestSim) {
        bestSim = sim;
        best = ident;
      }
    }
  }
  const matched = best !== null && bestSim >= threshold;
  return {
    matched,
    identity_id: matched && best ? best.identity_id : null,
    display_name: matched && best ? best.display_name : null,
    similarity: Math.round(bestSim * 10000) / 10000,
    threshold,
  };
}

/** Continuous detect + match for kiosk greeting. Returns null if no face. */
export async function detectAndMatchGreeting(
  video: HTMLVideoElement,
  identities: PackIdentity[],
  greetThreshold: number = TABUL8_GREET_THRESHOLD,
): Promise<LocalMatch | null> {
  try {
    const emb = await computeFaceEmbedding(video);
    return matchLocalEmbedding(emb, identities, greetThreshold);
  } catch {
    return null;
  }
}

export function getOrCreateDeviceToken(): string {
  const key = 'tabul8_device_token';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && existing.length >= 16) return existing;
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    window.localStorage.setItem(key, token);
    const host = (typeof window !== 'undefined' ? window.location.hostname : '').toLowerCase();
    const domainPart = host === 'catn8.us' || host.endsWith('.catn8.us') ? '; domain=.catn8.us' : '';
    document.cookie = `${key}=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${domainPart}`;
    return token;
  } catch {
    return `anon_${Date.now()}`;
  }
}
