#!/usr/bin/env python3
from __future__ import annotations

import argparse
import bisect
import calendar
import datetime as dt
import glob
import hashlib
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
    attachment_guid: str
    attachment_transfer_name: str
    attachment_total_bytes: int


@dataclass
class AlbumPage:
    sent_at: dt.datetime
    caption: str
    media_items: List[Tuple[str, str, str]]
    speaker_label: str = ""
    speaker_handle_id: str = ""


@dataclass
class GroupedMessage:
    message_id: int
    sent_at: dt.datetime
    is_from_me: int
    text: str
    attachments: List[Tuple[Optional[Path], str]]


@dataclass
class CatalogMessage:
    message_row_id: int
    sent_at: dt.datetime
    is_from_me: int
    handle_id: str
    message_text: str
    attachment_count: int
    image_attachment_count: int
    video_attachment_count: int


@dataclass
class CatalogMedia:
    media_id: int
    message_row_id: int
    attachment_name: str
    attachment_path: str
    media_kind: str
    captured_at: dt.datetime
    has_violet_face: int
    has_eleanor_face: int
    has_lyra_face: int


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Import iMessage/Photos memories into CATN8 photo_albums")
    p.add_argument("--mode", choices=["catalog_match", "attachment_match", "photos_timeline"], default="attachment_match")
    p.add_argument("--contact", default="Trinity")
    p.add_argument("--contacts-violet", default="Trinity,Ian")
    p.add_argument("--contacts-eleanor", default="Trinity,Ian")
    p.add_argument("--contacts-lyra", default="Elijah,Marisa")
    p.add_argument("--contacts-any", default="Trinity,Ian")
    p.add_argument("--years", type=int, default=4)
    p.add_argument("--photos-db", default="~/Pictures/Photos Library.photoslibrary/database/Photos.sqlite")
    p.add_argument("--messages-db", default="~/Library/Messages/chat.db")
    p.add_argument("--violet-face-id", type=int, default=None)
    p.add_argument("--eleanor-face-id", type=int, default=None)
    p.add_argument("--lyra-face-id", type=int, default=None)
    p.add_argument("--violet-birth-date", default="2021-11-29")
    p.add_argument("--eleanor-birth-date", default="2025-12-31")
    p.add_argument("--lyra-birth-date", default="2025-02-21")
    p.add_argument("--start-date", default="")
    p.add_argument("--end-date", default="")
    p.add_argument("--extra-window", action="append", default=[], help="Additional date window in YYYY-MM-DD:YYYY-MM-DD format (repeatable)")
    p.add_argument("--staging-dir", default="./photo_albums")
    p.add_argument("--album-title-prefix", default="Trinity Memories")
    p.add_argument("--min-pages", type=int, default=1)
    p.add_argument("--max-pages", type=int, default=0)
    p.add_argument("--target-pages", type=int, default=0)
    p.add_argument("--max-export-items", type=int, default=0, help="Maximum pages to export in photos_timeline mode (0 = unlimited)")
    p.add_argument("--max-media-per-day", type=int, default=0, help="Maximum media items per day/spread during aggregation (0 = unlimited)")
    p.add_argument("--import-source", default="")
    p.add_argument("--focus-person", choices=["auto", "any", "violet", "eleanor", "lyra", "all"], default="auto")
    p.add_argument("--run-all-children", action="store_true")
    p.add_argument("--match-window-hours", type=int, default=72)
    p.add_argument("--progress-every-messages", type=int, default=0)
    p.add_argument("--max-matched-media-per-message", type=int, default=8)
    p.add_argument("--rebuild-catalog", action="store_true")
    p.add_argument("--rematch-all", action="store_true")
    p.add_argument("--disable-ai", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--replace-existing-titles", action="store_true")
    p.add_argument("--lock-title", action="append", default=[], help="Album title to lock from importer overwrites (repeatable)")
    p.add_argument("--unlock-title", action="append", default=[], help="Album title to unlock for importer overwrites (repeatable)")
    p.add_argument(
        "--upload-mode",
        choices=["auto", "mysql", "maintenance_api"],
        default=os.environ.get("CATN8_IMPORT_UPLOAD_MODE", "auto").strip().lower() or "auto",
        help="Upload target for live albums: auto (try MySQL then fallback), mysql only, or maintenance_api only",
    )
    p.add_argument("--no-attachment-checkpoint", action="store_true", help="Disable resume checkpointing for attachment_match mode")
    return p.parse_args()


def parse_date_window(value: str) -> Tuple[dt.date, dt.date]:
    token = str(value or "").strip()
    if ":" not in token:
        raise ValueError(f"Invalid --extra-window '{token}'. Expected YYYY-MM-DD:YYYY-MM-DD")
    left, right = token.split(":", 1)
    start = parse_date(left)
    end = parse_date(right)
    if end < start:
        raise ValueError(f"Invalid --extra-window '{token}'. End date is before start date.")
    return start, end


def parse_contact_csv(value: str) -> List[str]:
    out: List[str] = []
    for part in str(value or "").split(","):
        token = part.strip()
        if token:
            out.append(token)
    return out


def supplemental_windows_for_focus(focus: str) -> List[Tuple[dt.date, dt.date]]:
    token = (focus or "").strip().lower()
    # Keep Violet's pre-birth first-month window in scope for rebuild/import runs.
    if token == "violet":
        return [(dt.date(2021, 11, 22), dt.date(2021, 11, 27))]
    return []


def merge_windows(base_windows: Sequence[Tuple[Optional[dt.date], Optional[dt.date]]], extras: Sequence[Tuple[dt.date, dt.date]]) -> List[Tuple[Optional[dt.date], Optional[dt.date]]]:
    merged: List[Tuple[Optional[dt.date], Optional[dt.date]]] = list(base_windows)
    for start_date, end_date in extras:
        pair = (start_date, end_date)
        if pair not in merged:
            merged.append(pair)
    return merged


def normalize_handle_for_lookup(value: str) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    digits = re.sub(r"\D+", "", raw)
    if digits:
        if len(digits) == 11 and digits.startswith("1"):
            digits = digits[1:]
        return digits
    return raw


def contacts_for_focus(args: argparse.Namespace, focus: str) -> List[str]:
    key = (focus or "any").strip().lower()
    if key == "violet":
        contacts = parse_contact_csv(args.contacts_violet)
    elif key == "eleanor":
        contacts = parse_contact_csv(args.contacts_eleanor)
    elif key == "lyra":
        contacts = parse_contact_csv(args.contacts_lyra)
    else:
        contacts = parse_contact_csv(args.contacts_any)
    if contacts:
        return contacts
    # Last-resort fallback for legacy behavior.
    return [str(args.contact or "").strip() or "Trinity"]


def is_noise_message_text(text: str) -> bool:
    t = str(text or "").strip()
    if not t:
        return True
    low = t.lower()
    if any(tok in low for tok in ("ns.rangeval", "$class", "streamtyped", "attachments referenced:")):
        return True
    if re.search(r"\breacted\b.+\bto\b", low):
        return True
    if re.match(r"^(liked|loved|laughed at|emphasized|questioned|disliked)\b", low):
        return True
    return False


def speaker_name_from_row(row: MessageRow, handle_name_map: Dict[str, str]) -> str:
    if int(row.is_from_me or 0) == 1:
        return "Papa"
    handle_key = normalize_handle_for_lookup(row.handle_id)
    if handle_key and handle_key in handle_name_map:
        return handle_name_map[handle_key]
    handle_raw = str(row.handle_id or "").lower()
    for token, label in (("ian", "Ian"), ("elijah", "Elijah"), ("marisa", "Marisa"), ("trinity", "Trinity")):
        if token in handle_raw:
            return label
    return "Contact"


def speaker_name_from_catalog_message(msg: CatalogMessage, handle_name_map: Dict[str, str]) -> str:
    if int(msg.is_from_me or 0) == 1:
        return "Papa"
    handle_key = normalize_handle_for_lookup(msg.handle_id)
    if handle_key and handle_key in handle_name_map:
        return handle_name_map[handle_key]
    handle_raw = str(msg.handle_id or "").lower()
    for token, label in (("ian", "Ian"), ("elijah", "Elijah"), ("marisa", "Marisa"), ("trinity", "Trinity")):
        if token in handle_raw:
            return label
    return "Contact"


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


def add_months(base: dt.date, months: int) -> dt.date:
    year = base.year + ((base.month - 1 + months) // 12)
    month = ((base.month - 1 + months) % 12) + 1
    day = min(base.day, calendar.monthrange(year, month)[1])
    return dt.date(year, month, day)


def ordinal(value: int) -> str:
    n = int(value)
    if 10 <= (n % 100) <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def normalize_focus_child_name(focus: str) -> str:
    token = str(focus or "").strip().lower()
    if token == "violet":
        return "Violet"
    if token == "eleanor":
        return "Eleanor"
    if token in {"lyra", "lyrielle"}:
        return "Lyrielle"
    return ""


def album_title_for_child_window(child_name: str, birth_date: dt.date, page_date: dt.date, prebirth_days: int = 7) -> str:
    idx = month_window_index_for_date(page_date, birth_date, prebirth_days=prebirth_days)
    if idx is None:
        return f"{child_name}'s Memories"
    if idx < 36:
        return f"{child_name}'s {ordinal(idx + 1)} Month"
    year_no = 3 + ((idx - 36) // 12)
    month = int(page_date.month)
    if month in (12, 1, 2):
        season = "Winter"
    elif month in (3, 4, 5):
        season = "Spring"
    elif month in (6, 7, 8):
        season = "Summer"
    else:
        season = "Fall"
    return f"{child_name}'s {ordinal(year_no)} Year - {season} {int(page_date.year)}"


def month_window_index_for_date(target: dt.date, birth_date: dt.date, prebirth_days: int = 7) -> Optional[int]:
    first_start = birth_date - dt.timedelta(days=max(0, int(prebirth_days)))
    if target < first_start:
        return None
    months = ((target.year - birth_date.year) * 12) + (target.month - birth_date.month)
    anchor = add_months(birth_date, months)
    if target < anchor:
        months -= 1
    if months <= 0:
        return 0
    return months


def build_birthday_month_batches(
    pages: Sequence[AlbumPage],
    birth_date: dt.date,
    min_pages: int,
    max_pages: int,
    target_pages: int,
    prebirth_days: int = 7,
) -> List[List[AlbumPage]]:
    per_group: Dict[str, List[AlbumPage]] = {}
    for page in sorted(pages, key=lambda p: p.sent_at):
        idx = month_window_index_for_date(page.sent_at.date(), birth_date, prebirth_days=prebirth_days)
        if idx is None:
            continue
        if idx < 36:
            group_key = f"month:{idx:03d}"
        else:
            year_no = 3 + ((idx - 36) // 12)
            month = int(page.sent_at.month)
            if month in (12, 1, 2):
                season = "winter"
                season_order = 0
            elif month in (3, 4, 5):
                season = "spring"
                season_order = 1
            elif month in (6, 7, 8):
                season = "summer"
                season_order = 2
            else:
                season = "fall"
                season_order = 3
            group_key = f"season:{year_no:03d}:{int(page.sent_at.year):04d}:{season_order:02d}:{season}"
        per_group.setdefault(group_key, []).append(page)

    batches: List[List[AlbumPage]] = []
    for group_key in sorted(per_group.keys()):
        grouped_pages = per_group[group_key]
        if not grouped_pages:
            continue
        sizes = chunk_sizes(len(grouped_pages), min_pages, max_pages, target_pages)
        offset = 0
        for size in sizes:
            batches.append(grouped_pages[offset: offset + size])
            offset += size
    return batches


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
    epoch = dt.datetime(2001, 1, 1, tzinfo=dt.timezone.utc)
    secs = raw / 1_000_000_000 if raw > 10_000_000_000 else float(raw)
    try:
        return (epoch + dt.timedelta(seconds=secs)).astimezone()
    except Exception:
        return None


def sanitize_message_text(value: str) -> str:
    v = (value or "").replace("\r", " ").replace("\n", " ").replace("\x00", " ").strip()
    if not v:
        return ""
    v = v.replace("\ufffc", " ")
    v = re.sub(r"\b(streamtyped|NSMutableAttributedString|NSAttributedString|NSObject|NSMutableString|NSString|NSDictionary|NSNumber|NSValue|NSMutableData|NSData)\b", " ", v)
    v = re.sub(r"\bkIM[A-Za-z0-9_]+\b", " ", v)
    v = re.sub(r"\biI\b", " ", v)
    v = re.split(r"\b(?:NSObject|NSDictionary|NSNumber|NSValue|kIM[A-Za-z0-9_]+)\b", v, maxsplit=1)[0]
    v = re.split(r"Z\$classname|DDScannerResult|NS\.objects", v, maxsplit=1)[0]
    v = re.sub(r"\s+[A-Za-z]?NSObject.*$", "", v)
    v = re.sub(r"^[0-9a-z><]+\s*(?=[A-Z])", "", v)
    v = re.sub(r"^[0-9]+[\"'`]+\s*(?=[A-Za-z])", "", v)
    v = re.sub(r"^[\);\:]+\s*(?=[A-Z])", "", v)
    v = re.sub(r"^[`~!@#$%^&*_=+|\\/:;\"',.?-]+\s*(?=[A-Za-z])", "", v)
    v = re.sub(r"^[A-Z](?=[A-Z][a-z])", "", v)
    v = re.sub(r"^[A-HJ-Z]\s+(?=[A-Z][a-z])", "", v)
    v = re.sub(r"^[A-HJ-Z]\s+(?=I\s+[a-z])", "", v)
    v = re.sub(r"^[A-Za-z](?=https?://)", "", v)
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
    segments: List[str] = []
    segments.extend(re.findall(r"NSString\s+(.+?)(?:\s+iI\s+NSDictionary|\s+NSDictionary|$)", decoded, flags=re.S))
    segments.extend(re.findall(r"\+[\x00-\x1f]*(.+?)(?:\x02iI|\x01iI|\siI\s|\x02\x0cNSDictionary|\x01\x0cNSDictionary|$)", decoded, flags=re.S))
    out: List[str] = []
    seen2: set[str] = set()
    for seg in segments:
        c = sanitize_message_text(re.sub(r"^[\x00-\x1f]+", "", seg))
        if c and c not in seen2:
            seen2.add(c)
            out.append(c)
    return " ".join(out[:8]).strip()


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


def find_face_id_by_name(named_faces: Sequence[FacePerson], aliases: Sequence[str]) -> Optional[int]:
    alias_tokens = [str(a).strip().lower() for a in aliases if str(a).strip()]
    best_id: Optional[int] = None
    best_count = -1
    for face in named_faces:
        name = str(face.name or "").strip().lower()
        if not name:
            continue
        if any(token in name for token in alias_tokens):
            if int(face.face_count) > best_count:
                best_count = int(face.face_count)
                best_id = int(face.person_id)
    return best_id


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


def load_messages(
    messages_db: Path,
    contact: str,
    years: int,
    contact_handles: Sequence[str],
    start_date: Optional[dt.date],
    end_date: Optional[dt.date],
    min_message_id: int = 0,
) -> List[MessageRow]:
    cutoff = start_date or (dt.datetime.now().astimezone().date() - dt.timedelta(days=years * 365))
    conn = sqlite_connect_readonly(messages_db)
    try:
        handles = [h.lower().strip() for h in contact_handles if h and h.strip()]
        if handles:
            ph = ",".join(["?"] * len(handles))
            params: List[Any] = list(handles + handles)
            message_id_filter = ""
            if min_message_id > 0:
                message_id_filter = " AND m.ROWID > ?"
                params.append(int(min_message_id))
            sql = f"""
            SELECT m.ROWID AS message_id, COALESCE(h.id,'') AS handle_id, COALESCE(m.text,'') AS text,
                   m.date AS msg_date, COALESCE(m.is_from_me,0) AS is_from_me,
                   m.attributedBody AS attributed_body,
                   COALESCE(a.filename,'') AS attachment_filename, COALESCE(a.mime_type,'') AS attachment_mime,
                   COALESCE(a.guid,'') AS attachment_guid, COALESCE(a.transfer_name,'') AS attachment_transfer_name,
                   COALESCE(a.total_bytes,0) AS attachment_total_bytes
            FROM message m
            LEFT JOIN handle h ON h.ROWID = m.handle_id
            LEFT JOIN message_attachment_join maj ON maj.message_id = m.ROWID
            LEFT JOIN attachment a ON a.ROWID = maj.attachment_id
            WHERE (
                   LOWER(COALESCE(h.id,'')) IN ({ph})
               OR  EXISTS (
                   SELECT 1 FROM chat_message_join cmj
                   INNER JOIN chat_handle_join chj ON chj.chat_id = cmj.chat_id
                   INNER JOIN handle hh ON hh.ROWID = chj.handle_id
                   WHERE cmj.message_id = m.ROWID AND LOWER(COALESCE(hh.id,'')) IN ({ph})
               )
            )
              {message_id_filter}
            ORDER BY m.date ASC, m.ROWID ASC
            """
            rows = conn.execute(sql, tuple(params)).fetchall()
        else:
            params2: List[Any] = [f"%{contact.lower()}%"]
            message_id_filter = ""
            if min_message_id > 0:
                message_id_filter = " AND m.ROWID > ?"
                params2.append(int(min_message_id))
            rows = conn.execute(
                f"""
                SELECT m.ROWID AS message_id, COALESCE(h.id,'') AS handle_id, COALESCE(m.text,'') AS text,
                       m.date AS msg_date, COALESCE(m.is_from_me,0) AS is_from_me,
                       m.attributedBody AS attributed_body,
                       COALESCE(a.filename,'') AS attachment_filename, COALESCE(a.mime_type,'') AS attachment_mime,
                       COALESCE(a.guid,'') AS attachment_guid, COALESCE(a.transfer_name,'') AS attachment_transfer_name,
                       COALESCE(a.total_bytes,0) AS attachment_total_bytes
                FROM message m
                LEFT JOIN handle h ON h.ROWID = m.handle_id
                LEFT JOIN message_attachment_join maj ON maj.message_id = m.ROWID
                LEFT JOIN attachment a ON a.ROWID = maj.attachment_id
                WHERE LOWER(COALESCE(h.id,'')) LIKE ?
                  {message_id_filter}
                ORDER BY m.date ASC, m.ROWID ASC
                """,
                tuple(params2),
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
                attachment_guid=str(r["attachment_guid"] or "").strip(),
                attachment_transfer_name=str(r["attachment_transfer_name"] or "").strip(),
                attachment_total_bytes=int(r["attachment_total_bytes"] or 0),
            )
        )
    return out


def load_messages_for_windows(
    messages_db: Path,
    contact: str,
    years: int,
    contact_handles: Sequence[str],
    windows: Sequence[Tuple[Optional[dt.date], Optional[dt.date]]],
    min_message_id: int = 0,
) -> List[MessageRow]:
    all_rows: List[MessageRow] = []
    seen: set[Tuple[int, str, str, str]] = set()
    for idx, (start_date, end_date) in enumerate(windows):
        # Resume mode should never fall back to scanning from zero.
        # Apply checkpoint filter to every window unless caller explicitly passes 0.
        window_min_message_id = int(min_message_id)
        rows = load_messages(
            messages_db,
            contact,
            years,
            contact_handles,
            start_date,
            end_date,
            min_message_id=window_min_message_id,
        )
        for row in rows:
            key = (
                int(row.message_id),
                str(row.attachment_guid or ""),
                str(row.attachment_transfer_name or ""),
                str(row.attachment_path or ""),
            )
            if key in seen:
                continue
            seen.add(key)
            all_rows.append(row)
    all_rows.sort(key=lambda r: (r.sent_at, int(r.message_id), str(r.attachment_guid or ""), str(r.attachment_transfer_name or ""), str(r.attachment_path or "")))
    return all_rows


def is_image_path(path: Optional[Path], mime: str) -> bool:
    if path is None:
        return False
    if path.suffix.lower() in {".heic", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}:
        return True
    return mime.lower().startswith("image/")


def is_image_binary(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            header = f.read(64)
    except Exception:
        return False
    if len(header) < 12:
        return False
    if header.startswith(b"\xFF\xD8\xFF"):  # JPEG
        return True
    if header.startswith(b"\x89PNG\r\n\x1a\n"):  # PNG
        return True
    if header.startswith((b"GIF87a", b"GIF89a")):
        return True
    if header[:4] in {b"II*\x00", b"MM\x00*"}:  # TIFF
        return True
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return True
    if header[4:8] == b"ftyp" and header[8:12] in {b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1", b"avif"}:
        return True
    return False


def build_rich_caption(messages: Sequence[MessageRow], index: int, handle_name_map: Dict[str, str]) -> str:
    focal = messages[index]
    text = sanitize_message_text(str(focal.text or "").strip())
    if is_noise_message_text(text):
        return "(no caption)"
    speaker = speaker_name_from_row(focal, handle_name_map)
    stamp = focal.sent_at.strftime("%I:%M %p").lstrip("0")
    return f"{speaker} ({stamp}): {text}"


def build_contextual_caption(
    messages: Sequence[MessageRow],
    index: int,
    handle_name_map: Dict[str, str],
    max_lines: int = 4,
    max_hours: int = 36,
) -> str:
    focal = messages[index]
    center = focal.sent_at
    lines: List[str] = []
    seen: set[str] = set()

    # Gather nearest meaningful lines around the attachment when the focal row has no text.
    radius = min(len(messages), 60)
    for step in range(1, radius + 1):
        for j in (index - step, index + step):
            if j < 0 or j >= len(messages):
                continue
            row = messages[j]
            if abs((row.sent_at - center).total_seconds()) > max_hours * 3600:
                continue
            text = sanitize_message_text(str(row.text or "").strip())
            if is_noise_message_text(text):
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            speaker = speaker_name_from_row(row, handle_name_map)
            stamp = row.sent_at.strftime("%I:%M %p").lstrip("0")
            lines.append(f"{speaker} ({stamp}): {text}")
            if len(lines) >= max_lines:
                return "\n".join(lines)
    return "(no caption)"


def group_messages_by_id(messages: Sequence[MessageRow]) -> List[GroupedMessage]:
    grouped: Dict[int, GroupedMessage] = {}
    for row in messages:
        mid = int(row.message_id)
        gm = grouped.get(mid)
        if gm is None:
            gm = GroupedMessage(
                message_id=mid,
                sent_at=row.sent_at,
                is_from_me=int(row.is_from_me or 0),
                text=str(row.text or "").strip(),
                attachments=[],
            )
            grouped[mid] = gm
        if row.sent_at < gm.sent_at:
            gm.sent_at = row.sent_at
        if not gm.text and str(row.text or "").strip():
            gm.text = str(row.text or "").strip()
        ap = row.attachment_path
        mime = str(row.attachment_mime or "").strip().lower()
        key = (str(ap or ""), mime)
        if str(key[0]).strip() and key not in {(str(x[0] or ""), x[1]) for x in gm.attachments}:
            gm.attachments.append((ap, mime))
    return sorted(grouped.values(), key=lambda m: (m.sent_at, m.message_id))


def build_grouped_message_caption(msg: GroupedMessage) -> str:
    speaker = "Papa" if int(msg.is_from_me or 0) else "Contact"
    stamp = msg.sent_at.strftime("%I:%M %p").lstrip("0")
    text = str(msg.text or "").strip() or "(no caption)"
    image_count = 0
    video_count = 0
    for ap, mime in msg.attachments:
        kind = media_kind_from_attachment(ap, mime)
        if kind == "image":
            image_count += 1
        elif kind == "video":
            video_count += 1
    return f"{speaker} ({stamp}): {text}"


def aggregate_album_pages_by_day(pages: Sequence[AlbumPage], max_media_per_day: int = 0) -> List[AlbumPage]:
    buckets: Dict[dt.date, Dict[str, Any]] = {}
    for page in pages:
        day = page.sent_at.date()
        bucket = buckets.get(day)
        if bucket is None:
            bucket = {"sent_at": page.sent_at, "captions": [], "media_items": [], "media_keys": set()}
            buckets[day] = bucket
        if page.sent_at < bucket["sent_at"]:
            bucket["sent_at"] = page.sent_at
        raw_lines = str(page.caption or "").splitlines()
        if not raw_lines:
            raw_lines = [str(page.caption or "")]
        for raw_line in raw_lines:
            c = sanitize_message_text(raw_line)
            if not c or is_noise_message_text(c):
                continue
            if c not in bucket["captions"]:
                bucket["captions"].append(c)
        for rel_path, source_name, media_kind in page.media_items:
            key = (rel_path, source_name, media_kind)
            if key in bucket["media_keys"]:
                continue
            bucket["media_keys"].add(key)
            bucket["media_items"].append((rel_path, source_name, media_kind))

    out: List[AlbumPage] = []
    seen_lines: set[str] = set()
    for day in sorted(buckets.keys()):
        bucket = buckets[day]
        unique_captions: List[str] = []
        for line in bucket["captions"]:
            k = sanitize_message_text(line).lower()
            if not k or k in seen_lines:
                continue
            seen_lines.add(k)
            unique_captions.append(line)
            if len(unique_captions) >= 12:
                break
        caption = "\n".join(unique_captions).strip() or "(no caption)"
        media_items_all = list(bucket["media_items"])
        media_items = media_items_all if int(max_media_per_day) <= 0 else media_items_all[:max_media_per_day]
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


def photos_export_by_filename_nearest_date(filename: str, target_dt: dt.datetime, out_dir: Path) -> Optional[Path]:
    if not filename:
        return None
    out_dir.mkdir(parents=True, exist_ok=True)
    target = filename.replace('"', '')
    out_dir_escaped = str(out_dir).replace('"', '\\"')
    target_ts = int(target_dt.timestamp())
    generic_names = {"fullsizerender.heic", "image.heic", "image.jpg", "image.jpeg", "image.png", "video.mov", "video.mp4"}
    is_generic = target.strip().lower() in generic_names
    window_seconds = 3 * 24 * 3600
    script = f'''
    set outFolder to POSIX file "{out_dir_escaped}"
    set epochDate to date "January 1, 1970 00:00:00"
    set targetDate to epochDate + {target_ts}
    set lowerBound to targetDate - {window_seconds}
    set upperBound to targetDate + {window_seconds}
    tell application "Photos"
      if {"true" if is_generic else "false"} then
        set matches to every media item whose date ≥ lowerBound and date ≤ upperBound
      else
        set matches to every media item whose filename is "{target}" and date ≥ lowerBound and date ≤ upperBound
        if (count of matches) is 0 then
          set matches to every media item whose filename is "{target}"
        end if
      end if
      if (count of matches) is 0 then
        return ""
      end if
      set bestItem to item 1 of matches
      set bestDelta to 999999999
      repeat with m in matches
        try
          set d to date of m
          set delta to d - targetDate
          if delta < 0 then
            set delta to delta * -1
          end if
          if delta < bestDelta then
            set bestDelta to delta
            set bestItem to m
          end if
        end try
      end repeat
      export {{bestItem}} to outFolder with using originals
    end tell
    '''
    try:
        proc = subprocess.run(
            ["osascript", "-e", script],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=45,
        )
    except subprocess.TimeoutExpired:
        return None
    if proc.returncode != 0:
        return None
    low = filename.lower()
    candidates = sorted(
        [p for p in out_dir.iterdir() if p.is_file() and (p.name.lower() == low or p.name.lower().startswith(Path(filename).stem.lower()))],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def photos_export_by_asset_id(asset_uuid: str, out_dir: Path) -> Optional[Path]:
    asset_uuid = str(asset_uuid or "").strip()
    if not asset_uuid:
        return None
    out_dir.mkdir(parents=True, exist_ok=True)
    out_dir_escaped = str(out_dir).replace('"', '\\"')
    # Photos media-item ids are typically "<UUID>/L0/001".
    item_id = f"{asset_uuid}/L0/001"
    script = f'''
    set outFolder to POSIX file "{out_dir_escaped}"
    tell application "Photos"
      set matches to every media item whose id is "{item_id}"
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
    # Most reliable post-export lookup: prefix on UUID.
    candidates = sorted(
        [p for p in out_dir.iterdir() if p.is_file() and p.name.upper().startswith(asset_uuid.upper())],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if candidates:
        return candidates[0]
    return None


def photos_library_root_from_db(photos_db: Path) -> Path:
    resolved = photos_db.resolve()
    if resolved.name.lower() == "photos.sqlite" and resolved.parent.name.lower() == "database":
        return resolved.parent.parent
    return resolved.parent


def photos_find_derivative_by_asset_uuid(photos_db: Path, asset_uuid: str) -> Optional[Path]:
    uuid = str(asset_uuid or "").strip().upper()
    if not uuid:
        return None
    cache_key = f"{photos_db.resolve()}::{uuid}"
    if cache_key in _PHOTOS_UUID_PATH_CACHE:
        return _PHOTOS_UUID_PATH_CACHE[cache_key]

    root = photos_library_root_from_db(photos_db)
    candidate_bases = [
        root / "scopes" / "syndication" / "resources" / "derivatives" / "masters",
        root / "resources" / "derivatives" / "masters",
    ]
    for base in candidate_bases:
        if not base.exists():
            continue
        for path in sorted(base.glob(f"*/{uuid}_*")):
            if path.is_file():
                _PHOTOS_UUID_PATH_CACHE[cache_key] = path
                return path

    _PHOTOS_UUID_PATH_CACHE[cache_key] = None
    return None


def convert_to_png(source_path: Path, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        return
    if source_path.suffix.lower() == ".png":
        if not out_path.exists():
            shutil.copy2(source_path, out_path)
        return
    proc = subprocess.run(["sips", "-s", "format", "png", str(source_path), "--out", str(out_path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"sips conversion failed: {source_path} :: {proc.stderr.strip()}")


def media_kind_from_attachment(path: Optional[Path], mime: str) -> str:
    suffix = path.suffix.lower() if path is not None else ""
    mime_l = (mime or "").strip().lower()
    if mime_l.startswith("image/") or suffix in {".heic", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}:
        return "image"
    if mime_l.startswith("video/") or suffix in {".mov", ".mp4", ".m4v", ".3gp", ".avi", ".mkv", ".webm"}:
        return "video"
    return "other"


def album_media_kind_from_paths(rel_path: str, source_name: str) -> str:
    token = f"{rel_path} {source_name}".lower()
    if re.search(r"\.(mov|mp4|m4v|3gp|avi|mkv|webm)(\s|$)", token):
        return "video"
    return "image"


def copy_media_to_staging(source_path: Path, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        return
    shutil.copy2(source_path, out_path)


def sanitize_filename_token(value: str, fallback: str = "media", max_len: int = 40) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return fallback
    token = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    if not token:
        token = fallback
    return token[:max_len]


def build_timestamped_output_name(
    sent_at: dt.datetime,
    source_name: str,
    extension: str,
    used_names: set[str],
    kind_hint: str = "",
) -> str:
    stamp = sent_at.strftime("%Y%m%d_%H%M%S")
    core = stamp
    ext = extension if extension.startswith(".") else f".{extension}"
    candidate = f"{core}{ext}"
    n = 2
    while candidate in used_names:
        candidate = f"{core}_{n:02d}{ext}"
        n += 1
    used_names.add(candidate)
    return candidate


_CAPTURE_TS_CACHE: Dict[str, dt.datetime] = {}
_FILE_HASH_CACHE: Dict[str, Tuple[int, int, str]] = {}
_PHOTOS_UUID_PATH_CACHE: Dict[str, Optional[Path]] = {}
_MESSAGE_ATTACHMENT_DIR_CACHE: Dict[str, Optional[Path]] = {}
_PHOTOS_FILENAME_CANDIDATE_CACHE: Dict[str, List[Tuple[str, Optional[dt.datetime], int]]] = {}


def parse_exif_datetime(raw: str) -> Optional[dt.datetime]:
    value = str(raw or "").strip()
    if not value:
        return None
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return dt.datetime.strptime(value[:19], fmt)
        except Exception:
            continue
    return None


def extract_uuid_candidates(value: str) -> List[str]:
    matches = re.findall(r"\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b", str(value or ""))
    seen: set[str] = set()
    out: List[str] = []
    for m in matches:
        token = m.upper()
        if token in seen:
            continue
        seen.add(token)
        out.append(token)
    return out


def find_message_attachment_file_from_guid(attachment_guid: str, transfer_name: str) -> Optional[Path]:
    guid_token = str(attachment_guid or "").strip().split("/")[-1]
    if not guid_token:
        return None
    if guid_token in _MESSAGE_ATTACHMENT_DIR_CACHE:
        base_dir = _MESSAGE_ATTACHMENT_DIR_CACHE[guid_token]
    else:
        root = Path("~/Library/Messages/Attachments").expanduser()
        matches = list(root.glob(f"*/*/{guid_token}"))
        base_dir = matches[0].resolve() if matches else None
        _MESSAGE_ATTACHMENT_DIR_CACHE[guid_token] = base_dir
    if base_dir is None or not base_dir.exists() or not base_dir.is_dir():
        return None

    transfer = str(transfer_name or "").strip()
    if transfer:
        candidate = base_dir / transfer
        if candidate.exists() and candidate.is_file():
            return candidate.resolve()

    for path in sorted(base_dir.iterdir()):
        if path.is_file() and (is_image_path(path, "") or is_image_binary(path)):
            return path.resolve()
    return None


def photos_candidates_for_transfer_name(photos_db: Path, transfer_name: str) -> List[Tuple[str, Optional[dt.datetime], int]]:
    name = Path(str(transfer_name or "").strip()).name.strip().lower()
    if not name:
        return []
    if name in _PHOTOS_FILENAME_CANDIDATE_CACHE:
        return _PHOTOS_FILENAME_CANDIDATE_CACHE[name]

    conn = sqlite_connect_readonly(photos_db)
    try:
        rows = conn.execute(
            """
            SELECT COALESCE(a.ZUUID,'') AS asset_uuid,
                   a.ZDATECREATED AS date_created,
                   COALESCE(aa.ZORIGINALFILESIZE,0) AS original_file_size
            FROM ZASSET a
            LEFT JOIN ZADDITIONALASSETATTRIBUTES aa ON aa.ZASSET = a.Z_PK
            WHERE LOWER(COALESCE(aa.ZORIGINALFILENAME,'')) = ?
               OR LOWER(COALESCE(a.ZFILENAME,'')) = ?
            ORDER BY a.ZDATECREATED ASC
            """,
            (name, name),
        ).fetchall()
    except Exception:
        rows = []
    finally:
        conn.close()

    out: List[Tuple[str, Optional[dt.datetime], int]] = []
    for r in rows:
        uuid = str(r["asset_uuid"] or "").strip()
        if not uuid:
            continue
        out.append((uuid, apple_ts_to_datetime(r["date_created"]), int(r["original_file_size"] or 0)))
    _PHOTOS_FILENAME_CANDIDATE_CACHE[name] = out
    return out


def photos_find_by_transfer_name_nearest_date(
    photos_db: Path,
    transfer_name: str,
    sent_at: dt.datetime,
    attachment_total_bytes: int = 0,
    max_date_drift_days: float = 7.0,
) -> Optional[Path]:
    candidates = photos_candidates_for_transfer_name(photos_db, transfer_name)
    if not candidates:
        return None

    total_bytes = max(0, int(attachment_total_bytes or 0))

    def sort_key(item: Tuple[str, Optional[dt.datetime], int]) -> Tuple[int, int, float]:
        _uuid, created_at, original_file_size = item
        size_match_rank = 1
        size_delta = 10**12
        if total_bytes > 0 and int(original_file_size or 0) > 0:
            size_delta = abs(int(original_file_size) - total_bytes)
            size_match_rank = 0 if size_delta == 0 else 1
        if created_at is None:
            return (size_match_rank, size_delta, 1e18)
        return (size_match_rank, size_delta, abs((created_at - sent_at).total_seconds()))

    for asset_uuid, created_at, _original_file_size in sorted(candidates, key=sort_key):
        if created_at is not None and max_date_drift_days > 0:
            drift_days = abs((created_at - sent_at).total_seconds()) / 86400.0
            if drift_days > float(max_date_drift_days):
                continue
        located = photos_find_derivative_by_asset_uuid(photos_db, asset_uuid)
        if located and located.exists():
            return located
    return None


def resolve_message_media_source(msg: MessageRow, photos_db: Path) -> Optional[Path]:
    ap = msg.attachment_path
    if ap is not None and ap.exists() and media_kind_from_attachment(ap, msg.attachment_mime) in {"image", "video"}:
        return ap

    recovered = find_message_attachment_file_from_guid(msg.attachment_guid, msg.attachment_transfer_name)
    if recovered is not None and recovered.exists() and media_kind_from_attachment(recovered, msg.attachment_mime) in {"image", "video"}:
        return recovered

    uuid_candidates: List[str] = []
    if ap is not None:
        uuid_candidates.extend(extract_uuid_candidates(str(ap)))
        uuid_candidates.extend(extract_uuid_candidates(ap.name))
    uuid_candidates.extend(extract_uuid_candidates(msg.text or ""))
    if uuid_candidates:
        for asset_uuid in uuid_candidates:
            located = photos_find_derivative_by_asset_uuid(photos_db, asset_uuid)
            if located and located.exists() and media_kind_from_attachment(located, msg.attachment_mime) in {"image", "video"}:
                return located

    if msg.attachment_transfer_name:
        located = photos_find_by_transfer_name_nearest_date(
            photos_db,
            msg.attachment_transfer_name,
            msg.sent_at,
            attachment_total_bytes=msg.attachment_total_bytes,
            max_date_drift_days=7.0,
        )
        if located and located.exists() and media_kind_from_attachment(located, msg.attachment_mime) in {"image", "video"}:
            return located
    return None


def media_capture_datetime(source_path: Path, fallback: dt.datetime) -> dt.datetime:
    try:
        st = source_path.stat()
        cache_key = f"{source_path.resolve()}::{int(st.st_size)}::{int(st.st_mtime)}"
    except Exception:
        cache_key = str(source_path)
    if cache_key in _CAPTURE_TS_CACHE:
        return _CAPTURE_TS_CACHE[cache_key]

    tags = ["DateTimeOriginal", "CreateDate", "MediaCreateDate", "TrackCreateDate", "QuickTime:CreateDate"]
    for tag in tags:
        try:
            proc = subprocess.run(
                ["exiftool", "-s", "-s", "-s", f"-{tag}", str(source_path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=10,
            )
        except Exception:
            proc = None
        if proc and proc.returncode == 0:
            parsed = parse_exif_datetime(proc.stdout)
            if parsed:
                _CAPTURE_TS_CACHE[cache_key] = parsed
                return parsed

    # mdls fallback for files that lack Exif/QuickTime date tags
    try:
        proc2 = subprocess.run(
            ["mdls", "-raw", "-name", "kMDItemContentCreationDate", str(source_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=5,
        )
        if proc2.returncode == 0:
            raw = str(proc2.stdout or "").strip()
            if raw and raw not in {"(null)", "null"}:
                parsed = parse_exif_datetime(raw.replace(" +0000", ""))
                if parsed:
                    _CAPTURE_TS_CACHE[cache_key] = parsed
                    return parsed
    except Exception:
        pass

    _CAPTURE_TS_CACHE[cache_key] = fallback
    return fallback


def file_sha256(path: Path) -> str:
    resolved = path.resolve()
    st = resolved.stat()
    cache_key = str(resolved)
    cached = _FILE_HASH_CACHE.get(cache_key)
    if cached and cached[0] == int(st.st_size) and cached[1] == int(st.st_mtime_ns):
        return cached[2]
    h = hashlib.sha256()
    with resolved.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            if not chunk:
                break
            h.update(chunk)
    digest = h.hexdigest()
    _FILE_HASH_CACHE[cache_key] = (int(st.st_size), int(st.st_mtime_ns), digest)
    return digest


def build_staging_hash_index(staging_dir: Path) -> Dict[str, str]:
    index: Dict[str, str] = {}
    if not staging_dir.exists():
        return index
    for path in sorted((p for p in staging_dir.iterdir() if p.is_file()), key=lambda p: p.name):
        try:
            digest = file_sha256(path)
        except Exception:
            continue
        index.setdefault(digest, path.name)
    return index


def media_has_focus_face(media: CatalogMedia, focus_person: str) -> bool:
    focus = (focus_person or "").strip().lower()
    if focus == "violet":
        return int(media.has_violet_face or 0) == 1
    if focus == "eleanor":
        return int(media.has_eleanor_face or 0) == 1
    if focus == "lyra":
        return int(media.has_lyra_face or 0) == 1
    return False


def resolve_focus_person(focus_person: str, album_title_prefix: str) -> str:
    focus = (focus_person or "auto").strip().lower()
    if focus in {"violet", "eleanor", "lyra", "any", "all"}:
        return focus
    title = (album_title_prefix or "").strip().lower()
    if "violet" in title:
        return "violet"
    if "eleanor" in title:
        return "eleanor"
    if "lyra" in title or "lyrielle" in title:
        return "lyra"
    return "any"


def build_import_source_key(args: argparse.Namespace, focus: str) -> str:
    if str(args.import_source or "").strip():
        return str(args.import_source).strip()[:180]
    contact = re.sub(r"[^a-z0-9]+", "-", str(args.contact or "contact").strip().lower()).strip("-") or "contact"
    return f"imessage-{contact}-{focus}"[:180]


def source_key_for_focus(args: argparse.Namespace, focus: str) -> str:
    base = build_import_source_key(args, focus)
    if str(args.import_source or "").strip() and focus != resolve_focus_person(args.focus_person, args.album_title_prefix):
        return f"{base}-{focus}"[:180]
    return base


def state_file_token(source_key: str) -> str:
    return re.sub(r"[^a-z0-9._-]+", "-", str(source_key or "import").strip().lower())[:180] or "import"


def timeline_state_path(source_key: str) -> Path:
    state_dir = Path(".local/state")
    state_dir.mkdir(parents=True, exist_ok=True)
    return state_dir / f"photos_timeline_state_{state_file_token(source_key)}.json"


def attachment_checkpoint_path(source_key: str) -> Path:
    state_dir = Path(".local/state")
    state_dir.mkdir(parents=True, exist_ok=True)
    return state_dir / f"attachment_match_checkpoint_{state_file_token(source_key)}.json"


def load_attachment_checkpoint(checkpoint_path: Path) -> Dict[str, Any]:
    if not checkpoint_path.exists():
        return {}
    try:
        raw = json.loads(checkpoint_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if not isinstance(raw, dict):
        return {}
    return raw


def save_attachment_checkpoint(checkpoint_path: Path, source_key: str, focus_person: str, last_message_id: int) -> None:
    payload = {
        "source_key": str(source_key or ""),
        "focus_person": str(focus_person or ""),
        "last_message_id": max(0, int(last_message_id)),
        "updated_at": dt.datetime.now().isoformat(),
    }
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    checkpoint_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2, sort_keys=True), encoding="utf-8")


def timeline_progress_snapshot_path(source_key: str) -> Path:
    state_dir = Path(".local/state")
    state_dir.mkdir(parents=True, exist_ok=True)
    return state_dir / f"photos_timeline_progress_{state_file_token(source_key)}.json"


def timeline_progress_history_path(source_key: str) -> Path:
    state_dir = Path(".local/state")
    state_dir.mkdir(parents=True, exist_ok=True)
    return state_dir / f"photos_timeline_progress_{state_file_token(source_key)}.ndjson"


def write_timeline_progress(
    source_key: str,
    payload: Dict[str, Any],
    append_history: bool = True,
) -> None:
    snapshot_path = timeline_progress_snapshot_path(source_key)
    history_path = timeline_progress_history_path(source_key)
    body = dict(payload)
    body["updated_at"] = dt.datetime.now().isoformat()
    tmp_path = snapshot_path.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(body, ensure_ascii=True, indent=2, sort_keys=True), encoding="utf-8")
    tmp_path.replace(snapshot_path)
    if append_history:
        with history_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(body, ensure_ascii=True, sort_keys=True))
            fh.write("\n")


def load_timeline_state(state_path: Path) -> Dict[str, Any]:
    if not state_path.exists():
        return {}
    try:
        raw = json.loads(state_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if not isinstance(raw, dict):
        return {}
    return raw


def save_timeline_state(state_path: Path, state: Dict[str, Any]) -> None:
    state["updated_at"] = dt.datetime.now().isoformat()
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, ensure_ascii=True, indent=2, sort_keys=True), encoding="utf-8")


def normalize_timeline_state(
    state: Dict[str, Any],
    source_key: str,
    focus_person: str,
    start_date: dt.date,
    end_date: Optional[dt.date],
    staging_dir: Path,
    reset: bool,
) -> Dict[str, Any]:
    expected = {
        "state_version": 1,
        "source_key": source_key,
        "focus_person": focus_person,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat() if end_date else "",
    }
    if reset or not state:
        state = {}
    elif (
        state.get("state_version") != expected["state_version"]
        or str(state.get("source_key") or "") != expected["source_key"]
        or str(state.get("focus_person") or "") != expected["focus_person"]
        or str(state.get("start_date") or "") != expected["start_date"]
        or str(state.get("end_date") or "") != expected["end_date"]
    ):
        state = {}

    merged: Dict[str, Any] = dict(expected)
    merged["created_at"] = str(state.get("created_at") or dt.datetime.now().isoformat())
    merged["last_processed_message_id"] = int(state.get("last_processed_message_id") or 0)
    merged["used_asset_ids"] = [int(x) for x in state.get("used_asset_ids", []) if str(x).strip().isdigit()]
    merged["failed_asset_ids"] = [int(x) for x in state.get("failed_asset_ids", []) if str(x).strip().isdigit()]
    merged["failed_export_keys"] = [str(x) for x in state.get("failed_export_keys", []) if str(x).strip()]

    staged_by_asset_id: Dict[str, str] = {}
    for k, v in dict(state.get("staged_media_by_asset_id", {})).items():
        name = str(v or "").strip()
        if not name:
            continue
        if (staging_dir / name).exists():
            staged_by_asset_id[str(int(k)) if str(k).isdigit() else str(k)] = name
    merged["staged_media_by_asset_id"] = staged_by_asset_id

    staged_by_attachment_path: Dict[str, str] = {}
    for k, v in dict(state.get("staged_media_by_attachment_path", {})).items():
        src = str(k or "").strip()
        name = str(v or "").strip()
        if not src or not name:
            continue
        if (staging_dir / name).exists():
            staged_by_attachment_path[src] = name
    merged["staged_media_by_attachment_path"] = staged_by_attachment_path
    return merged


def filter_assets_for_focus(assets: Sequence[PhotoAsset], focus_person: str, violet_id: int, eleanor_id: int, lyra_id: int) -> List[PhotoAsset]:
    focus = (focus_person or "").strip().lower()
    if focus == "violet":
        return [asset for asset in assets if int(violet_id) in asset.person_ids]
    if focus == "eleanor":
        return [asset for asset in assets if int(eleanor_id) in asset.person_ids]
    if focus == "lyra":
        if int(lyra_id) <= 0:
            return []
        return [asset for asset in assets if int(lyra_id) in asset.person_ids]
    return list(assets)


def ensure_album_import_tables(cur) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS photo_album_import_checkpoints (
      source_key VARCHAR(191) PRIMARY KEY,
      last_message_id BIGINT NOT NULL DEFAULT 0,
      last_matched_message_id BIGINT NOT NULL DEFAULT 0,
      last_run_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS photo_album_message_catalog (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      source_key VARCHAR(191) NOT NULL,
      message_row_id BIGINT NOT NULL,
      handle_id VARCHAR(191) NOT NULL DEFAULT '',
      is_from_me TINYINT(1) NOT NULL DEFAULT 0,
      sent_at DATETIME NOT NULL,
      message_text TEXT NOT NULL,
      attachment_count INT NOT NULL DEFAULT 0,
      image_attachment_count INT NOT NULL DEFAULT 0,
      video_attachment_count INT NOT NULL DEFAULT 0,
      is_matched TINYINT(1) NOT NULL DEFAULT 0,
      matched_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_source_message (source_key, message_row_id),
      KEY idx_message_source_sent (source_key, sent_at),
      KEY idx_message_source_match (source_key, is_matched, message_row_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS photo_album_media_catalog (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      source_key VARCHAR(191) NOT NULL,
      message_row_id BIGINT NOT NULL,
      attachment_index INT NOT NULL,
      attachment_name VARCHAR(255) NOT NULL DEFAULT '',
      attachment_path TEXT NOT NULL,
      mime_type VARCHAR(191) NOT NULL DEFAULT '',
      media_kind VARCHAR(16) NOT NULL DEFAULT 'other',
      captured_at DATETIME NOT NULL,
      file_exists TINYINT(1) NOT NULL DEFAULT 0,
      has_violet_face TINYINT(1) NOT NULL DEFAULT 0,
      has_eleanor_face TINYINT(1) NOT NULL DEFAULT 0,
      has_lyra_face TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_source_media_attachment (source_key, message_row_id, attachment_index),
      KEY idx_media_source_time (source_key, captured_at),
      KEY idx_media_source_kind (source_key, media_kind, file_exists),
      KEY idx_media_source_violet (source_key, has_violet_face, captured_at),
      KEY idx_media_source_eleanor (source_key, has_eleanor_face, captured_at),
      KEY idx_media_source_lyra (source_key, has_lyra_face, captured_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS photo_album_message_media_matches (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      source_key VARCHAR(191) NOT NULL,
      message_row_id BIGINT NOT NULL,
      media_id BIGINT NOT NULL,
      rank_order INT NOT NULL,
      score DECIMAL(9,3) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_source_msg_media (source_key, message_row_id, media_id),
      UNIQUE KEY uniq_source_msg_rank (source_key, message_row_id, rank_order),
      KEY idx_match_source_msg (source_key, message_row_id),
      KEY idx_match_source_media (source_key, media_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)


def checkpoint_get(cur, source_key: str) -> Dict[str, int]:
    cur.execute(
        "SELECT last_message_id, last_matched_message_id FROM photo_album_import_checkpoints WHERE source_key=%s LIMIT 1",
        (source_key,),
    )
    row = cur.fetchone() or {}
    return {
        "last_message_id": int(row.get("last_message_id") or 0),
        "last_matched_message_id": int(row.get("last_matched_message_id") or 0),
    }


def checkpoint_upsert(cur, source_key: str, last_message_id: int, last_matched_message_id: int) -> None:
    cur.execute(
        """
        INSERT INTO photo_album_import_checkpoints (source_key, last_message_id, last_matched_message_id, last_run_at)
        VALUES (%s,%s,%s,NOW())
        ON DUPLICATE KEY UPDATE
          last_message_id = GREATEST(last_message_id, VALUES(last_message_id)),
          last_matched_message_id = GREATEST(last_matched_message_id, VALUES(last_matched_message_id)),
          last_run_at = NOW()
        """,
        (source_key, int(last_message_id), int(last_matched_message_id)),
    )


def build_face_filename_sets(assets: Sequence[PhotoAsset], violet_id: int, eleanor_id: int, lyra_id: int) -> Tuple[set[str], set[str], set[str]]:
    violet_names: set[str] = set()
    eleanor_names: set[str] = set()
    lyra_names: set[str] = set()
    for asset in assets:
        names = [str(asset.filename or "").strip(), str(asset.original_filename or "").strip()]
        keys: List[str] = []
        for name in names:
            if not name:
                continue
            keys.append(name.lower())
            keys.append(Path(name).stem.lower())
        if violet_id in asset.person_ids:
            violet_names.update(x for x in keys if x)
        if eleanor_id in asset.person_ids:
            eleanor_names.update(x for x in keys if x)
        if lyra_id > 0 and lyra_id in asset.person_ids:
            lyra_names.update(x for x in keys if x)
    return violet_names, eleanor_names, lyra_names


def ingest_messages_into_catalog(
    cur,
    source_key: str,
    messages: Sequence[MessageRow],
    violet_face_names: set[str],
    eleanor_face_names: set[str],
    lyra_face_names: set[str],
    rebuild_catalog: bool,
) -> Tuple[int, int]:
    if rebuild_catalog:
        cur.execute("DELETE FROM photo_album_message_media_matches WHERE source_key=%s", (source_key,))
        cur.execute("DELETE FROM photo_album_media_catalog WHERE source_key=%s", (source_key,))
        cur.execute("DELETE FROM photo_album_message_catalog WHERE source_key=%s", (source_key,))
        cur.execute("UPDATE photo_album_import_checkpoints SET last_message_id=0, last_matched_message_id=0 WHERE source_key=%s", (source_key,))

    grouped: Dict[int, List[MessageRow]] = {}
    for row in messages:
        grouped.setdefault(int(row.message_id), []).append(row)

    highest_message_id = 0
    ingested_messages = 0
    for message_id in sorted(grouped.keys()):
        rows = grouped[message_id]
        highest_message_id = max(highest_message_id, int(message_id))
        first = rows[0]
        sent_at = first.sent_at.strftime("%Y-%m-%d %H:%M:%S")
        text_value = ""
        for row in rows:
            if str(row.text or "").strip():
                text_value = str(row.text or "").strip()
                break
        attachments: List[Tuple[Optional[Path], str]] = []
        seen_attach: set[Tuple[str, str]] = set()
        for row in rows:
            ap = row.attachment_path
            mime = str(row.attachment_mime or "").strip().lower()
            key = (str(ap or ""), mime)
            if not str(key[0]).strip():
                continue
            if key in seen_attach:
                continue
            seen_attach.add(key)
            attachments.append((ap, mime))

        image_count = 0
        video_count = 0
        for ap, mime in attachments:
            kind = media_kind_from_attachment(ap, mime)
            if kind == "image":
                image_count += 1
            elif kind == "video":
                video_count += 1

        cur.execute(
            """
            INSERT INTO photo_album_message_catalog
              (source_key, message_row_id, handle_id, is_from_me, sent_at, message_text, attachment_count, image_attachment_count, video_attachment_count, is_matched, matched_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,0,NULL)
            ON DUPLICATE KEY UPDATE
              handle_id=VALUES(handle_id),
              is_from_me=VALUES(is_from_me),
              sent_at=VALUES(sent_at),
              message_text=VALUES(message_text),
              attachment_count=VALUES(attachment_count),
              image_attachment_count=VALUES(image_attachment_count),
              video_attachment_count=VALUES(video_attachment_count),
              is_matched=0,
              matched_at=NULL
            """,
            (
                source_key,
                int(message_id),
                str(first.handle_id or "").strip().lower(),
                int(first.is_from_me or 0),
                sent_at,
                text_value,
                len(attachments),
                image_count,
                video_count,
            ),
        )
        cur.execute("DELETE FROM photo_album_media_catalog WHERE source_key=%s AND message_row_id=%s", (source_key, int(message_id)))
        for idx, (ap, mime) in enumerate(attachments, start=1):
            kind = media_kind_from_attachment(ap, mime)
            name = ap.name if ap is not None else ""
            name_l = name.lower().strip()
            stem_l = Path(name).stem.lower().strip() if name_l else ""
            has_violet = 1 if (name_l in violet_face_names or stem_l in violet_face_names) else 0
            has_eleanor = 1 if (name_l in eleanor_face_names or stem_l in eleanor_face_names) else 0
            has_lyra = 1 if (name_l in lyra_face_names or stem_l in lyra_face_names) else 0
            cur.execute(
                """
                INSERT INTO photo_album_media_catalog
                  (source_key, message_row_id, attachment_index, attachment_name, attachment_path, mime_type, media_kind, captured_at, file_exists, has_violet_face, has_eleanor_face, has_lyra_face)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    source_key,
                    int(message_id),
                    int(idx),
                    name[:255],
                    str(ap or ""),
                    mime[:191],
                    kind,
                    sent_at,
                    1 if (ap is not None and ap.exists()) else 0,
                    has_violet,
                    has_eleanor,
                    has_lyra,
                ),
            )
        ingested_messages += 1

    return ingested_messages, highest_message_id


def load_catalog_messages(cur, source_key: str, min_message_row_id: int = 0) -> List[CatalogMessage]:
    params: List[Any] = [source_key]
    clause = ""
    if min_message_row_id > 0:
        clause = " AND message_row_id > %s"
        params.append(int(min_message_row_id))
    cur.execute(
        f"""
        SELECT message_row_id, sent_at, is_from_me, handle_id, message_text, attachment_count, image_attachment_count, video_attachment_count
        FROM photo_album_message_catalog
        WHERE source_key=%s {clause}
        ORDER BY sent_at ASC, message_row_id ASC
        """,
        tuple(params),
    )
    out: List[CatalogMessage] = []
    for row in cur.fetchall():
        out.append(
            CatalogMessage(
                message_row_id=int(row["message_row_id"]),
                sent_at=row["sent_at"],
                is_from_me=int(row["is_from_me"] or 0),
                handle_id=str(row["handle_id"] or ""),
                message_text=str(row["message_text"] or ""),
                attachment_count=int(row["attachment_count"] or 0),
                image_attachment_count=int(row["image_attachment_count"] or 0),
                video_attachment_count=int(row["video_attachment_count"] or 0),
            )
        )
    return out


def load_catalog_media(cur, source_key: str, only_existing: bool) -> List[CatalogMedia]:
    extra = " AND file_exists=1" if only_existing else ""
    cur.execute(
        f"""
        SELECT id, message_row_id, attachment_name, attachment_path, media_kind, captured_at, has_violet_face, has_eleanor_face, has_lyra_face
        FROM photo_album_media_catalog
        WHERE source_key=%s
          AND media_kind IN ('image','video')
          {extra}
        ORDER BY captured_at ASC, id ASC
        """,
        (source_key,),
    )
    out: List[CatalogMedia] = []
    for row in cur.fetchall():
        out.append(
            CatalogMedia(
                media_id=int(row["id"]),
                message_row_id=int(row["message_row_id"]),
                attachment_name=str(row["attachment_name"] or ""),
                attachment_path=str(row["attachment_path"] or ""),
                media_kind=str(row["media_kind"] or "other"),
                captured_at=row["captured_at"],
                has_violet_face=int(row["has_violet_face"] or 0),
                has_eleanor_face=int(row["has_eleanor_face"] or 0),
                has_lyra_face=int(row["has_lyra_face"] or 0),
            )
        )
    return out


def run_catalog_matching(
    cur,
    source_key: str,
    focus_person: str,
    match_window_hours: int,
    max_matched_media_per_message: int,
    min_message_row_id: int,
) -> int:
    messages = [m for m in load_catalog_messages(cur, source_key, min_message_row_id=min_message_row_id) if int(m.attachment_count or 0) > 0]
    if not messages:
        return 0

    all_media = [m for m in load_catalog_media(cur, source_key, only_existing=False) if Path(m.attachment_path).exists()]
    image_media = [m for m in all_media if m.media_kind == "image"]
    media_by_id: Dict[int, CatalogMedia] = {int(m.media_id): m for m in all_media}

    media_by_message: Dict[int, List[CatalogMedia]] = {}
    for media in all_media:
        media_by_message.setdefault(int(media.message_row_id), []).append(media)

    cur.execute(
        "SELECT MAX(message_row_id) AS max_row FROM photo_album_message_catalog WHERE source_key=%s",
        (source_key,),
    )
    max_row = int((cur.fetchone() or {}).get("max_row") or 0)
    if min_message_row_id > 0:
        cur.execute(
            "DELETE FROM photo_album_message_media_matches WHERE source_key=%s AND message_row_id > %s",
            (source_key, int(min_message_row_id)),
        )
    else:
        cur.execute("DELETE FROM photo_album_message_media_matches WHERE source_key=%s", (source_key,))

    used_media_ids: set[int] = set()
    matched_count = 0
    window_seconds = max(1, int(match_window_hours)) * 3600
    for message in messages:
        direct_media_all = sorted(
            [m for m in media_by_message.get(message.message_row_id, []) if m.media_kind in {"image", "video"}],
            key=lambda m: (0 if m.media_kind == "image" else 1, m.media_id),
        )
        direct_media_images_all = [m for m in direct_media_all if m.media_kind == "image"]
        direct_media_videos = [m for m in direct_media_all if m.media_kind == "video"]
        direct_media_images = list(direct_media_images_all)
        if focus_person in {"violet", "eleanor", "lyra"}:
            direct_media_images = [m for m in direct_media_images if media_has_focus_face(m, focus_person)]
        if not direct_media_images:
            # Face tags are incomplete in many libraries; keep same-message images as likely attachments.
            direct_media_images = list(direct_media_images_all)

        direct_media: List[CatalogMedia] = list(direct_media_images)
        if not direct_media:
            # Allow videos to carry a message when images are missing.
            direct_media = list(direct_media_videos)

        referenced_names = {
            str(media.attachment_name or "").strip().lower()
            for media in media_by_message.get(message.message_row_id, [])
            if str(media.attachment_name or "").strip()
        }
        expected = max(1, min(int(message.attachment_count or 1), int(max_matched_media_per_message or 8)))
        ranked_media_ids: List[int] = []
        for media in direct_media:
            if media.media_id in ranked_media_ids:
                continue
            ranked_media_ids.append(int(media.media_id))
            if len(ranked_media_ids) >= expected:
                break

        remaining_slots = expected - len(ranked_media_ids)
        scored: List[Tuple[float, float, CatalogMedia]] = []
        for media in image_media:
            if int(media.media_id) in ranked_media_ids:
                continue
            delta_seconds = abs((media.captured_at - message.sent_at).total_seconds())
            if delta_seconds > window_seconds:
                continue
            hours = delta_seconds / 3600.0
            score = max(0.0, 96.0 - hours)
            if media.message_row_id == message.message_row_id:
                score += 140.0
            media_name_l = str(media.attachment_name or "").strip().lower()
            if media_name_l and media_name_l in referenced_names:
                score += 120.0
            if focus_person in {"violet", "eleanor", "lyra"} and media_has_focus_face(media, focus_person):
                score += 35.0
            elif focus_person in {"violet", "eleanor", "lyra"}:
                score -= 8.0
            if media.media_id in used_media_ids:
                score -= 18.0
            if score <= 0:
                continue
            scored.append((score, delta_seconds, media))

        scored.sort(key=lambda item: (-item[0], item[1], item[2].media_id))
        picks = scored[:max(0, remaining_slots)]
        for _score, _delta, media in picks:
            ranked_media_ids.append(int(media.media_id))

        ranked_media: List[CatalogMedia] = [media_by_id[mid] for mid in ranked_media_ids if mid in media_by_id]
        if len(ranked_media) < expected:
            # Backfill with closest videos in time when still short.
            video_candidates = [m for m in all_media if m.media_kind == "video" and int(m.media_id) not in ranked_media_ids]
            video_candidates.sort(key=lambda m: abs((m.captured_at - message.sent_at).total_seconds()))
            for video in video_candidates:
                delta_seconds = abs((video.captured_at - message.sent_at).total_seconds())
                if delta_seconds > window_seconds:
                    continue
                ranked_media_ids.append(int(video.media_id))
                ranked_media.append(video)
                if len(ranked_media) >= expected:
                    break

        if len(ranked_media) > expected:
            ranked_media = ranked_media[:expected]
            ranked_media_ids = [int(m.media_id) for m in ranked_media]

        if ranked_media:
            # Preserve direct-media priority before time-window inference.
            ordered_direct_ids = [int(m.media_id) for m in direct_media if int(m.media_id) in ranked_media_ids]
            ordered_other = [m for m in ranked_media if int(m.media_id) not in ordered_direct_ids]
            ranked_media = [media_by_id[mid] for mid in ordered_direct_ids if mid in media_by_id] + ordered_other

        if not ranked_media:
            cur.execute(
                "UPDATE photo_album_message_catalog SET is_matched=1, matched_at=NOW() WHERE source_key=%s AND message_row_id=%s",
                (source_key, int(message.message_row_id)),
            )
            continue

        for rank, media in enumerate(ranked_media, start=1):
            delta_seconds = abs((media.captured_at - message.sent_at).total_seconds())
            score = max(0.0, 96.0 - (delta_seconds / 3600.0))
            if media.message_row_id == message.message_row_id:
                score += 140.0
            if media.media_kind == "video":
                score += 10.0
            cur.execute(
                """
                INSERT INTO photo_album_message_media_matches (source_key, message_row_id, media_id, rank_order, score)
                VALUES (%s,%s,%s,%s,%s)
                """,
                (source_key, int(message.message_row_id), int(media.media_id), int(rank), float(score)),
            )
            used_media_ids.add(int(media.media_id))
            matched_count += 1

        cur.execute(
            "UPDATE photo_album_message_catalog SET is_matched=1, matched_at=NOW() WHERE source_key=%s AND message_row_id=%s",
            (source_key, int(message.message_row_id)),
        )

    checkpoint_upsert(cur, source_key, max_row, max_row)
    return matched_count


def caption_from_catalog_message(msg: CatalogMessage, handle_name_map: Dict[str, str]) -> str:
    text = str(msg.message_text or "").strip() or "(no caption)"
    speaker = speaker_name_from_catalog_message(msg, handle_name_map)
    stamp = msg.sent_at.strftime("%I:%M %p").lstrip("0")
    return f"{speaker} ({stamp}): {text}"


def build_pages_from_catalog(cur, source_key: str, staging_dir: Path, handle_name_map: Dict[str, str]) -> List[AlbumPage]:
    cur.execute(
        """
        SELECT
          m.message_row_id,
          m.sent_at,
          m.is_from_me,
          m.handle_id,
          m.message_text,
          m.attachment_count,
          m.image_attachment_count,
          m.video_attachment_count,
          c.id AS media_id,
          c.attachment_name,
          c.attachment_path,
          c.media_kind,
          c.captured_at AS media_captured_at
        FROM photo_album_message_catalog m
        INNER JOIN photo_album_message_media_matches mm
          ON mm.source_key=m.source_key AND mm.message_row_id=m.message_row_id
        INNER JOIN photo_album_media_catalog c
          ON c.id=mm.media_id AND c.source_key=mm.source_key
        WHERE m.source_key=%s
          AND c.media_kind IN ('image','video')
          AND c.file_exists=1
        ORDER BY m.sent_at ASC, m.message_row_id ASC, mm.rank_order ASC
        """,
        (source_key,),
    )
    grouped: Dict[int, Dict[str, Any]] = {}
    used_names: set[str] = {p.name for p in staging_dir.iterdir() if p.is_file()} if staging_dir.exists() else set()
    staged_hash_to_name: Dict[str, str] = build_staging_hash_index(staging_dir)
    for row in cur.fetchall():
        msg_id = int(row["message_row_id"])
        bucket = grouped.get(msg_id)
        if bucket is None:
            message = CatalogMessage(
                message_row_id=msg_id,
                sent_at=row["sent_at"],
                is_from_me=int(row["is_from_me"] or 0),
                handle_id=str(row["handle_id"] or ""),
                message_text=str(row["message_text"] or ""),
                attachment_count=int(row["attachment_count"] or 0),
                image_attachment_count=int(row["image_attachment_count"] or 0),
                video_attachment_count=int(row["video_attachment_count"] or 0),
            )
            bucket = {"message": message, "media_items": []}
            grouped[msg_id] = bucket
        source_path = Path(str(row["attachment_path"] or ""))
        if not source_path.exists():
            continue
        media_kind = str(row["media_kind"] or "image").strip().lower()
        media_captured_at = row["media_captured_at"] if row.get("media_captured_at") else row["sent_at"]
        media_captured_at = media_capture_datetime(source_path, media_captured_at)
        source_hash = file_sha256(source_path)
        existing_name = str(staged_hash_to_name.get(source_hash) or "").strip()
        if existing_name and (staging_dir / existing_name).exists():
            out_name = existing_name
        elif media_kind == "video":
            suffix = source_path.suffix.lower() or ".mov"
            out_name = build_timestamped_output_name(media_captured_at, str(row["attachment_name"] or source_path.name), suffix, used_names, "video")
            out_path = staging_dir / out_name
            copy_media_to_staging(source_path, out_path)
            staged_hash_to_name[source_hash] = out_name
        else:
            out_name = build_timestamped_output_name(media_captured_at, str(row["attachment_name"] or source_path.name), ".png", used_names, "image")
            out_path = staging_dir / out_name
            convert_to_png(source_path, out_path)
            staged_hash_to_name[source_hash] = out_name
        bucket["media_items"].append((f"/photo_albums/{out_name}", str(row["attachment_name"] or out_name), media_kind))

    pages: List[AlbumPage] = []
    for msg_id in sorted(grouped.keys()):
        bucket = grouped[msg_id]
        media_items = list(bucket["media_items"])
        if not media_items:
            continue
        message = bucket["message"]
        pages.append(
            AlbumPage(
                sent_at=message.sent_at,
                caption=caption_from_catalog_message(message, handle_name_map),
                media_items=media_items[:24],
                speaker_label=speaker_name_from_catalog_message(message, handle_name_map),
                speaker_handle_id=str(message.handle_id or ""),
            )
        )
    return pages


def chunk_sizes(total: int, min_pages: int, max_pages: int, target_pages: int) -> List[int]:
    if total <= 0:
        return []
    if max_pages <= 0 or target_pages <= 0:
        return [total]
    min_pages = max(1, int(min_pages))
    max_pages = max(min_pages, int(max_pages))
    target_pages = max(min_pages, min(int(target_pages), max_pages))
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


def ensure_album_import_locks_table(cur) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS photo_album_import_locks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      album_id INT NOT NULL,
      is_locked TINYINT(1) NOT NULL DEFAULT 1,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_album_lock (album_id),
      KEY idx_pail_album (album_id),
      CONSTRAINT fk_pail_album FOREIGN KEY (album_id) REFERENCES photo_albums(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)


def set_import_lock_by_title(cur, title: str, locked: bool, note: str = "") -> int:
    t = str(title or "").strip()
    if not t:
        return 0
    state = 1 if bool(locked) else 0
    cur.execute(
        """
        INSERT INTO photo_album_import_locks (album_id, is_locked, note)
        SELECT pa.id, %s, %s
        FROM photo_albums pa
        WHERE pa.title = %s
        ON DUPLICATE KEY UPDATE
          is_locked = VALUES(is_locked),
          note = VALUES(note)
        """,
        (state, note[:255], t),
    )
    return int(cur.rowcount or 0)


def fetch_locked_titles(cur, titles: Sequence[str]) -> set[str]:
    cleaned = sorted({str(t).strip() for t in titles if str(t).strip()})
    if not cleaned:
        return set()
    placeholders = ",".join(["%s"] * len(cleaned))
    cur.execute(
        f"""
        SELECT DISTINCT pa.title AS title
        FROM photo_albums pa
        INNER JOIN photo_album_import_locks l ON l.album_id = pa.id AND l.is_locked = 1
        WHERE pa.title IN ({placeholders})
        """,
        tuple(cleaned),
    )
    return {str(r["title"] or "").strip() for r in cur.fetchall() if str(r.get("title") or "").strip()}


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


def build_album_rows(
    album_batches: List[List[AlbumPage]],
    title_prefix: str,
    disable_ai: bool,
    child_name: str = "",
    child_birth_date: Optional[dt.date] = None,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    stamp = dt.datetime.now().strftime("%Y%m%d%H%M%S")
    single_album = len(album_batches) == 1
    title_counts: Dict[str, int] = {}
    for idx, pages in enumerate(album_batches, start=1):
        first_dt = pages[0].sent_at.strftime("%Y-%m-%d")
        last_dt = pages[-1].sent_at.strftime("%Y-%m-%d")
        if child_name and child_birth_date:
            base_title = album_title_for_child_window(child_name, child_birth_date, pages[0].sent_at.date(), prebirth_days=7)
            title_counts[base_title] = title_counts.get(base_title, 0) + 1
            part_no = title_counts[base_title]
            title = base_title if part_no == 1 else f"{base_title} Part {part_no}"
        else:
            title = title_prefix if single_album else f"{title_prefix} {idx}"
        summary = f"({first_dt} to {last_dt}). {len(pages)} pages."
        slug = f"{slugify(f'{title_prefix}-{idx}-{first_dt}')[:100]}-{stamp}-{idx}"[:120]

        captions = [p.caption for p in pages]
        style = infer_style_with_ai(captions, title, disable_ai=disable_ai)
        palette = normalize_csv_tokens(style["dominant_palette"], ["rose", "cream", "sage"])
        materials = normalize_csv_tokens(style["scrapbook_materials"], ["linen", "tape", "postcards"])
        motifs = normalize_csv_tokens(style["motif_keywords"], ["postmarks", "ribbons", "handwriting"])

        spreads = []
        for i, page in enumerate(pages, start=1):
            images = []
            for rel_path, source_name, media_kind in page.media_items[:24]:
                media_type = media_kind if media_kind in {"image", "video"} else album_media_kind_from_paths(rel_path, source_name)
                images.append({
                    "src": rel_path,
                    "media_type": media_type,
                    "captured_at": page.sent_at.isoformat(),
                    "source_filename": source_name,
                    "caption": page.caption,
                    "memory_text": page.caption,
                    "speaker_label": page.speaker_label,
                    "speaker_handle_id": page.speaker_handle_id,
                })
            spreads.append(
                {
                    "spread_number": i,
                    "title": "Opening Notes" if i == 1 else f"Memory Spread {i}",
                    "caption": page.caption,
                    "default_contact_label": page.speaker_label if page.speaker_label != "Papa" else "",
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


def build_sql_for_album_rows(
    rows: List[Dict[str, Any]],
    created_by_user_id: int,
    replace_titles: Optional[Sequence[str]] = None,
    lock_titles: Optional[Sequence[str]] = None,
    unlock_titles: Optional[Sequence[str]] = None,
) -> str:
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
    parts.append("""
CREATE TABLE IF NOT EXISTS photo_album_import_locks (
 id INT AUTO_INCREMENT PRIMARY KEY,
 album_id INT NOT NULL,
 is_locked TINYINT(1) NOT NULL DEFAULT 1,
 note VARCHAR(255) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uniq_album_lock (album_id),
 KEY idx_pail_album (album_id),
 CONSTRAINT fk_pail_album FOREIGN KEY (album_id) REFERENCES photo_albums(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
""".strip())
    if lock_titles:
        for title in sorted({str(t).strip() for t in lock_titles if str(t).strip()}):
            parts.append(f"""
INSERT INTO photo_album_import_locks (album_id, is_locked, note)
SELECT pa.id, 1, 'Locked via importer'
FROM photo_albums pa
WHERE pa.title={sql_quote(title)}
ON DUPLICATE KEY UPDATE is_locked=VALUES(is_locked), note=VALUES(note);
""".strip())
    if unlock_titles:
        for title in sorted({str(t).strip() for t in unlock_titles if str(t).strip()}):
            parts.append(f"""
INSERT INTO photo_album_import_locks (album_id, is_locked, note)
SELECT pa.id, 0, 'Unlocked via importer'
FROM photo_albums pa
WHERE pa.title={sql_quote(title)}
ON DUPLICATE KEY UPDATE is_locked=VALUES(is_locked), note=VALUES(note);
""".strip())
    if replace_titles:
        for title in sorted({str(t).strip() for t in replace_titles if str(t).strip()}):
            parts.append(f"""
SET @lock_count := (
  SELECT COUNT(*)
  FROM photo_albums pa
  INNER JOIN photo_album_import_locks l ON l.album_id = pa.id AND l.is_locked = 1
  WHERE pa.title={sql_quote(title)}
);
DELETE pa FROM photo_albums pa
LEFT JOIN photo_album_import_locks l ON l.album_id = pa.id AND l.is_locked = 1
WHERE pa.title={sql_quote(title)} AND l.album_id IS NULL;
""".strip())
    for r in rows:
        title_q = sql_quote(r["title"])
        parts.append(f"""
SET @skip_insert := (
  SELECT COUNT(*)
  FROM photo_albums pa
  INNER JOIN photo_album_import_locks l ON l.album_id = pa.id AND l.is_locked = 1
  WHERE pa.title={title_q}
);
INSERT INTO photo_albums
(title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, created_by_user_id)
SELECT
{title_q},
{sql_quote(r['slug'])},
{sql_quote(r['summary'])},
{sql_quote(r['cover_image_url'])},
{sql_quote(r['cover_prompt'])},
{sql_quote(r['spec_json'])},
1,
{int(created_by_user_id)}
WHERE @skip_insert = 0;
SET @album_id := LAST_INSERT_ID();
INSERT INTO photo_album_permissions (album_id, group_id, can_view)
SELECT @album_id, g.id, 1 FROM catn8_groups g
WHERE g.slug IN ('photo-albums-users', 'administrators')
  AND @album_id > 0
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


def upload_albums(
    album_batches: List[List[AlbumPage]],
    title_prefix: str,
    created_by_user_id: int,
    disable_ai: bool,
    child_name: str = "",
    child_birth_date: Optional[dt.date] = None,
) -> None:
    rows = build_album_rows(
        album_batches,
        title_prefix,
        disable_ai,
        child_name=child_name,
        child_birth_date=child_birth_date,
    )
    upload_album_rows(rows, created_by_user_id)


def upload_album_rows(
    rows: Sequence[Dict[str, Any]],
    created_by_user_id: int,
    replace_titles: Optional[Sequence[str]] = None,
    lock_titles: Optional[Sequence[str]] = None,
    unlock_titles: Optional[Sequence[str]] = None,
) -> None:
    if not rows:
        return
    conn = build_mysql_connection_from_env()
    try:
        with conn.cursor() as cur:
            ensure_album_permissions_table(cur)
            ensure_album_import_locks_table(cur)
            photo_group_id, admin_group_id = fetch_required_group_ids(cur)
            for title in sorted({str(t).strip() for t in (lock_titles or []) if str(t).strip()}):
                set_import_lock_by_title(cur, title, True, note="Locked via importer")
            for title in sorted({str(t).strip() for t in (unlock_titles or []) if str(t).strip()}):
                set_import_lock_by_title(cur, title, False, note="Unlocked via importer")
            if replace_titles:
                locked_titles = fetch_locked_titles(cur, replace_titles)
                for title in sorted({str(t).strip() for t in replace_titles if str(t).strip()}):
                    if title in locked_titles:
                        print(f"Skipping replace for locked title: {title}")
                        continue
                    cur.execute("DELETE FROM photo_albums WHERE title=%s", (title,))
        conn.commit()
        for row in rows:
            row_title = str(row.get("title") or "").strip()
            with conn.cursor() as cur:
                locked_for_row = fetch_locked_titles(cur, [row_title]) if row_title else set()
            if row_title and row_title in locked_for_row:
                print(f"Skipping upload for locked title: {row_title}")
                continue
            with conn.cursor() as cur:
                slug = unique_slug(cur, slugify(str(row.get("slug") or "album")))
                cur.execute(
                    """
                    INSERT INTO photo_albums (title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, created_by_user_id)
                    VALUES (%s,%s,%s,%s,%s,%s,1,%s)
                    """,
                    (
                        row.get("title") or "Photo Album",
                        slug,
                        row.get("summary") or "",
                        row.get("cover_image_url") or "",
                        row.get("cover_prompt") or "",
                        row.get("spec_json") or "{}",
                        created_by_user_id,
                    ),
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


def pages_from_attachment_match(
    messages: Sequence[MessageRow],
    staging_dir: Path,
    photos_db: Path,
    handle_name_map: Dict[str, str],
    focus_person: str = "any",
    eleanor_birth: Optional[dt.date] = None,
    face_name_filter: Optional[set[str]] = None,
    progress_every_messages: int = 0,
) -> List[AlbumPage]:
    pages: List[AlbumPage] = []
    staged_by_source_hash: Dict[str, str] = {}
    normalized_face_names = {str(x).strip().lower() for x in list(face_name_filter or set()) if str(x).strip()}
    total_messages = len(messages)
    auto_progress_every = max(50, min(500, max(1, total_messages // 100))) if total_messages > 0 else 50
    progress_interval = int(progress_every_messages) if int(progress_every_messages or 0) > 0 else int(auto_progress_every)
    progress_interval = max(10, progress_interval)
    print(f"Attachment-match progress interval: every {progress_interval} messages")

    processed = 0
    produced_pages = 0
    skipped_non_visual = 0
    skipped_face_filter = 0
    conversion_failures = 0

    for i, msg in enumerate(messages):
        processed += 1
        source = resolve_message_media_source(msg, photos_db)
        if source is None:
            if processed % progress_interval == 0:
                pct = (float(processed) / float(max(1, total_messages))) * 100.0
                print(f"[attachment_match] {processed}/{total_messages} ({pct:.1f}%) pages={produced_pages} non_visual={skipped_non_visual} face_skips={skipped_face_filter} convert_fail={conversion_failures}")
            continue
        source_kind = media_kind_from_attachment(source, msg.attachment_mime)
        if source_kind not in {"image", "video"}:
            skipped_non_visual += 1
            if processed % progress_interval == 0:
                pct = (float(processed) / float(max(1, total_messages))) * 100.0
                print(f"[attachment_match] {processed}/{total_messages} ({pct:.1f}%) pages={produced_pages} non_visual={skipped_non_visual} face_skips={skipped_face_filter} convert_fail={conversion_failures}")
            continue
        if normalized_face_names and eleanor_birth and msg.sent_at.date() >= eleanor_birth and focus_person in {"violet", "eleanor", "lyra"}:
            candidate_names = {
                str(source.name or "").strip().lower(),
                str(source.stem or "").strip().lower(),
                str(msg.attachment_transfer_name or "").strip().lower(),
                str(msg.attachment_guid or "").strip().lower(),
            }
            if msg.attachment_path is not None:
                candidate_names.add(str(msg.attachment_path.name or "").strip().lower())
                candidate_names.add(str(msg.attachment_path.stem or "").strip().lower())
            if not any(name in normalized_face_names for name in candidate_names if name):
                skipped_face_filter += 1
                if processed % progress_interval == 0:
                    pct = (float(processed) / float(max(1, total_messages))) * 100.0
                    print(f"[attachment_match] {processed}/{total_messages} ({pct:.1f}%) pages={produced_pages} non_visual={skipped_non_visual} face_skips={skipped_face_filter} convert_fail={conversion_failures}")
                continue
        caption = build_rich_caption(messages, i, handle_name_map)
        if caption == "(no caption)":
            caption = build_contextual_caption(messages, i, handle_name_map)
        source_hash = file_sha256(source)
        out_name = str(staged_by_source_hash.get(source_hash) or "").strip()
        if out_name and not (staging_dir / out_name).exists():
            out_name = ""
        if not out_name:
            extension = source.suffix.lower() if source_kind == "video" and source.suffix else ".png"
            out_name = f"imsg_{source_hash[:20]}{extension}"
            staged_by_source_hash[source_hash] = out_name
        out_path = staging_dir / out_name
        try:
            if source_kind == "video":
                copy_media_to_staging(source, out_path)
            else:
                convert_to_png(source, out_path)
        except Exception as exc:
            conversion_failures += 1
            print(f"Skipping unsupported/failed media conversion: {source} ({source_kind}) :: {exc}")
            if processed % progress_interval == 0:
                pct = (float(processed) / float(max(1, total_messages))) * 100.0
                print(f"[attachment_match] {processed}/{total_messages} ({pct:.1f}%) pages={produced_pages} non_visual={skipped_non_visual} face_skips={skipped_face_filter} convert_fail={conversion_failures}")
            continue
        pages.append(AlbumPage(sent_at=msg.sent_at, caption=caption, media_items=[(f"/photo_albums/{out_name}", source.name, source_kind)]))
        produced_pages += 1
        if processed % progress_interval == 0:
            pct = (float(processed) / float(max(1, total_messages))) * 100.0
            print(f"[attachment_match] {processed}/{total_messages} ({pct:.1f}%) pages={produced_pages} non_visual={skipped_non_visual} face_skips={skipped_face_filter} convert_fail={conversion_failures}")
    print(f"[attachment_match] complete {processed}/{total_messages} (100.0%) pages={produced_pages} non_visual={skipped_non_visual} face_skips={skipped_face_filter} convert_fail={conversion_failures}")
    return aggregate_album_pages_by_day(pages, max_media_per_day=max(0, int(args.max_media_per_day)))


def pages_from_photos_timeline(
    photos_db: Path,
    assets: Sequence[PhotoAsset],
    messages: Sequence[MessageRow],
    start_date: dt.date,
    end_date: Optional[dt.date],
    staging_dir: Path,
    max_export_items: int,
    match_window_hours: int,
    timeline_state: Dict[str, Any],
    state_path: Path,
    source_key: str,
    focus_person: str,
    progress_every_messages: int,
) -> Tuple[List[AlbumPage], int]:
    export_dir = Path(".local/state/photos_timeline_exports")
    export_dir.mkdir(parents=True, exist_ok=True)

    candidates = [a for a in assets if a.date_created and a.date_created.date() >= start_date and (end_date is None or a.date_created.date() <= end_date)]
    candidates.sort(key=lambda a: a.date_created or dt.datetime.min)
    grouped_messages = group_messages_by_id(messages)
    if not grouped_messages:
        return [], int(timeline_state.get("last_processed_message_id") or 0)

    candidate_times: List[float] = []
    for asset in candidates:
        dtv = asset.date_created or dt.datetime.now()
        candidate_times.append(float(dtv.timestamp()))

    used_asset_ids: set[int] = {int(x) for x in timeline_state.get("used_asset_ids", []) if str(x).strip().isdigit()}
    failed_asset_ids: set[int] = {int(x) for x in timeline_state.get("failed_asset_ids", []) if str(x).strip().isdigit()}
    failed_export_keys: set[str] = {str(x) for x in timeline_state.get("failed_export_keys", []) if str(x).strip()}
    staged_by_asset_id: Dict[str, str] = dict(timeline_state.get("staged_media_by_asset_id", {}))
    staged_by_attachment_path: Dict[str, str] = dict(timeline_state.get("staged_media_by_attachment_path", {}))
    last_processed_message_id = int(timeline_state.get("last_processed_message_id") or 0)
    export_cache: Dict[str, Path] = {}
    remaining_messages = [m for m in grouped_messages if int(m.message_id) > int(last_processed_message_id)]
    total_messages = len(remaining_messages)
    total_messages_with_attachments = sum(1 for m in remaining_messages if len(m.attachments) > 0)
    auto_progress_every = max(50, min(500, max(1, total_messages // 200))) if total_messages > 0 else 50
    progress_interval = int(progress_every_messages) if int(progress_every_messages or 0) > 0 else int(auto_progress_every)
    progress_interval = max(10, progress_interval)
    print(f"Progress file: {timeline_progress_snapshot_path(source_key)}")
    print(f"Progress interval: every {progress_interval} messages")

    pages: List[AlbumPage] = []
    attempts = 0
    processed_messages = 0
    processed_messages_with_attachments = 0
    used_names: set[str] = {p.name for p in staging_dir.iterdir() if p.is_file()} if staging_dir.exists() else set()
    staged_hash_to_name: Dict[str, str] = build_staging_hash_index(staging_dir)
    window_secs = max(1, int(match_window_hours)) * 3600

    def emit_progress(status: str, force: bool = False) -> None:
        if total_messages <= 0:
            pct = 100.0
        else:
            pct = (float(processed_messages) / float(total_messages)) * 100.0
        payload = {
            "status": status,
            "source_key": source_key,
            "focus_person": focus_person,
            "progress_interval_messages": int(progress_interval),
            "total_messages": int(total_messages),
            "total_messages_with_attachments": int(total_messages_with_attachments),
            "processed_messages": int(processed_messages),
            "processed_messages_with_attachments": int(processed_messages_with_attachments),
            "percent_complete": round(pct, 3),
            "pages_built": int(len(pages)),
            "exports_attempted": int(attempts),
            "last_processed_message_id": int(last_processed_message_id),
        }
        write_timeline_progress(source_key, payload, append_history=bool(force or (processed_messages % progress_interval == 0)))

    emit_progress("running", force=True)
    try:
        for msg in remaining_messages:
            if int(max_export_items) > 0 and len(pages) >= int(max_export_items):
                break
            if not msg.attachments:
                last_processed_message_id = max(last_processed_message_id, int(msg.message_id))
                processed_messages += 1
                timeline_state["last_processed_message_id"] = int(last_processed_message_id)
                if processed_messages % 200 == 0:
                    save_timeline_state(state_path, timeline_state)
                if processed_messages % progress_interval == 0:
                    emit_progress("running")
                continue
            processed_messages_with_attachments += 1
            attachment_refs = [(ap, mime) for ap, mime in msg.attachments if media_kind_from_attachment(ap, mime) in {"image", "video"}]
            expected = max(1, min(len(attachment_refs) if attachment_refs else len(msg.attachments) or 1, 12))
            ts = float(msg.sent_at.timestamp())

            page_media: List[Tuple[str, str, str]] = []

            # Fast path: direct iMessage attachments are highest confidence and avoid Photos export latency.
            for ap, mime in attachment_refs:
                if ap is None or not ap.exists():
                    continue
                source = ap
                src_key = str(source.resolve())
                existing_name = str(staged_by_attachment_path.get(src_key) or "").strip()
                if existing_name and (staging_dir / existing_name).exists():
                    out_name = existing_name
                else:
                    source_hash = file_sha256(source)
                    hashed_name = str(staged_hash_to_name.get(source_hash) or "").strip()
                    if hashed_name and (staging_dir / hashed_name).exists():
                        out_name = hashed_name
                    else:
                        capture_ts = media_capture_datetime(source, msg.sent_at)
                        source_kind = media_kind_from_attachment(source, mime)
                        ext = source.suffix.lower() or (".mov" if source_kind == "video" else ".heic")
                        out_name = build_timestamped_output_name(capture_ts, source.name, ext, used_names, source_kind)
                        copy_media_to_staging(source, staging_dir / out_name)
                        staged_hash_to_name[source_hash] = out_name
                    staged_by_attachment_path[src_key] = out_name
                media_kind = media_kind_from_attachment(source, mime)
                page_media.append((f"/photo_albums/{out_name}", source.name, media_kind))
                if len(page_media) >= expected:
                    break

            remaining = max(0, expected - len(page_media))
            if remaining > 0:
                lo = bisect.bisect_left(candidate_times, ts - window_secs)
                hi = bisect.bisect_right(candidate_times, ts + window_secs)
                nearby: List[PhotoAsset] = []
                for idx in range(lo, hi):
                    asset = candidates[idx]
                    aid = int(asset.asset_id)
                    if aid in used_asset_ids:
                        continue
                    if aid in failed_asset_ids:
                        continue
                    nearby.append(asset)
                nearby.sort(key=lambda a: abs(float((a.date_created or msg.sent_at).timestamp()) - ts))

                for asset in nearby:
                    if remaining <= 0:
                        break
                    source: Optional[Path] = None
                    attempts += 1
                    if attempts % 10 == 0:
                        print(f"photos_timeline progress: attempted {attempts} exports, built {len(pages)} page(s)...")

                    aid_str = str(int(asset.asset_id))
                    existing_name = str(staged_by_asset_id.get(aid_str) or "").strip()
                    if existing_name and (staging_dir / existing_name).exists():
                        out_name = existing_name
                        media_kind = media_kind_from_attachment(staging_dir / out_name, "")
                        page_media.append((f"/photo_albums/{out_name}", asset.original_filename or asset.filename or out_name, media_kind))
                        used_asset_ids.add(int(asset.asset_id))
                        remaining -= 1
                        continue

                    target_dt = asset.date_created or msg.sent_at
                    export_key = f"{(asset.original_filename or asset.filename).lower()}|{target_dt.strftime('%Y%m%d%H%M')}"
                    if export_key in failed_export_keys:
                        continue
                    if export_key in export_cache and export_cache[export_key].exists():
                        source = export_cache[export_key]
                    else:
                        exported = None
                        asset_uuid = str(asset.uuid or "").strip()
                        if asset_uuid:
                            exported = photos_find_derivative_by_asset_uuid(photos_db, asset_uuid)
                        if not exported and asset_uuid:
                            exported = photos_export_by_asset_id(asset_uuid, export_dir)
                        if not exported:
                            exported = photos_export_by_filename_nearest_date(asset.original_filename or asset.filename, target_dt, export_dir)
                        if exported and exported.exists():
                            source = exported
                            export_cache[export_key] = exported
                    if source is None:
                        failed_asset_ids.add(int(asset.asset_id))
                        failed_export_keys.add(export_key)
                        continue

                    capture_ts = media_capture_datetime(source, asset.date_created or msg.sent_at)
                    source_kind = media_kind_from_attachment(source, "")
                    source_hash = file_sha256(source)
                    hashed_name = str(staged_hash_to_name.get(source_hash) or "").strip()
                    if hashed_name and (staging_dir / hashed_name).exists():
                        out_name = hashed_name
                    else:
                        ext = source.suffix.lower() or (".mov" if source_kind == "video" else ".heic")
                        out_name = build_timestamped_output_name(capture_ts, source.name, ext, used_names, source_kind)
                        copy_media_to_staging(source, staging_dir / out_name)
                        staged_hash_to_name[source_hash] = out_name
                    media_kind = "video" if source_kind == "video" else "image"
                    page_media.append((f"/photo_albums/{out_name}", source.name, media_kind))
                    used_asset_ids.add(int(asset.asset_id))
                    staged_by_asset_id[aid_str] = out_name
                    remaining -= 1

            last_processed_message_id = max(last_processed_message_id, int(msg.message_id))
            processed_messages += 1
            timeline_state["last_processed_message_id"] = int(last_processed_message_id)
            timeline_state["used_asset_ids"] = sorted(int(x) for x in used_asset_ids)
            timeline_state["failed_asset_ids"] = sorted(int(x) for x in failed_asset_ids)
            timeline_state["failed_export_keys"] = sorted(failed_export_keys)
            timeline_state["staged_media_by_asset_id"] = staged_by_asset_id
            timeline_state["staged_media_by_attachment_path"] = staged_by_attachment_path
            if processed_messages % 20 == 0:
                save_timeline_state(state_path, timeline_state)
            if processed_messages % progress_interval == 0:
                emit_progress("running")

            if not page_media:
                continue
            caption = build_grouped_message_caption(msg)
            pages.append(AlbumPage(sent_at=msg.sent_at, caption=caption, media_items=page_media))
            if len(pages) % 5 == 0:
                print(f"photos_timeline progress: exported {len(pages)} page(s)...")
                emit_progress("running")
    except Exception:
        emit_progress("failed", force=True)
        raise

    timeline_state["last_processed_message_id"] = int(last_processed_message_id)
    timeline_state["used_asset_ids"] = sorted(int(x) for x in used_asset_ids)
    timeline_state["failed_asset_ids"] = sorted(int(x) for x in failed_asset_ids)
    timeline_state["failed_export_keys"] = sorted(failed_export_keys)
    timeline_state["staged_media_by_asset_id"] = staged_by_asset_id
    timeline_state["staged_media_by_attachment_path"] = staged_by_attachment_path
    save_timeline_state(state_path, timeline_state)
    emit_progress("completed", force=True)
    return pages, int(last_processed_message_id)


def main() -> None:
    load_env_files()
    args = parse_args()

    violet_birth = parse_date(args.violet_birth_date)
    eleanor_birth = parse_date(args.eleanor_birth_date)
    lyra_birth = parse_date(args.lyra_birth_date)
    default_start = min(violet_birth, eleanor_birth, lyra_birth) - dt.timedelta(days=7)
    start_date = parse_date(args.start_date) if args.start_date.strip() else default_start
    end_date = parse_date(args.end_date) if args.end_date.strip() else None
    extra_windows: List[Tuple[dt.date, dt.date]] = [parse_date_window(v) for v in list(args.extra_window or [])]
    message_windows: List[Tuple[Optional[dt.date], Optional[dt.date]]] = [(start_date, end_date)]
    message_windows.extend(extra_windows)

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
    if extra_windows:
        print(f"Extra windows: {', '.join([f'{s.isoformat()}..{e.isoformat()}' for (s, e) in extra_windows])}")

    needs_face_assets = args.mode in {"catalog_match", "photos_timeline", "attachment_match"}
    violet_id = 0
    eleanor_id = 0
    lyra_id = 0
    assets: List[PhotoAsset] = []
    if needs_face_assets:
        photos_conn = sqlite_connect_readonly(photos_db)
        try:
            faces = load_named_faces(photos_conn)
            if args.mode == "attachment_match":
                violet_id = int(args.violet_face_id) if args.violet_face_id is not None else int(find_face_id_by_name(faces, ["violet"]) or 0)
                eleanor_id = int(args.eleanor_face_id) if args.eleanor_face_id is not None else int(find_face_id_by_name(faces, ["eleanor"]) or 0)
                if violet_id > 0 or eleanor_id > 0:
                    print(f"Auto-selected Face IDs: Violet={violet_id}, Eleanor={eleanor_id}")
                else:
                    print("Could not auto-select Violet/Eleanor face IDs; post-Eleanor face filtering will be skipped.")
            elif args.violet_face_id is not None and args.eleanor_face_id is not None:
                violet_id = int(args.violet_face_id)
                eleanor_id = int(args.eleanor_face_id)
                print(f"Using Face IDs: Violet={violet_id}, Eleanor={eleanor_id}")
            else:
                violet_id, eleanor_id = prompt_face_ids(faces)
            lyra_id = int(args.lyra_face_id) if args.lyra_face_id is not None else int(find_face_id_by_name(faces, ["lyra", "lyrielle"]) or 0)
            if lyra_id > 0:
                print(f"Using Face ID: Lyra={lyra_id}")
            person_ids = [pid for pid in [violet_id, eleanor_id, lyra_id] if int(pid) > 0]
            assets = load_face_assets(photos_conn, person_ids)
            print(f"Loaded {len(assets)} face-tagged assets from Photos DB.")
        finally:
            photos_conn.close()
    else:
        print("Skipping face asset scan for attachment_match mode.")

    focus_person = resolve_focus_person(args.focus_person, args.album_title_prefix)
    focus_sequence: List[str]
    if args.run_all_children or focus_person == "all":
        focus_sequence = ["violet", "eleanor", "lyra"]
    else:
        focus_sequence = [focus_person]
    if needs_face_assets and int(lyra_id) <= 0 and "lyra" in focus_sequence:
        print("Lyra/Lyrielle Face ID not found; proceeding without strict Lyrielle face filtering.")

    print(f"Focus run order: {', '.join(focus_sequence)}")
    contact_handle_cache: Dict[str, List[str]] = {}

    total_pages = 0
    violet_face_names: set[str] = set()
    eleanor_face_names: set[str] = set()
    lyra_face_names: set[str] = set()
    if assets and (violet_id > 0 or eleanor_id > 0 or lyra_id > 0):
        violet_face_names, eleanor_face_names, lyra_face_names = build_face_filename_sets(assets, violet_id, eleanor_id, lyra_id)

    for active_focus in focus_sequence:
        focus_contacts = contacts_for_focus(args, active_focus)
        focus_handles: List[str] = []
        handle_name_map: Dict[str, str] = {}
        for focus_contact in focus_contacts:
            key = focus_contact.strip().lower()
            if key not in contact_handle_cache:
                contact_handle_cache[key] = discover_contact_handles(focus_contact)
            discovered = list(contact_handle_cache[key])
            focus_handles.extend(discovered)
            for h in discovered:
                norm = normalize_handle_for_lookup(h)
                if norm and norm not in handle_name_map:
                    handle_name_map[norm] = focus_contact.strip()
        focus_handles = sorted({h for h in focus_handles if h})
        source_key = source_key_for_focus(args, active_focus)
        album_title_prefix = args.album_title_prefix
        if len(focus_sequence) > 1 and active_focus not in album_title_prefix.lower():
            album_title_prefix = f"{args.album_title_prefix} {active_focus.capitalize()}".strip()

        print("")
        print(f"=== Running focus: {active_focus} ===")
        print(f"Run source key: {source_key}")
        print(f"Contacts: {', '.join(focus_contacts)}")
        active_message_windows = merge_windows(message_windows, supplemental_windows_for_focus(active_focus))
        added_windows = [(s, e) for (s, e) in active_message_windows if (s, e) not in message_windows and s is not None and e is not None]
        if added_windows:
            print(f"Added supplemental windows: {', '.join([f'{s.isoformat()}..{e.isoformat()}' for (s, e) in added_windows])}")

        messages: List[MessageRow] = []
        pages: List[AlbumPage] = []

        if args.mode == "catalog_match":
            violet_face_names, eleanor_face_names, lyra_face_names = build_face_filename_sets(assets, violet_id, eleanor_id, lyra_id)
            try:
                conn = build_mysql_connection_from_env()
            except Exception as exc:
                raise RuntimeError(
                    "catalog_match requires direct MySQL connectivity. DNS/host resolution failed. "
                    "Use '--mode attachment_match' (or run via ./scripts/import_photos.sh) when remote DB isn't reachable."
                ) from exc
            try:
                with conn.cursor() as cur:
                    ensure_album_permissions_table(cur)
                    ensure_album_import_tables(cur)
                    checkpoint = checkpoint_get(cur, source_key)
                    min_message_id = 0 if args.rebuild_catalog else int(checkpoint["last_message_id"])
                    messages = load_messages_for_windows(
                        messages_db,
                        args.contact,
                        args.years,
                        focus_handles,
                        active_message_windows,
                        min_message_id=min_message_id,
                    )
                    print(f"Loaded {len(messages)} new/updated message rows from iMessage DB (min_message_id={min_message_id}).")
                    ingested_messages, highest_message_id = ingest_messages_into_catalog(
                        cur,
                        source_key,
                        messages,
                        violet_face_names,
                        eleanor_face_names,
                        lyra_face_names,
                        rebuild_catalog=bool(args.rebuild_catalog),
                    )
                    print(f"Ingested {ingested_messages} message records into MySQL catalog.")
                    checkpoint_upsert(
                        cur,
                        source_key,
                        max(int(checkpoint["last_message_id"]), int(highest_message_id)),
                        int(checkpoint["last_matched_message_id"]),
                    )

                    min_match_message_id = 0 if args.rematch_all else int(checkpoint["last_matched_message_id"])
                    matched_count = run_catalog_matching(
                        cur,
                        source_key,
                        active_focus,
                        match_window_hours=max(1, int(args.match_window_hours)),
                        max_matched_media_per_message=max(1, int(args.max_matched_media_per_message)),
                        min_message_row_id=min_match_message_id,
                    )
                    print(f"Catalog matching linked {matched_count} media items to messages.")
                    pages = build_pages_from_catalog(cur, source_key, staging_dir, handle_name_map)
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
        elif args.mode == "photos_timeline":
            state_path = timeline_state_path(source_key)
            timeline_state = normalize_timeline_state(
                load_timeline_state(state_path),
                source_key=source_key,
                focus_person=active_focus,
                start_date=start_date,
                end_date=end_date,
                staging_dir=staging_dir,
                reset=bool(args.rematch_all),
            )
            min_message_id = 0 if args.rematch_all else int(timeline_state.get("last_processed_message_id") or 0)
            messages = load_messages_for_windows(
                messages_db,
                args.contact,
                args.years,
                focus_handles,
                active_message_windows,
                min_message_id=min_message_id,
            )
            print(f"Loaded {len(messages)} messages in window (min_message_id={min_message_id}).")
            timeline_assets = filter_assets_for_focus(assets, active_focus, violet_id, eleanor_id, lyra_id)
            print(f"Photos timeline assets after focus filter: {len(timeline_assets)}")
            pages, last_processed_message_id = pages_from_photos_timeline(
                photos_db,
                timeline_assets,
                messages,
                start_date,
                end_date,
                staging_dir,
                max_export_items=max(0, int(args.max_export_items)),
                match_window_hours=max(1, int(args.match_window_hours)),
                timeline_state=timeline_state,
                state_path=state_path,
                source_key=source_key,
                focus_person=active_focus,
                progress_every_messages=max(0, int(args.progress_every_messages)),
            )
            print(f"Updated timeline checkpoint to message_id={last_processed_message_id} for focus '{active_focus}'.")
        else:
            checkpoint_path = attachment_checkpoint_path(source_key)
            checkpoint = load_attachment_checkpoint(checkpoint_path)
            min_message_id = 0
            if not bool(args.no_attachment_checkpoint) and not bool(args.rematch_all):
                min_message_id = int(checkpoint.get("last_message_id") or 0)
            print(
                "Attachment resume checkpoint: "
                f"source_key={source_key} last_message_id={min_message_id} windows={len(active_message_windows)}"
            )

            messages = load_messages_for_windows(
                messages_db,
                args.contact,
                args.years,
                focus_handles,
                active_message_windows,
                min_message_id=min_message_id,
            )
            print(f"Loaded {len(messages)} messages newer than checkpoint (min_message_id={min_message_id}).")

            max_message_id = 0
            for message_row in messages:
                try:
                    max_message_id = max(max_message_id, int(message_row.message_id))
                except Exception:
                    continue
            focus_face_names = set()
            if active_focus == "violet":
                focus_face_names = set(violet_face_names)
            elif active_focus == "eleanor":
                focus_face_names = set(eleanor_face_names)
            elif active_focus == "lyra":
                focus_face_names = set(lyra_face_names)
            pages = pages_from_attachment_match(
                messages,
                staging_dir,
                photos_db,
                handle_name_map,
                focus_person=active_focus,
                eleanor_birth=eleanor_birth,
                face_name_filter=focus_face_names,
                progress_every_messages=max(0, int(args.progress_every_messages)),
            )
            if max_message_id > 0 and not bool(args.no_attachment_checkpoint):
                next_checkpoint_id = max(min_message_id, max_message_id)
                save_attachment_checkpoint(checkpoint_path, source_key, active_focus, next_checkpoint_id)
                print(f"Updated attachment checkpoint to message_id={next_checkpoint_id} for focus '{active_focus}'.")

        if not pages:
            print(f"No new pages produced for focus '{active_focus}'.")
            continue

        if active_focus == "violet":
            batches = build_birthday_month_batches(pages, violet_birth, args.min_pages, args.max_pages, args.target_pages, prebirth_days=7)
        elif active_focus == "eleanor":
            batches = build_birthday_month_batches(pages, eleanor_birth, args.min_pages, args.max_pages, args.target_pages, prebirth_days=7)
        elif active_focus == "lyra":
            batches = build_birthday_month_batches(pages, lyra_birth, args.min_pages, args.max_pages, args.target_pages, prebirth_days=7)
        else:
            sizes = chunk_sizes(len(pages), args.min_pages, args.max_pages, args.target_pages)
            batches = []
            offset = 0
            for size in sizes:
                batches.append(pages[offset: offset + size])
                offset += size
        if not batches:
            sizes = chunk_sizes(len(pages), args.min_pages, args.max_pages, args.target_pages)
            batches = []
            offset = 0
            for size in sizes:
                batches.append(pages[offset: offset + size])
                offset += size
        print(f"Generated {len(batches)} album(s): {[len(b) for b in batches]} pages each")
        total_pages += len(pages)

        if args.dry_run:
            print("Dry run enabled: skipping upload")
            continue

        created_by_user_id = int(os.environ.get("CATN8_ALBUM_CREATED_BY_USER_ID", "1"))
        child_name = normalize_focus_child_name(active_focus)
        child_birth_date: Optional[dt.date] = None
        if child_name == "Violet":
            child_birth_date = violet_birth
        elif child_name == "Eleanor":
            child_birth_date = eleanor_birth
        elif child_name == "Lyrielle":
            child_birth_date = lyra_birth

        rows = build_album_rows(
            batches,
            album_title_prefix,
            args.disable_ai,
            child_name=child_name,
            child_birth_date=child_birth_date,
        )
        for album_idx, row in enumerate(rows, start=1):
            replace_titles = [str(row.get("title") or "").strip()] if bool(args.replace_existing_titles) else None
            use_mysql = args.upload_mode in ("auto", "mysql")
            use_maintenance_api = args.upload_mode in ("auto", "maintenance_api")

            if args.upload_mode == "maintenance_api":
                sql_text = build_sql_for_album_rows(
                    [row],
                    created_by_user_id,
                    replace_titles=replace_titles,
                    lock_titles=list(args.lock_title or []),
                    unlock_titles=list(args.unlock_title or []),
                )
                upload_sql_via_maintenance_api(sql_text)
                print(f"Upload complete for album {album_idx}/{len(rows)} via maintenance API SQL restore.")
                continue

            if use_mysql:
                try:
                    upload_album_rows(
                        [row],
                        created_by_user_id,
                        replace_titles=replace_titles,
                        lock_titles=list(args.lock_title or []),
                        unlock_titles=list(args.unlock_title or []),
                    )
                    print(f"Upload complete for album {album_idx}/{len(rows)} via direct MySQL connection.")
                    continue
                except Exception as mysql_error:
                    if not use_maintenance_api:
                        raise
                    print(f"Direct MySQL failed for album {album_idx}/{len(rows)} ({mysql_error}); trying maintenance API fallback...")

            sql_text = build_sql_for_album_rows(
                [row],
                created_by_user_id,
                replace_titles=replace_titles,
                lock_titles=list(args.lock_title or []),
                unlock_titles=list(args.unlock_title or []),
            )
            upload_sql_via_maintenance_api(sql_text)
            print(f"Upload complete for album {album_idx}/{len(rows)} via maintenance API SQL restore.")

    if total_pages <= 0:
        print("No new pages were produced in this run. Existing checkpoints/state are up to date.")
        return


if __name__ == "__main__":
    main()
