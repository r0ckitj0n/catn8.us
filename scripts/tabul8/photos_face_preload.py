#!/usr/bin/env python3
"""
Compil8r job: preload named faces from Apple Photos into catn8 Tabul8 identities.

- Copies Photos.sqlite (+ -wal/-shm) to a temp dir and reads the COPY read-only.
- NEVER writes to the Photos library.
- Uploads ONLY display_name + embeddings (no photos) via bearer agent API:
    action=tabul8_upsert_identity_embeddings
- Matches names to Celebr8 guests (exact then fuzzy); fuzzy → pending confirm, never auto-link.
- Skips JT Whetstone entirely.
- Idempotent: dedupes by photos person uuid + face uuid; new pipeline version replaces old vectors.

Example (Compil8r install at /Users/jongraves/catn8-tabul8):
  cd /Users/jongraves/catn8-tabul8
  source .venv/bin/activate
  python3.14 photos_face_preload.py \\
    --party-id 1 \\
    --library "/Volumes/Jons_Drive/Photos Library.photoslibrary" \\
    --token-file ~/.config/catn8/celebr8_agent.token \\
    --api-base https://catn8.us
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import requests

from mobilefacenet_embed import (
    EMBEDDING_DIMS,
    MODEL_NAME,
    MODEL_VERSION,
    PIPELINE_ID,
    MobileFaceNet,
)

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:
    pass

BLOCKED_NAME_NEEDLES = (
    "jt whetstone",
    "j t whetstone",
    "jtwhetstone",
    "jaytee whetstone",
    "jay tee whetstone",
)

# Guest that needs explicit admin confirmation for near-matches.
CONFIRM_GUEST_IDS = {42}  # Ian Pilsbury
CONFIRM_GUEST_NAME_NEEDLES = ("ian pilsbury", "ian pilbury", "ian pillsbury")

RAW_EXTS = {
    ".raw",
    ".dng",
    ".cr2",
    ".cr3",
    ".nef",
    ".arw",
    ".orf",
    ".rw2",
    ".raf",
    ".pef",
    ".srw",
}
VIDEO_EXTS = {
    ".mov",
    ".mp4",
    ".m4v",
    ".avi",
    ".mkv",
    ".mpg",
    ".mpeg",
    ".3gp",
}


def is_blocked_name(name: str) -> bool:
    n = " ".join((name or "").lower().replace(".", " ").replace("-", " ").split())
    compact = n.replace(" ", "")
    for bad in BLOCKED_NAME_NEEDLES:
        if n == bad or compact == bad.replace(" ", ""):
            return True
    if "whetstone" in n and ("jt" in n or "jaytee" in n or "jay tee" in n):
        return True
    return False


def normalize_name(name: str) -> str:
    import re

    n = (name or "").lower().strip()
    n = re.sub(r"\s+", " ", n)
    n = re.sub(r"[^a-z0-9 ]", "", n)
    return n.strip()


def copy_photos_db(library: Path, dest_dir: Path) -> Path:
    db = library / "database" / "Photos.sqlite"
    if not db.is_file():
        alt = library / "Database" / "Photos.sqlite"
        db = alt if alt.is_file() else db
    if not db.is_file():
        raise FileNotFoundError(f"Photos.sqlite not found under {library}")
    dest = dest_dir / "Photos.sqlite"
    shutil.copy2(db, dest)
    for suffix in ("-wal", "-shm"):
        side = Path(str(db) + suffix)
        if side.is_file():
            shutil.copy2(side, Path(str(dest) + suffix))
    return dest


def table_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return [r[1] for r in rows]


def first_existing(cols: List[str], candidates: List[str]) -> Optional[str]:
    lower = {c.lower(): c for c in cols}
    for cand in candidates:
        if cand.lower() in lower:
            return lower[cand.lower()]
    return None


def load_named_people(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    cols = table_columns(conn, "ZPERSON")
    pk = first_existing(cols, ["Z_PK"]) or "Z_PK"
    name_col = first_existing(cols, ["ZFULLNAME", "ZDISPLAYNAME", "ZNAME", "ZTITLE"])
    uuid_col = first_existing(cols, ["ZPERSONUUID", "ZUUID", "Z_UUID"])
    if not name_col:
        raise RuntimeError("ZPERSON has no name column")
    sql = f"SELECT {pk} AS pk, {name_col} AS name"
    if uuid_col:
        sql += f", {uuid_col} AS person_uuid"
    else:
        sql += ", NULL AS person_uuid"
    sql += " FROM ZPERSON WHERE TRIM(COALESCE(" + name_col + ", '')) <> ''"
    people = []
    for row in conn.execute(sql):
        name = (row["name"] or "").strip()
        if not name or is_blocked_name(name):
            continue
        puuid = (row["person_uuid"] or "").strip() if row["person_uuid"] else ""
        if not puuid:
            puuid = f"pk:{row['pk']}"
        people.append({"pk": int(row["pk"]), "name": name, "person_uuid": puuid})
    return people


def load_faces_for_person(
    conn: sqlite3.Connection, person_pk: int, limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Load face candidates. Fetches up to 4× limit so we can still fill N after
    skipping hidden/trashed/no-box/video/RAW.
    """
    cols = table_columns(conn, "ZDETECTEDFACE")
    pk = first_existing(cols, ["Z_PK"]) or "Z_PK"
    person_fk = first_existing(
        cols,
        ["ZPERSONFORFACE", "ZPERSON", "ZPERSONBEINGKEYFACEDDETECTION", "ZPERSONA"],
    )
    if not person_fk:
        return []
    cx = first_existing(cols, ["ZCENTERX", "ZCENTER_X"])
    cy = first_existing(cols, ["ZCENTERY", "ZCENTER_Y"])
    size = first_existing(cols, ["ZSIZE", "ZFACESIZE"])
    quality = first_existing(cols, ["ZQUALITYMEASURE", "ZBLURSCORE", "ZQUALITY"])
    asset_fk = first_existing(cols, ["ZASSETFORFACE", "ZASSET", "ZASSETKEY"])
    face_uuid = first_existing(cols, ["ZUUID", "ZFACEUUID"])
    hidden = first_existing(
        cols, ["ZHIDDEN", "ZISHIDDEN", "ZHIDDENFACE", "ZISHIDDENINPHOTO"]
    )
    trashed = first_existing(
        cols,
        ["ZISINTRASH", "ZTRASHEDSTATE", "ZTRASHED", "ZISINRECYCLEBIN", "ZISHIDDEN"],
    )

    # Require real box columns — skip faces with no box.
    if not cx or not cy or not size:
        return []

    select = [
        f"{pk} AS face_pk",
        f"{person_fk} AS person_pk",
        f"{cx} AS cx",
        f"{cy} AS cy",
        f"{size} AS sz",
    ]
    select.append(f"{quality} AS quality" if quality else "NULL AS quality")
    select.append(f"{asset_fk} AS asset_pk" if asset_fk else "NULL AS asset_pk")
    select.append(f"{face_uuid} AS face_uuid" if face_uuid else "NULL AS face_uuid")
    select.append(f"{hidden} AS hidden" if hidden else "0 AS hidden")
    select.append(f"{trashed} AS trashed" if trashed else "0 AS trashed")

    fetch_n = max(limit * 4, limit)
    order = (
        "CASE WHEN quality IS NULL THEN 1 ELSE 0 END, quality DESC, face_pk DESC"
    )
    sql = (
        f"SELECT {', '.join(select)} FROM ZDETECTEDFACE "
        f"WHERE {person_fk} = ? ORDER BY {order} LIMIT ?"
    )
    rows = []
    for row in conn.execute(sql, (person_pk, fetch_n)):
        if int(row["hidden"] or 0) != 0:
            continue
        if int(row["trashed"] or 0) != 0:
            continue
        try:
            fcx = float(row["cx"])
            fcy = float(row["cy"])
            fsz = float(row["sz"])
        except (TypeError, ValueError):
            continue
        # Skip faces with no usable box.
        if fsz <= 0.01 or fcx < 0 or fcy < 0 or fcx > 1.5 or fcy > 1.5:
            continue
        fu = (row["face_uuid"] or "").strip() if row["face_uuid"] else ""
        if not fu:
            fu = f"face:{person_pk}:{row['face_pk']}"
        rows.append(
            {
                "face_pk": int(row["face_pk"]),
                "face_uuid": fu,
                "cx": fcx,
                "cy": fcy,
                "sz": fsz,
                "quality": float(row["quality"]) if row["quality"] is not None else None,
                "asset_pk": int(row["asset_pk"]) if row["asset_pk"] is not None else None,
            }
        )
        if len(rows) >= limit:
            break
    return rows


