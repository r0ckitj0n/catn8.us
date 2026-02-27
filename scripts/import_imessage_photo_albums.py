#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import glob
import json
import os
import plistlib
import re
import shutil
import sqlite3
import subprocess
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


@dataclass
class FacePerson:
    person_id: int
    name: str
    face_count: int


@dataclass
class PhotoAsset:
    asset_id: int
    filename: str
    original_filename: str
    directory: str
    uuid: str
    date_created: Optional[dt.datetime]
    person_ids: Tuple[int, ...]


@dataclass
class MessageRow:
    message_id: int
    handle_id: str
    text: str
    sent_at: dt.datetime
    is_from_me: int
    attachment_path: Optional[Path]
    attachment_mime: str


@dataclass
class AlbumPage:
    sent_at: dt.datetime
    caption: str
    media_items: List[Tuple[str, str]]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Import iMessage/Photos memories into CATN8 photo_albums")
    p.add_argument("--mode", choices=["attachment_match", "photos_timeline"], default="attachment_match")
    p.add_argument("--contact", default="Trinity")
    p.add_argument("--years", type=int, default=4)
    p.add_argument("--photos-db", default="~/Pictures/Photos Library.photoslibrary/database/Photos.sqlite")
    p.add_argument("--messages-db", default="~/Library/Messages/chat.db")
    p.add_argument("--violet-face-id", type=int, default=None)
    p.add_argument("--eleanor-face-id", type=int, default=None)
    p.add_argument("--violet-birth-date", default="2021-11-29")
    p.add_argument("--eleanor-birth-date", default="2025-12-31")
    p.add_argument("--start-date", default="")
    p.add_argument("--end-date", default="")
    p.add_argument("--staging-dir", default="./photo_albums")
    p.add_argument("--album-title-prefix", default="Trinity Memories")
    p.add_argument("--min-pages", type=int, default=10)
    p.add_argument("--max-pages", type=int, default=50)
    p.add_argument("--target-pages", type=int, default=25)
    p.add_argument("--max-export-items", type=int, default=40)
    p.add_argument("--disable-ai", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args()


def load_env_files() -> None:
    for env_file in (".env", ".env.local", ".env.live"):
        path = Path(env_file)
        if not path.exists():
            continue
        for line in path.read_text(errors="ignore").splitlines():
            s = line.strip()
            if not s or s.startswith("#") or "=" not in s:
                continue
            k, v = s.split("=", 1)
            k = k.strip()
            if k and k not in os.environ:
                os.environ[k] = v.strip().strip('"').strip("'")


def parse_date(value: str) -> dt.date:
    return dt.datetime.strptime(value.strip(), "%Y-%m-%d").date()


def sqlite_connect_readonly(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def sqlite_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    return [str(r[1]) for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]


def choose_first(columns: Iterable[str], preferred: Sequence[str]) -> Optional[str]:
    colset = set(columns)
    for c in preferred:
        if c in colset:
            return c
    return None


def resolve_photos_db_path(input_path: str) -> Path:
    preferred = Path(os.path.expanduser(input_path)).resolve()
    if preferred.exists():
        return preferred
    candidates = [
        Path("~/Library/Photos/Libraries/Photos Library.photoslibrary/database/Photos.sqlite").expanduser(),
        Path("~/Library/Photos/Libraries/Syndication.photoslibrary/database/Photos.sqlite").expanduser(),
    ]
    for c in candidates:
        if c.exists():
            return c.resolve()
    root = Path("~/Library/Photos/Libraries").expanduser()
    if root.exists():
        for lib in sorted(root.glob("*.photoslibrary")):
            db = lib / "database" / "Photos.sqlite"
            if db.exists():
                return db.resolve()
    return preferred


def apple_ts_to_datetime(value: Any) -> Optional[dt.datetime]:
    if value is None:
        return None
    try:
        raw = int(value)
    except Exception:
        return None


def sanitize_message_text(value: str) -> str:
    v = (value or "").replace("\r", " ").replace("\n", " ").replace("\x00", " ").strip()
    if not v:
        return ""
    v = re.sub(r"\b(streamtyped|NSMutableAttributedString|NSAttributedString|NSObject|NSMutableString|NSString|NSDictionary|NSNumber|NSValue|NSMutableData|NSData)\b", " ", v)
    v = re.sub(r"\bkIM[A-Za-z0-9_]+\b", " ", v)
    v = re.sub(r"\biI\b", " ", v)
    v = re.sub(r"\s+", " ", v).strip()
    token_hits = len(re.findall(r"\b(NS|NSMutable|NSDictionary|kIM|streamtyped)\w*\b", v))
    if token_hits >= 3:
        return ""
    return v


def extract_text_from_attributed_body(blob: bytes) -> str:
    if not blob:
        return ""

    try:
        if blob[:6] == b"bplist":
            obj = plistlib.loads(blob)
            strings: List[str] = []

            def walk(v: object) -> None:
                if isinstance(v, str):
                    s = v.strip()
                    if s:
                        strings.append(s)
                elif isinstance(v, dict):
                    for vv in v.values():
                        walk(vv)
                elif isinstance(v, (list, tuple)):
                    for vv in v:
                        walk(vv)

            walk(obj)
            if strings:
                uniq: List[str] = []
                seen: set[str] = set()
                for s in strings:
                    c = sanitize_message_text(s)
                    if c and c not in seen:
                        seen.add(c)
                        uniq.append(c)
                return " ".join(uniq[:16]).strip()
    except Exception:
        pass

    try:
        decoded = blob.decode("utf-8", errors="ignore").replace("\x00", " ")
    except Exception:
        return ""
    segments = re.findall(r"NSString\s+(.+?)(?:\s+iI\s+NSDictionary|\s+NSDictionary|$)", decoded)
    out: List[str] = []
    seen2: set[str] = set()
    for seg in segments:
        c = sanitize_message_text(seg)
        if c and c not in seen2:
            seen2.add(c)
            out.append(c)
    return " ".join(out[:8]).strip()
    epoch = dt.datetime(2001, 1, 1, tzinfo=dt.timezone.utc)
    secs = raw / 1_000_000_000 if raw > 10_000_000_000 else float(raw)
    try:
        return (epoch + dt.timedelta(seconds=secs)).astimezone()
    except Exception:
        return None


def load_named_faces(photos_conn: sqlite3.Connection) -> List[FacePerson]:
    p_cols = sqlite_columns(photos_conn, "ZPERSON")
    d_cols = sqlite_columns(photos_conn, "ZDETECTEDFACE")
    person_id_col = choose_first(p_cols, ["Z_PK"])
    name_col = choose_first(p_cols, ["ZFULLNAME", "ZDISPLAYNAME", "ZNAME"])
    join_person_col = choose_first(d_cols, ["ZPERSONFORFACE", "ZPERSON"])
    if not person_id_col or not name_col or not join_person_col:
        raise RuntimeError("Unable to map required Photos face tables")
    rows = photos_conn.execute(
        f"""
        SELECT p.{person_id_col} AS person_id,
               TRIM(COALESCE(p.{name_col}, '')) AS name,
               COUNT(df.Z_PK) AS face_count
        FROM ZPERSON p
        LEFT JOIN ZDETECTEDFACE df ON df.{join_person_col} = p.{person_id_col}
        WHERE TRIM(COALESCE(p.{name_col}, '')) <> ''
        GROUP BY p.{person_id_col}, p.{name_col}
        ORDER BY LOWER(p.{name_col}) ASC
        """
    ).fetchall()
    return [FacePerson(int(r["person_id"]), str(r["name"]), int(r["face_count"])) for r in rows]


def prompt_face_ids(named_faces: Sequence[FacePerson]) -> Tuple[int, int]:
    print("\nNamed Faces Found:")
    print("=" * 56)
    for f in named_faces:
        print(f"Face ID: {f.person_id:>6} | Name: {f.name} | Tagged Faces: {f.face_count}")
    print("=" * 56)
    return int(input("Enter Face ID for Violet: ").strip()), int(input("Enter Face ID for Eleanor: ").strip())


def load_face_assets(photos_conn: sqlite3.Connection, person_ids: Sequence[int]) -> List[PhotoAsset]:
    if not person_ids:
        return []
    d_cols = sqlite_columns(photos_conn, "ZDETECTEDFACE")
    a_cols = sqlite_columns(photos_conn, "ZASSET")
    d_person_col = choose_first(d_cols, ["ZPERSONFORFACE", "ZPERSON"])
    d_asset_col = choose_first(d_cols, ["ZASSETFORFACE", "ZASSET"])
    a_pk_col = choose_first(a_cols, ["Z_PK"])
    a_filename_col = choose_first(a_cols, ["ZFILENAME", "ZORIGINALFILENAME"])
    a_dir_col = choose_first(a_cols, ["ZDIRECTORY", "ZDIRECTORYNAME"])
    a_uuid_col = choose_first(a_cols, ["ZUUID"])
    a_date_col = choose_first(a_cols, ["ZDATECREATED", "ZADDEDDATE", "ZSORTTOKEN"])
    a_additional_col = choose_first(a_cols, ["ZADDITIONALATTRIBUTES"])
    if not all([d_person_col, d_asset_col, a_pk_col, a_filename_col]):
        raise RuntimeError("Unable to map required Photos asset columns")

    has_additional = photos_conn.execute(
        "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='ZADDITIONALASSETATTRIBUTES'"
    ).fetchone()["c"] > 0
    additional_join = ""
    original_sel = "'' AS original_filename"
    if has_additional and a_additional_col:
        additional_join = f"LEFT JOIN ZADDITIONALASSETATTRIBUTES aa ON aa.Z_PK = a.{a_additional_col}"
        original_sel = "COALESCE(aa.ZORIGINALFILENAME, '') AS original_filename"

    placeholders = ",".join(["?"] * len(person_ids))
    sql = f"""
        SELECT
            a.{a_pk_col} AS asset_id,
            COALESCE(a.{a_filename_col}, '') AS filename,
            {original_sel},
            COALESCE(a.{a_dir_col}, '') AS directory,
            COALESCE(a.{a_uuid_col}, '') AS uuid,
            a.{a_date_col} AS date_created,
            GROUP_CONCAT(DISTINCT df.{d_person_col}) AS person_ids_csv
        FROM ZDETECTEDFACE df
        INNER JOIN ZASSET a ON a.{a_pk_col} = df.{d_asset_col}
        {additional_join}
        WHERE df.{d_person_col} IN ({placeholders})
        GROUP BY a.{a_pk_col}, filename, original_filename, directory, uuid, a.{a_date_col}
        ORDER BY a.{a_date_col} ASC
    """
    rows = photos_conn.execute(sql, tuple(person_ids)).fetchall()
    out: List[PhotoAsset] = []
    for r in rows:
        pids = tuple(sorted({int(x) for x in str(r["person_ids_csv"] or "").split(",") if x.strip().isdigit()}))
        out.append(
            PhotoAsset(
                asset_id=int(r["asset_id"]),
                filename=str(r["filename"] or ""),
                original_filename=str(r["original_filename"] or ""),
                directory=str(r["directory"] or ""),
                uuid=str(r["uuid"] or ""),
                date_created=apple_ts_to_datetime(r["date_created"]),
                person_ids=pids,
            )
        )
    return out


def normalize_contact_handle_variants(value: str) -> List[str]:
    value = (value or "").strip()
    if not value:
        return []
    out = {value}
    if "@" not in value:
        digits = re.sub(r"\D+", "", value)
        if digits:
            out.add(digits)
            if len(digits) == 10:
                out.update({f"+1{digits}", f"1{digits}"})
            elif len(digits) == 11 and digits.startswith("1"):
                out.update({f"+{digits}", digits[1:]})
    return [x.lower() for x in out if x.strip()]


def discover_contact_handles(contact: str) -> List[str]:
    contact = (contact or "").strip().lower()
    if not contact:
        return []
    handles: set[str] = set()
    for db_path in glob.glob(os.path.expanduser("~/Library/Application Support/AddressBook/**/*.abcddb"), recursive=True):
        try:
            conn = sqlite_connect_readonly(Path(db_path))
        except Exception:
            continue
        try:
            has = conn.execute("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='ZABCDRECORD'").fetchone()["c"]
            if not has:
                continue
            rows = conn.execute(
                """
                SELECT Z_PK AS id
                FROM ZABCDRECORD
                WHERE LOWER(COALESCE(ZFIRSTNAME,'')) LIKE ?
                   OR LOWER(COALESCE(ZLASTNAME,'')) LIKE ?
                   OR LOWER(COALESCE(ZNAME,'')) LIKE ?
                """,
                (f"%{contact}%", f"%{contact}%", f"%{contact}%"),
            ).fetchall()
            for row in rows:
                rid = int(row["id"])
                for table, field in (("ZABCDPHONENUMBER", "ZFULLNUMBER"), ("ZABCDEMAILADDRESS", "ZADDRESS"), ("ZABCDMESSAGINGADDRESS", "ZADDRESS")):
                    for e in conn.execute(f"SELECT COALESCE({field}, '') AS v FROM {table} WHERE ZOWNER=? OR Z22_OWNER=?", (rid, rid)).fetchall():
                        for variant in normalize_contact_handle_variants(str(e["v"] or "")):
                            handles.add(variant)
        finally:
            conn.close()
    return sorted(handles)


def load_messages(messages_db: Path, contact: str, years: int, contact_handles: Sequence[str], start_date: Optional[dt.date], end_date: Optional[dt.date]) -> List[MessageRow]:
    cutoff = start_date or (dt.datetime.now().astimezone().date() - dt.timedelta(days=years * 365))
    conn = sqlite_connect_readonly(messages_db)
    try:
        handles = [h.lower().strip() for h in contact_handles if h and h.strip()]
        if handles:
            ph = ",".join(["?"] * len(handles))
            sql = f"""
            SELECT m.ROWID AS message_id, COALESCE(h.id,'') AS handle_id, COALESCE(m.text,'') AS text,
                   m.date AS msg_date, COALESCE(m.is_from_me,0) AS is_from_me,
                   m.attributedBody AS attributed_body,
                   COALESCE(a.filename,'') AS attachment_filename, COALESCE(a.mime_type,'') AS attachment_mime
            FROM message m
            LEFT JOIN handle h ON h.ROWID = m.handle_id
            LEFT JOIN message_attachment_join maj ON maj.message_id = m.ROWID
            LEFT JOIN attachment a ON a.ROWID = maj.attachment_id
            WHERE LOWER(COALESCE(h.id,'')) IN ({ph})
               OR EXISTS (
                   SELECT 1 FROM chat_message_join cmj
                   INNER JOIN chat_handle_join chj ON chj.chat_id = cmj.chat_id
                   INNER JOIN handle hh ON hh.ROWID = chj.handle_id
                   WHERE cmj.message_id = m.ROWID AND LOWER(COALESCE(hh.id,'')) IN ({ph})
               )
            ORDER BY m.date ASC, m.ROWID ASC
            """
            rows = conn.execute(sql, tuple(handles + handles)).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT m.ROWID AS message_id, COALESCE(h.id,'') AS handle_id, COALESCE(m.text,'') AS text,
                       m.date AS msg_date, COALESCE(m.is_from_me,0) AS is_from_me,
                       m.attributedBody AS attributed_body,
                       COALESCE(a.filename,'') AS attachment_filename, COALESCE(a.mime_type,'') AS attachment_mime
                FROM message m
                LEFT JOIN handle h ON h.ROWID = m.handle_id
                LEFT JOIN message_attachment_join maj ON maj.message_id = m.ROWID
                LEFT JOIN attachment a ON a.ROWID = maj.attachment_id
                WHERE LOWER(COALESCE(h.id,'')) LIKE ?
                ORDER BY m.date ASC, m.ROWID ASC
                """,
                (f"%{contact.lower()}%",),
            ).fetchall()
    finally:
        conn.close()

    out: List[MessageRow] = []
    for r in rows:
        sent = apple_ts_to_datetime(r["msg_date"])
        if sent is None:
            continue
        if sent.date() < cutoff:
            continue
        if end_date and sent.date() > end_date:
            continue
        raw = str(r["attachment_filename"] or "").strip()
        ap: Optional[Path] = None
        if raw:
            ap = Path(raw.replace("~", str(Path.home())))
            if not ap.is_absolute():
                ap = Path.home() / "Library" / "Messages" / raw
            ap = ap.resolve()
        text_value = sanitize_message_text(str(r["text"] or ""))
        if not text_value and r["attributed_body"] is not None:
            attr = r["attributed_body"]
            if isinstance(attr, memoryview):
                attr = bytes(attr)
            if isinstance(attr, (bytes, bytearray)):
                text_value = sanitize_message_text(extract_text_from_attributed_body(bytes(attr)))
        out.append(
            MessageRow(
                message_id=int(r["message_id"]),
                handle_id=str(r["handle_id"]),
                text=text_value,
                sent_at=sent,
                is_from_me=int(r["is_from_me"] or 0),
                attachment_path=ap,
                attachment_mime=str(r["attachment_mime"] or "").strip(),
            )
        )
    return out


def is_image_path(path: Optional[Path], mime: str) -> bool:
    if path is None:
        return False
    if path.suffix.lower() in {".heic", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}:
        return True
    return mime.lower().startswith("image/")


def build_rich_caption(messages: Sequence[MessageRow], index: int) -> str:
    snippets: List[str] = []
    focal = messages[index]
    for j in range(max(0, index - 4), min(len(messages), index + 5)):
        t = (messages[j].text or "").strip()
        if not t:
            continue
        if abs((messages[j].sent_at - focal.sent_at).total_seconds()) > 12 * 3600:
            continue
        snippets.append(t)
    if not snippets:
        return "(no caption)"
    uniq: List[str] = []
    seen: set[str] = set()
    for s in snippets:
        k = s.lower().strip()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(s)
        if len(uniq) >= 4:
            break
    return " | ".join(uniq)


def aggregate_album_pages_by_day(pages: Sequence[AlbumPage], max_media_per_day: int = 24) -> List[AlbumPage]:
    buckets: Dict[dt.date, Dict[str, Any]] = {}
    for page in pages:
        day = page.sent_at.date()
        bucket = buckets.get(day)
        if bucket is None:
            bucket = {"sent_at": page.sent_at, "captions": [], "media_items": [], "media_keys": set()}
            buckets[day] = bucket
        if page.sent_at < bucket["sent_at"]:
            bucket["sent_at"] = page.sent_at
        c = sanitize_message_text(page.caption)
        if c and c not in bucket["captions"]:
            bucket["captions"].append(c)
        for rel_path, source_name in page.media_items:
            key = (rel_path, source_name)
            if key in bucket["media_keys"]:
                continue
            bucket["media_keys"].add(key)
            bucket["media_items"].append((rel_path, source_name))

    out: List[AlbumPage] = []
    for day in sorted(buckets.keys()):
        bucket = buckets[day]
        caption = " | ".join(bucket["captions"][:12]).strip() or "(no caption)"
        media_items = list(bucket["media_items"])[:max_media_per_day]
        if not media_items and caption == "(no caption)":
            continue
        out.append(AlbumPage(sent_at=bucket["sent_at"], caption=caption, media_items=media_items))
    return out


def photos_export_by_filename(filename: str, out_dir: Path) -> Optional[Path]:
    if not filename:
        return None
    out_dir.mkdir(parents=True, exist_ok=True)
    target = filename.replace('"', '')
    out_dir_escaped = str(out_dir).replace('"', '\\"')
    script = f'''
    set outFolder to POSIX file "{out_dir_escaped}"
    tell application "Photos"
      set matches to every media item whose filename is "{target}"
      if (count of matches) is 0 then
        return ""
      end if
      export {{item 1 of matches}} to outFolder with using originals
    end tell
    '''
    try:
        proc = subprocess.run(
            ["osascript", "-e", script],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=120,
        )
    except subprocess.TimeoutExpired:
        return None
    if proc.returncode != 0:
        return None
    candidates = sorted(out_dir.glob(filename), key=lambda p: p.stat().st_mtime, reverse=True)
    if candidates:
        return candidates[0]
    low = filename.lower()
    fallback = sorted([p for p in out_dir.iterdir() if p.is_file() and p.name.lower() == low], key=lambda p: p.stat().st_mtime, reverse=True)
    return fallback[0] if fallback else None


def convert_to_png(source_path: Path, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if source_path.suffix.lower() == ".png":
        shutil.copy2(source_path, out_path)
        return
    proc = subprocess.run(["sips", "-s", "format", "png", str(source_path), "--out", str(out_path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"sips conversion failed: {source_path} :: {proc.stderr.strip()}")


def chunk_sizes(total: int, min_pages: int, max_pages: int, target_pages: int) -> List[int]:
    if total <= 0:
        return []
    if total <= max_pages:
        return [total]
    sizes: List[int] = []
    remaining = total
    while remaining > 0:
        size = min(target_pages, max_pages, remaining)
        tail = remaining - size
        if 0 < tail < min_pages:
            size -= min(size - min_pages, min_pages - tail)
        sizes.append(size)
        remaining -= size
    return [s for s in sizes if s > 0]


def normalize_csv_tokens(value: str, fallback: Sequence[str]) -> List[str]:
    xs = [x.strip() for x in str(value or "").split(",") if x.strip()]
    return xs[:8] if xs else list(fallback)


def heuristic_style_from_captions(captions: Sequence[str]) -> Dict[str, str]:
    corpus = " ".join(captions).lower()
    style = {
        "memory_era": "family timeline",
        "mood": "warm and nostalgic",
        "dominant_palette": "rose, cream, sage",
        "scrapbook_materials": "linen, torn paper, tape",
        "motif_keywords": "postmarks, doodles, pressed flowers",
        "camera_style": "35mm candid",
        "texture_intensity": "balanced",
    }
    if any(x in corpus for x in ["newborn", "hospital", "born", "tiny", "sleep"]):
        style.update({"mood": "tender and grateful", "dominant_palette": "blush, ivory, powder blue", "motif_keywords": "tiny footprints, baby blankets, handwritten dates"})
    return style


def infer_style_with_ai(captions: Sequence[str], album_title: str, disable_ai: bool) -> Dict[str, str]:
    fallback = heuristic_style_from_captions(captions)
    if disable_ai:
        return fallback
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return fallback
    payload = {
        "model": os.environ.get("CATN8_AI_MODEL", "gpt-4o-mini"),
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Return strict JSON scrapbook style fields."},
            {"role": "user", "content": json.dumps({"title": album_title, "captions": captions[:80], "fields": list(fallback.keys())})},
        ],
        "temperature": 0.4,
    }
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=json.dumps(payload).encode("utf-8"), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
        parsed = json.loads(raw["choices"][0]["message"]["content"])
        out = {k: str(parsed.get(k) or fallback[k]) for k in fallback.keys()}
        if out["texture_intensity"] not in {"subtle", "balanced", "rich"}:
            out["texture_intensity"] = "balanced"
        return out
    except Exception:
        return fallback


def build_cover_prompt_template(title: str, summary: str, style: Dict[str, str]) -> str:
    return "\n".join([
        "[CATN8_SCRAPBOOK_COVER_PROMPT_V1]",
        "Create a scrapbook album cover with a handcrafted look.",
        "Style constraints:",
        "- Endearing memory-focused design, never futuristic UI.",
        "- Tactile materials and layered paper textures.",
        "- Keep text readable for title and subtitle areas.",
        f"Album title: {title}",
        f"Album summary: {summary}",
        f"Memory era: {style['memory_era']}",
        f"Mood: {style['mood']}",
        f"Dominant palette: {style['dominant_palette']}",
        f"Materials: {style['scrapbook_materials']}",
        f"Motifs: {style['motif_keywords']}",
        f"Camera style inspiration: {style['camera_style']}",
        f"Texture intensity: {style['texture_intensity']}",
        "Output intent: one hero cover graphic suitable for a digital scrapbook viewer.",
    ])


def slugify(value: str) -> str:
    out = []
    prev_dash = False
    for ch in value.strip().lower():
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        elif not prev_dash:
            out.append("-")
            prev_dash = True
    return ("".join(out).strip("-") or "album")[:120]


def build_mysql_connection_from_env():
    try:
        import pymysql
    except Exception as exc:
        raise RuntimeError(f"pymysql is required ({exc})") from exc
    host = os.environ.get("CATN8_DB_HOST", "").strip() or os.environ.get("CATN8_DB_LIVE_HOST", "").strip()
    user = os.environ.get("CATN8_DB_USER", "").strip() or os.environ.get("CATN8_DB_LIVE_USER", "").strip()
    password = os.environ.get("CATN8_DB_PASSWORD", "") or os.environ.get("CATN8_DB_LIVE_PASS", "")
    database = os.environ.get("CATN8_DB_NAME", "").strip() or os.environ.get("CATN8_DB_LIVE_NAME", "").strip()
    port = int((os.environ.get("CATN8_DB_PORT", "") or os.environ.get("CATN8_DB_LIVE_PORT", "3306")).strip())
    if not host or not user or not database:
        raise RuntimeError("Missing DB env vars for host/user/database")
    return pymysql.connect(host=host, user=user, password=password, database=database, port=port, charset="utf8mb4", autocommit=False, cursorclass=pymysql.cursors.DictCursor)


def ensure_album_permissions_table(cur) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS photo_album_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      album_id INT NOT NULL,
      group_id INT NOT NULL,
      can_view TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_album_group (album_id, group_id),
      KEY idx_pap_album (album_id),
      KEY idx_pap_group (group_id),
      CONSTRAINT fk_pap_album FOREIGN KEY (album_id) REFERENCES photo_albums(id) ON DELETE CASCADE,
      CONSTRAINT fk_pap_group FOREIGN KEY (group_id) REFERENCES catn8_groups(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)


def fetch_required_group_ids(cur) -> Tuple[int, int]:
    cur.execute("""
    SELECT id, slug, title FROM catn8_groups
    WHERE slug IN ('photo-albums-users','administrators')
       OR LOWER(title) IN ('photo albums','photo albums users','administrators')
    """)
    photo_group_id = None
    admin_group_id = None
    for r in cur.fetchall():
        slug = str(r.get("slug") or "").strip().lower()
        title = str(r.get("title") or "").strip().lower()
        gid = int(r.get("id"))
        if slug == "photo-albums-users" or title in {"photo albums", "photo albums users"}:
            photo_group_id = gid
        if slug == "administrators" or title == "administrators":
            admin_group_id = gid
    if photo_group_id is None or admin_group_id is None:
        raise RuntimeError("Required permission groups missing")
    return photo_group_id, admin_group_id


def unique_slug(cur, base_slug: str) -> str:
    slug = base_slug
    n = 2
    while True:
        cur.execute("SELECT id FROM photo_albums WHERE slug=%s LIMIT 1", (slug,))
        if not cur.fetchone():
            return slug
        suffix = f"-{n}"
        slug = f"{base_slug[:max(1, 120-len(suffix))]}{suffix}"
        n += 1


def sql_quote(value: str) -> str:
    return "'" + str(value).replace("\\", "\\\\").replace("'", "''") + "'"


def build_album_rows(album_batches: List[List[AlbumPage]], title_prefix: str, disable_ai: bool) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    stamp = dt.datetime.now().strftime("%Y%m%d%H%M%S")
    for idx, pages in enumerate(album_batches, start=1):
        first_dt = pages[0].sent_at.strftime("%Y-%m-%d")
        last_dt = pages[-1].sent_at.strftime("%Y-%m-%d")
        title = f"{title_prefix} {idx}"
        summary = f"Imported memories ({first_dt} to {last_dt}). {len(pages)} pages."
        slug = f"{slugify(f'{title_prefix}-{idx}-{first_dt}')[:100]}-{stamp}-{idx}"[:120]

        captions = [p.caption for p in pages]
        style = infer_style_with_ai(captions, title, disable_ai=disable_ai)
        palette = normalize_csv_tokens(style["dominant_palette"], ["rose", "cream", "sage"])
        materials = normalize_csv_tokens(style["scrapbook_materials"], ["linen", "tape", "postcards"])
        motifs = normalize_csv_tokens(style["motif_keywords"], ["postmarks", "ribbons", "handwriting"])

        spreads = []
        for i, page in enumerate(pages, start=1):
            images = []
            for rel_path, source_name in page.media_items[:24]:
                images.append({
                    "src": rel_path,
                    "captured_at": page.sent_at.isoformat(),
                    "source_filename": source_name,
                    "caption": page.caption,
                    "memory_text": page.caption,
                })
            spreads.append(
                {
                    "spread_number": i,
                    "title": "Opening Notes" if i == 1 else f"Memory Spread {i}",
                    "caption": page.caption,
                    "photo_slots": max(1, len(images)),
                    "embellishments": [motifs[(i - 1) % len(motifs)], materials[(i - 1) % len(materials)]],
                    "background_prompt": " | ".join([
                        "[CATN8_SCRAPBOOK_SPREAD_BG_V1]",
                        f"Spread: {i}/{len(pages)}",
                        f"Mood: {style['mood']}",
                        f"Memory era: {style['memory_era']}",
                        f"Palette: {', '.join(palette)}",
                        f"Materials: {', '.join(materials)}",
                        f"Motifs: {', '.join(motifs)}",
                    ]),
                    "images": images,
                }
            )

        spec = {
            "schema_version": "catn8_scrapbook_spec_v1",
            "dimensions": {"width_px": 1400, "height_px": 1050, "aspect_ratio": "4:3", "safe_margin_px": 56, "bleed_px": 24},
            "controls": {
                "page_turn_style": "ribbon-tabs",
                "zoom": {"min": 0.75, "max": 2.5, "step": 0.25, "initial": 1},
                "downloads": {"allow_cover_download": True, "allow_page_download": True, "formats": ["png", "jpg", "webp"], "default_format": "png"},
            },
            "style_guide": {"memory_era": style["memory_era"], "mood": style["mood"], "palette": palette, "materials": materials, "motifs": motifs, "scrapbook_feel": "A deeply personal, handcrafted scrapbook assembled over months or years."},
            "spreads": spreads,
        }

        rows.append({
            "title": title,
            "summary": summary,
            "slug": slug,
            "cover_image_url": pages[0].media_items[0][0] if pages[0].media_items else "",
            "cover_prompt": build_cover_prompt_template(title, summary, style),
            "spec_json": json.dumps(spec, ensure_ascii=True),
        })
    return rows


def build_sql_for_album_rows(rows: List[Dict[str, Any]], created_by_user_id: int) -> str:
    parts = ["""
CREATE TABLE IF NOT EXISTS photo_album_permissions (
 id INT AUTO_INCREMENT PRIMARY KEY,
 album_id INT NOT NULL,
 group_id INT NOT NULL,
 can_view TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uniq_album_group (album_id, group_id),
 KEY idx_pap_album (album_id),
 KEY idx_pap_group (group_id),
 CONSTRAINT fk_pap_album FOREIGN KEY (album_id) REFERENCES photo_albums(id) ON DELETE CASCADE,
 CONSTRAINT fk_pap_group FOREIGN KEY (group_id) REFERENCES catn8_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
""".strip()]
    for r in rows:
        parts.append(f"""
INSERT INTO photo_albums
(title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, created_by_user_id)
VALUES (
{sql_quote(r['title'])},
{sql_quote(r['slug'])},
{sql_quote(r['summary'])},
{sql_quote(r['cover_image_url'])},
{sql_quote(r['cover_prompt'])},
{sql_quote(r['spec_json'])},
1,
{int(created_by_user_id)}
);
SET @album_id := LAST_INSERT_ID();
INSERT INTO photo_album_permissions (album_id, group_id, can_view)
SELECT @album_id, g.id, 1 FROM catn8_groups g
WHERE g.slug IN ('photo-albums-users', 'administrators')
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);
        """.strip())
    return "\n\n".join(parts) + "\n"


def upload_sql_via_maintenance_api(sql_text: str) -> None:
    base_url = os.environ.get("CATN8_BASE_URL", "https://catn8.us").strip().rstrip("/")
    token = os.environ.get("CATN8_ADMIN_TOKEN", "").strip()
    if not token:
        raise RuntimeError("CATN8_ADMIN_TOKEN required for maintenance API fallback")
    state_dir = Path(".local/state")
    state_dir.mkdir(parents=True, exist_ok=True)
    sql_path = state_dir / f"photo_album_import_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    sql_path.write_text(sql_text, encoding="utf-8")
    url = f"{base_url}/api/database_maintenance.php?action=restore_database&admin_token={token}"
    proc = subprocess.run(["curl", "-sS", "-X", "POST", "-F", f"backup_file=@{sql_path};type=text/plain", url], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Maintenance API upload failed: {proc.stderr.strip() or proc.stdout.strip()}")
    payload = json.loads(proc.stdout or "{}")
    if not payload.get("success"):
        raise RuntimeError(f"Maintenance API restore failed: {payload}")


def upload_albums(album_batches: List[List[AlbumPage]], title_prefix: str, created_by_user_id: int, disable_ai: bool) -> None:
    rows = build_album_rows(album_batches, title_prefix, disable_ai)
    conn = build_mysql_connection_from_env()
    try:
        with conn.cursor() as cur:
            ensure_album_permissions_table(cur)
            photo_group_id, admin_group_id = fetch_required_group_ids(cur)
            for row in rows:
                slug = unique_slug(cur, slugify(str(row["slug"])))
                cur.execute(
                    """
                    INSERT INTO photo_albums (title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, created_by_user_id)
                    VALUES (%s,%s,%s,%s,%s,%s,1,%s)
                    """,
                    (row["title"], slug, row["summary"], row["cover_image_url"], row["cover_prompt"], row["spec_json"], created_by_user_id),
                )
                album_id = int(cur.lastrowid)
                cur.execute(
                    """
                    INSERT INTO photo_album_permissions (album_id, group_id, can_view)
                    VALUES (%s,%s,1),(%s,%s,1)
                    ON DUPLICATE KEY UPDATE can_view=VALUES(can_view)
                    """,
                    (album_id, photo_group_id, album_id, admin_group_id),
                )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def pages_from_attachment_match(messages: Sequence[MessageRow], staging_dir: Path) -> List[AlbumPage]:
    pages: List[AlbumPage] = []
    for i, msg in enumerate(messages):
        if not is_image_path(msg.attachment_path, msg.attachment_mime):
            continue
        if msg.attachment_path is None or not msg.attachment_path.exists():
            continue
        caption = build_rich_caption(messages, i)
        out_name = f"page_{len(pages)+1:04d}.png"
        out_path = staging_dir / out_name
        convert_to_png(msg.attachment_path, out_path)
        pages.append(AlbumPage(sent_at=msg.sent_at, caption=caption, media_items=[(f"/photo_albums/{out_name}", msg.attachment_path.name)]))
    return aggregate_album_pages_by_day(pages)


def pages_from_photos_timeline(
    photos_db: Path,
    assets: Sequence[PhotoAsset],
    messages: Sequence[MessageRow],
    start_date: dt.date,
    end_date: Optional[dt.date],
    staging_dir: Path,
    max_export_items: int,
) -> List[AlbumPage]:
    export_dir = Path(".local/state/photos_timeline_exports")
    export_dir.mkdir(parents=True, exist_ok=True)

    candidates = [a for a in assets if a.date_created and a.date_created.date() >= start_date and (end_date is None or a.date_created.date() <= end_date)]
    candidates.sort(key=lambda a: a.date_created or dt.datetime.min.astimezone())
    pages: List[AlbumPage] = []
    attempts = 0
    max_attempts = max_export_items * 2
    uuid_like = re.compile(r"^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\.[A-Za-z0-9]+$")

    for asset in candidates:
        if len(pages) >= max_export_items:
            break
        if attempts >= max_attempts:
            break
        source: Optional[Path] = None
        preferred_names: List[str] = []
        for name in [asset.original_filename, asset.filename]:
            if not name:
                continue
            if uuid_like.match(name):
                continue
            preferred_names.append(name)
        if not preferred_names:
            continue
        for name in preferred_names:
            attempts += 1
            if attempts % 10 == 0:
                print(f"photos_timeline progress: attempted {attempts} exports, built {len(pages)} page(s)...")
            exported = photos_export_by_filename(name, export_dir)
            if exported and exported.exists():
                source = exported
                break
        if source is None:
            continue

        anchor = asset.date_created or dt.datetime.now().astimezone()
        nearest_idx = 0
        nearest_delta = None
        for i, msg in enumerate(messages):
            d = abs((msg.sent_at - anchor).total_seconds())
            if nearest_delta is None or d < nearest_delta:
                nearest_delta = d
                nearest_idx = i
        caption = build_rich_caption(messages, nearest_idx) if messages else "(no caption)"

        out_name = f"page_{len(pages)+1:04d}.png"
        out_path = staging_dir / out_name
        convert_to_png(source, out_path)
        pages.append(AlbumPage(sent_at=anchor, caption=caption, media_items=[(f"/photo_albums/{out_name}", source.name)]))
        if len(pages) % 5 == 0:
            print(f"photos_timeline progress: exported {len(pages)} page(s)...")

    return aggregate_album_pages_by_day(pages)


def main() -> None:
    load_env_files()
    args = parse_args()

    violet_birth = parse_date(args.violet_birth_date)
    eleanor_birth = parse_date(args.eleanor_birth_date)
    start_date = parse_date(args.start_date) if args.start_date.strip() else min(violet_birth, eleanor_birth)
    end_date = parse_date(args.end_date) if args.end_date.strip() else None

    photos_db = resolve_photos_db_path(args.photos_db)
    messages_db = Path(os.path.expanduser(args.messages_db)).resolve()
    staging_dir = Path(args.staging_dir).resolve()
    staging_dir.mkdir(parents=True, exist_ok=True)

    if not photos_db.exists():
        raise FileNotFoundError(f"Photos database not found: {photos_db}")
    if not messages_db.exists():
        raise FileNotFoundError(f"Messages database not found: {messages_db}")

    print(f"Mode: {args.mode}")
    print(f"Using Photos DB: {photos_db}")
    print(f"Using iMessage DB: {messages_db}")
    print(f"Start date: {start_date.isoformat()}")
    if end_date:
        print(f"End date: {end_date.isoformat()}")

    photos_conn = sqlite_connect_readonly(photos_db)
    try:
        faces = load_named_faces(photos_conn)
        if args.violet_face_id is not None and args.eleanor_face_id is not None:
            violet_id = int(args.violet_face_id)
            eleanor_id = int(args.eleanor_face_id)
            print(f"Using Face IDs: Violet={violet_id}, Eleanor={eleanor_id}")
        else:
            violet_id, eleanor_id = prompt_face_ids(faces)
        assets = load_face_assets(photos_conn, [violet_id, eleanor_id])
        print(f"Loaded {len(assets)} face-tagged assets from Photos DB.")
    finally:
        photos_conn.close()

    contact_handles = discover_contact_handles(args.contact)
    messages = load_messages(messages_db, args.contact, args.years, contact_handles, start_date, end_date)
    print(f"Loaded {len(messages)} messages in window.")

    if args.mode == "photos_timeline":
        pages = pages_from_photos_timeline(
            photos_db,
            assets,
            messages,
            start_date,
            end_date,
            staging_dir,
            max_export_items=max(1, min(args.max_export_items, args.max_pages)),
        )
    else:
        pages = pages_from_attachment_match(messages, staging_dir)

    if not pages:
        raise RuntimeError("No pages produced. For photos_timeline, ensure Photos can export originals for this date window.")

    sizes = chunk_sizes(len(pages), args.min_pages, args.max_pages, args.target_pages)
    batches: List[List[AlbumPage]] = []
    offset = 0
    for size in sizes:
        batches.append(pages[offset: offset + size])
        offset += size
    print(f"Generated {len(batches)} album(s): {[len(b) for b in batches]} pages each")

    if args.dry_run:
        print("Dry run enabled: skipping upload")
        return

    created_by_user_id = int(os.environ.get("CATN8_ALBUM_CREATED_BY_USER_ID", "1"))
    try:
        upload_albums(batches, args.album_title_prefix, created_by_user_id, args.disable_ai)
        print("Upload complete via direct MySQL connection.")
    except Exception as mysql_error:
        print(f"Direct MySQL failed ({mysql_error}); trying maintenance API fallback...")
        rows = build_album_rows(batches, args.album_title_prefix, args.disable_ai)
        sql_text = build_sql_for_album_rows(rows, created_by_user_id)
        upload_sql_via_maintenance_api(sql_text)
        print("Upload complete via maintenance API SQL restore.")


if __name__ == "__main__":
    main()
