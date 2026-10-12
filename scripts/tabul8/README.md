# Tabul8 face identity preload (Compil8r)

Preloads **named people** from Jon’s Apple Photos library into catn8’s persistent Tabul8 identity store. Uploads **name + embeddings only** (never photos).

## Model + alignment pipeline (must match the browser)

| Item | Value |
|------|--------|
| Recognition | InsightFace `buffalo_s` **`w600k_mbf.onnx`** (MobileFaceNet) |
| Detector / 5-pt (Python) | InsightFace **`det_500m.onnx`** (SCRFD) |
| Landmarks (browser) | face-api **landmarks68Tiny** → 5 points |
| Alignment | ArcFace similarity transform → **112×112** |
| File on catn8 / Compil8r | `assets/tabul8/onnx/mobilefacenet.onnx` + `det_500m.onnx` |
| Input | Aligned 112×112 RGB, NCHW, `(pixel - 127.5) / 128` |
| Output | **512-d**, L2-normalized |
| **`model_version` / pipeline** | **`2.0-arcface`** (old `1.0` unaligned embeddings ignored & replaced on rerun) |

**Thresholds** (cosine similarity, L2-normalized, after ArcFace alignment):

| Use | Constant | Value |
|-----|----------|-------|
| Kiosk greeting “Hi Name!” | `GREET_THRESHOLD` | **0.40** |
| Vote / check-in identity match | `MATCH_THRESHOLD` | **0.35** |

**Measured on Photos (Compil8r, SCRFD without double-sigmoid):** same-person median **0.44** (49% of pairs ≥0.45, 64% ≥0.35); different-person max **0.20**. **Greet 0.40** sits above diff-max with headroom under same-median. Browser kiosk now runs the same **SCRFD det_500m** ONNX (onnxruntime-web) so keypoints match Python — no cross-pipeline penalty. Public-sample smoke (`measure_alignment.py`) still shows a large gap (obama same ≈0.72, diff ≲0.07).

### Greeting rules

Only greet by name when the identity is:

- linked to a Celebr8 **guest**, or
- **explicitly named** in Tabul8 admin (`Save` sets `admin_named`)

Unlinked Photos people (`Dad`, `Mom`, pets, places, …) show in admin as **From Photos (unlinked)** — link / rename / purge; they are **not** greeted. Fuzzy guest matches (e.g. **Ian Pilsbury / guest 42**) go to **pending confirm**, not auto-link.

Fetch / refresh model assets on the catn8 repo machine:

```bash
bash scripts/tabul8/fetch_model.sh
```

## Install on Compil8r (macOS Apple Silicon)

Recommended layout (flat install Jon already uses):

```text
/Users/jongraves/catn8-tabul8/
  photos_face_preload.py
  mobilefacenet_embed.py
  face_align.py
  measure_alignment.py
  requirements.txt
  assets/tabul8/onnx/mobilefacenet.onnx
  assets/tabul8/onnx/det_500m.onnx
  .venv/
```

`--model` resolves **relative to the script directory first** (`./assets/tabul8/onnx/…`), then parent install root, then the full catn8.us repo path.

```bash
brew install python@3.14 libheif
cd /Users/jongraves/catn8-tabul8

python3.14 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Ensure ONNX models exist (copy from repo assets/tabul8/onnx or fetch on a machine with the repo):
#   bash /path/to/catn8.us/scripts/tabul8/fetch_model.sh
#   cp -R /path/to/catn8.us/assets/tabul8 /Users/jongraves/catn8-tabul8/assets/

mkdir -p ~/.config/catn8
chmod 600 ~/.config/catn8/celebr8_agent.token
```

## Files to copy to Compil8r after this update

Copy these from the catn8.us repo into `/Users/jongraves/catn8-tabul8/` (overwrite):

| Repo path | Install as |
|-----------|------------|
| `scripts/tabul8/photos_face_preload.py` | `photos_face_preload.py` |
| `scripts/tabul8/mobilefacenet_embed.py` | `mobilefacenet_embed.py` |
| `scripts/tabul8/face_align.py` | `face_align.py` **(new)** |
| `scripts/tabul8/measure_alignment.py` | `measure_alignment.py` **(new)** |
| `scripts/tabul8/requirements.txt` | `requirements.txt` |
| `assets/tabul8/onnx/det_500m.onnx` | `assets/tabul8/onnx/det_500m.onnx` (if missing) |
| `assets/tabul8/onnx/mobilefacenet.onnx` | already present |

Then: `pip install -r requirements.txt` (adds **pillow-heif**).

## Exact rerun command

```bash
cd /Users/jongraves/catn8-tabul8
source .venv/bin/activate
pip install -r requirements.txt

# Optional smoke measure (downloads a few public sample faces):
python3.14 measure_alignment.py

# Dry-run first:
python3.14 photos_face_preload.py \
  --party-id 1 \
  --library "/Volumes/Jons_Drive/Photos Library.photoslibrary" \
  --token-file ~/.config/catn8/celebr8_agent.token \
  --api-base https://catn8.us \
  --faces-per-person 5 \
  --dry-run

# Live upload (idempotent — replaces old 1.0 embeddings with 2.0-arcface):
python3.14 photos_face_preload.py \
  --party-id 1 \
  --library "/Volumes/Jons_Drive/Photos Library.photoslibrary" \
  --token-file ~/.config/catn8/celebr8_agent.token \
  --api-base https://catn8.us \
  --faces-per-person 5
```

Model defaults resolve to `/Users/jongraves/catn8-tabul8/assets/tabul8/onnx/mobilefacenet.onnx` (no `--model` needed when assets sit next to the scripts).

## Photos fixes in this pipeline

1. **Y flip** — `ZDETECTEDFACE` center Y is from the **bottom**; `y_px = (1 - centerY) * height`. EXIF orientation via Pillow `exif_transpose`.
2. **HEIC** — `pillow-heif` + `register_heif_opener()`.
3. **Skip** faces with no box, hidden/trashed faces, videos, RAW; scan up to **4×** candidates to still collect N per person.
4. **No whole-library search** — only the asset’s `originals/{dir}/` and `resources/derivatives/{dir}/` folders (the old `rglob` hung).
5. **`--model` default** — script-dir `assets/…` first.

## Agent API used

`POST /api/celebr8_agent.php?action=tabul8_upsert_identity_embeddings`  
Bearer token. Body: `display_name`, `photos_person_uuid`, `party_id`, optional `guest_id`, `pending_guest_id`, `embeddings[]` with `vector`, `source_face_uuid`, `quality`, `model_name`, `model_version` (`2.0-arcface`).

## Caveats

- Accuracy still drops with kids, side profiles, heavy costumes, dark rooms, and motion blur.
- Photos face boxes vary by macOS Photos schema version — the script probes common column names.
- Re-runs are idempotent via `source_face_uuid`; **pipeline version change replaces** old vectors for that face uuid.