def asset_is_video_or_raw(conn: sqlite3.Connection, asset_pk: int) -> bool:
    cols = table_columns(conn, "ZASSET")
    pk = first_existing(cols, ["Z_PK"]) or "Z_PK"
    row = conn.execute(f"SELECT * FROM ZASSET WHERE {pk} = ?", (asset_pk,)).fetchone()
    if not row:
        return True
    trash_col = first_existing(cols, ["ZISINTRASH", "ZTRASHEDSTATE", "ZTRASHED"])
    if trash_col is not None and row[trash_col] is not None:
        try:
            if int(row[trash_col]) != 0:
                return True
        except (TypeError, ValueError):
            pass
    name_col = first_existing(cols, ["ZFILENAME", "ZNAME"])
    if name_col and row[name_col]:
        ext = Path(str(row[name_col])).suffix.lower()
        if ext in VIDEO_EXTS or ext in RAW_EXTS:
            return True
    # ZKIND: 0=photo, 1=video on many Photos schemas
    kind_col = first_existing(cols, ["ZKIND", "ZTYPE"])
    if kind_col is not None and row[kind_col] is not None:
        try:
            if int(row[kind_col]) == 1:
                return True
        except (TypeError, ValueError):
            pass
    uti_col = first_existing(cols, ["ZUNIFORMTYPEIDENTIFIER", "ZUTI"])
    if uti_col and row[uti_col]:
        uti = str(row[uti_col]).lower()
        if "movie" in uti or "video" in uti or "raw-image" in uti or uti.endswith(".raw-image"):
            return True
    return False


def resolve_asset_path(
    conn: sqlite3.Connection, library: Path, asset_pk: Optional[int]
) -> Optional[Path]:
    """
    Resolve ONLY within the asset's derivative/original folder — never walk the
    whole library (that hung on Compil8r).
    """
    if not asset_pk:
        return None
    cols = table_columns(conn, "ZASSET")
    pk = first_existing(cols, ["Z_PK"]) or "Z_PK"
    dir_col = first_existing(cols, ["ZDIRECTORY", "ZFOLDER"])
    name_col = first_existing(cols, ["ZFILENAME", "ZNAME"])
    row = conn.execute(f"SELECT * FROM ZASSET WHERE {pk} = ?", (asset_pk,)).fetchone()
    if not row:
        return None
    if asset_is_video_or_raw(conn, asset_pk):
        return None

    directory = str(row[dir_col]) if dir_col and row[dir_col] else ""
    filename = str(row[name_col]) if name_col and row[name_col] else ""
    if not directory or not filename:
        return None

    originals = library / "originals" / directory / filename
    if originals.is_file():
        return originals

    # Same folder only — no recursive library search.
    orig_dir = library / "originals" / directory
    if orig_dir.is_dir():
        stem = Path(filename).stem
        for p in orig_dir.iterdir():
            if not p.is_file():
                continue
            if p.suffix.lower() in VIDEO_EXTS or p.suffix.lower() in RAW_EXTS:
                continue
            if p.name == filename or p.stem == stem:
                return p

    deriv_dir = library / "resources" / "derivatives" / directory
    if deriv_dir.is_dir():
        stem = Path(filename).stem
        for p in deriv_dir.iterdir():
            if not p.is_file():
                continue
            if p.suffix.lower() in VIDEO_EXTS or p.suffix.lower() in RAW_EXTS:
                continue
            if stem and stem in p.name:
                return p
    return None


def load_image_bgr(path: Path):
    """Load image as BGR; apply EXIF orientation; HEIC via pillow-heif when registered."""
    import cv2
    import numpy as np
    from PIL import Image, ImageOps

    try:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)
            rgb = np.array(im.convert("RGB"))
            return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        pass
    data = np.fromfile(str(path), dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    return img


def fetch_party_guests(api_base: str, token: str, party_id: int) -> List[Dict[str, Any]]:
    url = f"{api_base.rstrip('/')}/api/celebr8_agent.php"
    r = requests.get(
        url,
        params={"action": "list_guests", "event_id": party_id},
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()
    if not data.get("success"):
        raise RuntimeError(data.get("error") or "list_guests failed")
    return list(data.get("guests") or [])


def needs_confirm_guest(guest: Dict[str, Any]) -> bool:
    gid = int(guest.get("id") or 0)
    if gid in CONFIRM_GUEST_IDS:
        return True
    gn = normalize_name(str(guest.get("name") or ""))
    return any(n in gn or gn in n for n in CONFIRM_GUEST_NAME_NEEDLES)


def name_first_last(norm: str) -> Tuple[str, str]:
    parts = [p for p in (norm or "").split(" ") if p]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[-1]


def fuzzy_name_score(norm_a: str, norm_b: str) -> Optional[float]:
    """
    Require BOTH first and last (when present) to be close.
    Prevents 'Gavin Pillsbury' → 'Ian Pillsbury' (surname-only match).
    """
    from rapidfuzz import fuzz

    af, al = name_first_last(norm_a)
    bf, bl = name_first_last(norm_b)
    if not af or not bf:
        return None
    first = float(fuzz.ratio(af, bf))
    if first < 80.0:
        return None
    if al and bl:
        last = float(fuzz.ratio(al, bl))
        if last < 85.0:
            return None
        return (first + last) / 2.0
    if first >= 92.0:
        return first
    return None


def fetch_linked_guest_ids(api_base: str, token: str) -> Set[int]:
    """Guests that already have a confirmed/exact identity link — do not re-propose."""
    url = f"{api_base.rstrip('/')}/api/celebr8_agent.php"
    try:
        r = requests.get(
            url,
            params={"action": "list_tabul8_identities", "limit": 1000},
            headers={"Authorization": f"Bearer {token}"},
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()
        out: Set[int] = set()
        for ident in data.get("identities") or []:
            gid = ident.get("guest_id")
            if gid is not None and int(gid) > 0:
                out.add(int(gid))
        return out
    except Exception as exc:  # noqa: BLE001
        print(f"WARNING: could not load linked identities: {exc}")
        return set()


def match_guest(
    name: str,
    guests: List[Dict[str, Any]],
    linked_guest_ids: Optional[Set[int]] = None,
) -> Tuple[str, Optional[int], Optional[int], List[Dict[str, Any]]]:
    """
    Returns status, guest_id, pending_guest_id, candidates.
    Exact → guest_id. Fuzzy → pending_guest_id (admin confirms).
    First+last must both be close. Never propose a guest already linked elsewhere.
    """
    taken = linked_guest_ids or set()
    if is_blocked_name(name):
        return "blocked", None, None, []
    norm = normalize_name(name)
    exact = []
    fuzzy = []
    for g in guests:
        gname = (g.get("name") or "").strip()
        if not gname or is_blocked_name(gname):
            continue
        gid = int(g.get("id") or 0)
        gn = normalize_name(gname)
        if gn == norm:
            exact.append(g)
            continue
        if gid in taken:
            continue
        score = fuzzy_name_score(norm, gn)
        if score is not None and score >= 85.0:
            fuzzy.append((score, g))
    if len(exact) == 1:
        return "exact", int(exact[0]["id"]), None, []
    if len(exact) > 1:
        return "ambiguous", None, None, exact
    fuzzy.sort(key=lambda x: -x[0])
    if len(fuzzy) == 1 and fuzzy[0][0] >= 88:
        g = fuzzy[0][1]
        return "fuzzy_pending", None, int(g["id"]), [g]
    if fuzzy:
        ian = [g for _, g in fuzzy if needs_confirm_guest(g)]
        cands = [g for _, g in fuzzy[:5]]
        if len(ian) == 1:
            return "fuzzy_pending", None, int(ian[0]["id"]), cands
        return "ambiguous", None, None, cands
    return "unmatched", None, None, []


def upload_identity(
    api_base: str,
    token: str,
    party_id: int,
    display_name: str,
    person_uuid: str,
    guest_id: Optional[int],
    pending_guest_id: Optional[int],
    embeddings: List[Dict[str, Any]],
    dry_run: bool,
) -> Dict[str, Any]:
    payload = {
        "display_name": display_name,
        "photos_person_uuid": person_uuid,
        "party_id": party_id,
        "guest_id": guest_id,
        "pending_guest_id": pending_guest_id,
        "admin_named": 0,
        "embeddings": embeddings,
    }
    if dry_run:
        return {
            "dry_run": True,
            "payload_summary": {
                "display_name": display_name,
                "photos_person_uuid": person_uuid,
                "guest_id": guest_id,
                "pending_guest_id": pending_guest_id,
                "embedding_count": len(embeddings),
                "model_version": MODEL_VERSION,
            },
        }
    url = f"{api_base.rstrip('/')}/api/celebr8_agent.php?action=tabul8_upsert_identity_embeddings"
    r = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        data=json.dumps(payload),
        timeout=120,
    )
    r.raise_for_status()
    data = r.json()
    if not data.get("success") and not data.get("skipped"):
        raise RuntimeError(data.get("error") or "upsert failed")
    return data


def main() -> int:
    ap = argparse.ArgumentParser(description="Preload Apple Photos faces into Tabul8 identities")
    ap.add_argument(
        "--library",
        default="/Volumes/Jons_Drive/Photos Library.photoslibrary",
        help="Path to Photos Library.photoslibrary",
    )
    ap.add_argument("--party-id", type=int, required=True, help="Celebr8 party id for guest matching")
    ap.add_argument("--api-base", default="https://catn8.us")
    ap.add_argument(
        "--token-file",
        default=os.path.expanduser("~/.config/catn8/celebr8_agent.token"),
        help="Mode-600 file containing the Celebr8 agent bearer token",
    )
    ap.add_argument(
        "--model",
        default="",
        help="Path to mobilefacenet.onnx (default: resolve relative to script dir first)",
    )
    ap.add_argument("--det-model", default="", help="Path to det_500m.onnx (SCRFD)")
    ap.add_argument("--faces-per-person", type=int, default=5)
    ap.add_argument("--limit", type=int, default=0, help="Max people to process (0=all)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    token_path = Path(args.token_file)
    if not args.dry_run:
        if not token_path.is_file():
            print(f"ERROR: token file missing: {token_path}", file=sys.stderr)
            return 2
        mode = token_path.stat().st_mode & 0o777
        if mode & 0o077:
            print(
                f"WARNING: token file mode is {oct(mode)}; prefer chmod 600",
                file=sys.stderr,
            )
        token = token_path.read_text(encoding="utf-8").strip()
        if not token:
            print("ERROR: empty token", file=sys.stderr)
            return 2
    else:
        token = "dry-run"

    library = Path(args.library)
    if not library.is_dir():
        print(f"ERROR: library not found: {library}", file=sys.stderr)
        return 2

    print("Loading MobileFaceNet + SCRFD (ArcFace 5-pt pipeline)…")
    model = MobileFaceNet(args.model or None, args.det_model or None)
    print(
        f"Model {MODEL_NAME} v{MODEL_VERSION} pipeline={PIPELINE_ID} dims≈{EMBEDDING_DIMS}"
    )

    guests: List[Dict[str, Any]] = []
    linked_guest_ids: Set[int] = set()
    if not args.dry_run:
        print(f"Fetching guests for party {args.party_id}…")
        guests = fetch_party_guests(args.api_base, token, args.party_id)
        print(f"  {len(guests)} guests")
        linked_guest_ids = fetch_linked_guest_ids(args.api_base, token)
        print(f"  {len(linked_guest_ids)} guests already identity-linked (skipped for fuzzy)")
    else:
        print("(dry-run) skipping guest fetch")

    ambiguous_report: List[Dict[str, Any]] = []
    pending_report: List[Dict[str, Any]] = []
    stats = {
        "people": 0,
        "skipped_blocked": 0,
        "uploaded": 0,
        "embeddings": 0,
        "no_faces": 0,
        "image_miss": 0,
        "skipped_media": 0,
        "errors": 0,
        "pending_confirm": 0,
    }

    with tempfile.TemporaryDirectory(prefix="tabul8_photos_") as tmp:
        tmp_path = Path(tmp)
        print("Copying Photos.sqlite to temp (read-only use)…")
        db_path = copy_photos_db(library, tmp_path)
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        people = load_named_people(conn)
        if args.limit and args.limit > 0:
            people = people[: args.limit]
        print(f"Named people (excluding blocked): {len(people)}")

        for person in people:
            stats["people"] += 1
            name = person["name"]
            if is_blocked_name(name):
                stats["skipped_blocked"] += 1
                continue
            faces = load_faces_for_person(
                conn, person["pk"], limit=args.faces_per_person
            )
            if not faces:
                stats["no_faces"] += 1
                continue

            status, guest_id, pending_guest_id, candidates = (
                match_guest(name, guests, linked_guest_ids)
                if guests
                else ("unmatched", None, None, [])
            )
            if status == "exact" and guest_id:
                # Confirmed/exact link — later fuzzy must not propose this guest.
                linked_guest_ids.add(int(guest_id))

            if status == "ambiguous":
                ambiguous_report.append(
                    {
                        "photos_name": name,
                        "person_uuid": person["person_uuid"],
                        "candidates": [
                            {"guest_id": c.get("id"), "name": c.get("name")}
                            for c in candidates
                        ],
                    }
                )
                guest_id = None
                pending_guest_id = None
                print(f"  AMBIGUOUS: {name} — not linking guest")
            elif status == "fuzzy_pending":
                stats["pending_confirm"] += 1
                pending_report.append(
                    {
                        "photos_name": name,
                        "person_uuid": person["person_uuid"],
                        "pending_guest_id": pending_guest_id,
                        "candidates": [
                            {"guest_id": c.get("id"), "name": c.get("name")}
                            for c in candidates
                        ],
                    }
                )
                print(
                    f"  PENDING CONFIRM: {name} → guest_id={pending_guest_id} "
                    f"(admin must confirm; not greeted until linked/named)"
                )
            elif status == "blocked":
                stats["skipped_blocked"] += 1
                continue

            embeddings: List[Dict[str, Any]] = []
            for face in faces:
                asset_pk = face.get("asset_pk")
                if asset_pk and asset_is_video_or_raw(conn, int(asset_pk)):
                    stats["skipped_media"] += 1
                    continue
                asset_path = resolve_asset_path(conn, library, asset_pk)
                if not asset_path:
                    stats["image_miss"] += 1
                    continue
                bgr = load_image_bgr(asset_path)
                if bgr is None:
                    stats["image_miss"] += 1
                    continue
                try:
                    vec = model.embed_photos_face(
                        bgr, face["cx"], face["cy"], face["sz"], y_from_bottom=True
                    )
                except Exception as exc:  # noqa: BLE001
                    stats["errors"] += 1
                    print(f"  embed fail {name} face={face['face_uuid']}: {exc}")
                    continue
                embeddings.append(
                    {
                        "vector": vec,
                        "quality": face.get("quality"),
                        "source_face_uuid": face["face_uuid"],
                        "model_name": MODEL_NAME,
                        "model_version": MODEL_VERSION,
                        "pipeline": PIPELINE_ID,
                    }
                )
            if not embeddings:
                continue
            try:
                res = upload_identity(
                    args.api_base,
                    token,
                    args.party_id,
                    name,
                    person["person_uuid"],
                    guest_id,
                    pending_guest_id,
                    embeddings,
                    args.dry_run,
                )
                stats["uploaded"] += 1
                stats["embeddings"] += len(embeddings)
                print(
                    f"  OK {name} guest={guest_id} pending={pending_guest_id} "
                    f"faces={len(embeddings)} match={status} dry={args.dry_run}"
                )
                if not args.dry_run and res.get("skipped"):
                    print(f"    skipped by server: {res.get('reason')}")
            except Exception as exc:  # noqa: BLE001
                stats["errors"] += 1
                print(f"  UPLOAD FAIL {name}: {exc}")

        conn.close()

    print("\n=== Summary ===")
    print(json.dumps(stats, indent=2))
    if pending_report:
        print("\n=== Pending guest links (confirm in Tabul8 admin) ===")
        print(json.dumps(pending_report, indent=2))
    if ambiguous_report:
        print("\n=== Ambiguous name matches (not linked) ===")
        print(json.dumps(ambiguous_report, indent=2))
    return 0 if stats["errors"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
