#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import glob
import json
import os
import re
import sqlite3
import subprocess
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

START_DATE = dt.date(2021, 11, 22)
END_DATE = dt.date(2021, 12, 31)
CONTACT = "Trinity"
VIOLET_FACE_ID = 71556
ELEANOR_FACE_ID = 71826
ALBUM_TITLE = "Violet Newborn Month 1"
MIN_PAGES = 10
MAX_PAGES = 80
KEYWORD_RE = re.compile(r"\b(violet|baby|newborn|delivery|deliver|labor|labour|induction|hospital|due date|born|contractions?)\b", re.I)


@dataclass
class MessageRow:
    message_id: int
    sent_at: dt.datetime
    text: str
    attachment_filename: str
    attachment_mime: str


@dataclass
class PageRow:
    sent_at: dt.datetime
    caption: str
    image_rel_src: str
    source_filename: str


def load_env_files() -> None:
    for env_file in (".env", ".env.local", ".env.live"):
        p = Path(env_file)
        if not p.exists():
            continue
        for line in p.read_text(errors="ignore").splitlines():
            s = line.strip()
            if not s or s.startswith("#") or "=" not in s:
                continue
            k, v = s.split("=", 1)
            k = k.strip()
            if k and k not in os.environ:
                os.environ[k] = v.strip().strip('"').strip("'")


def resolve_photos_db_path() -> Path:
    candidates = [
        Path("~/Pictures/Photos Library.photoslibrary/database/Photos.sqlite").expanduser(),
        Path("~/Library/Photos/Libraries/Syndication.photoslibrary/database/Photos.sqlite").expanduser(),
        Path("~/Library/Photos/Libraries/Photos Library.photoslibrary/database/Photos.sqlite").expanduser(),
    ]
    for c in candidates:
        if c.exists():
            return c.resolve()
    raise FileNotFoundError("Could not locate Photos.sqlite")


def sqlite_ro(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def apple_ts_to_datetime(value: int) -> Optional[dt.datetime]:
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


def normalize_contact_variants(value: str) -> List[str]:
    value = (value or "").strip()
    if not value:
        return []
    out = {value.lower()}
    if "@" not in value:
        d = re.sub(r"\D+", "", value)
        if d:
            out.add(d)
            if len(d) == 10:
                out.add(f"1{d}")
                out.add(f"+1{d}")
            elif len(d) == 11 and d.startswith("1"):
                out.add(d[1:])
                out.add(f"+{d}")
    return sorted(out)


def discover_contact_handles(contact: str) -> List[str]:
    contact = contact.lower().strip()
    handles: set[str] = set()
    dbs = glob.glob(os.path.expanduser("~/Library/Application Support/AddressBook/**/*.abcddb"), recursive=True)
    for db in dbs:
        try:
            conn = sqlite_ro(Path(db))
        except Exception:
            continue
        try:
            has = conn.execute("SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name='ZABCDRECORD'").fetchone()["c"]
            if not has:
                continue
            rows = conn.execute(
                """
                SELECT Z_PK id FROM ZABCDRECORD
                WHERE LOWER(COALESCE(ZFIRSTNAME,'')) LIKE ?
                   OR LOWER(COALESCE(ZLASTNAME,'')) LIKE ?
                   OR LOWER(COALESCE(ZNAME,'')) LIKE ?
                """,
                (f"%{contact}%", f"%{contact}%", f"%{contact}%"),
            ).fetchall()
            for r in rows:
                rid = int(r["id"])
                for table, field in (("ZABCDPHONENUMBER", "ZFULLNUMBER"), ("ZABCDEMAILADDRESS", "ZADDRESS"), ("ZABCDMESSAGINGADDRESS", "ZADDRESS")):
                    for e in conn.execute(f"SELECT COALESCE({field},'') v FROM {table} WHERE ZOWNER=? OR Z22_OWNER=?", (rid, rid)).fetchall():
                        for v in normalize_contact_variants(str(e["v"] or "")):
                            handles.add(v)
        finally:
            conn.close()
    return sorted(handles)


def load_messages(messages_db: Path, contact_handles: Sequence[str]) -> List[MessageRow]:
    conn = sqlite_ro(messages_db)
    try:
        handles = [h.lower() for h in contact_handles if h]
        if handles:
            ph = ",".join(["?"] * len(handles))
            sql = f"""
            SELECT m.ROWID message_id, m.date msg_date, COALESCE(m.text,'') text,
                   COALESCE(a.filename,'') attachment_filename, COALESCE(a.mime_type,'') attachment_mime
            FROM message m
            LEFT JOIN handle h ON h.ROWID=m.handle_id
            LEFT JOIN message_attachment_join maj ON maj.message_id=m.ROWID
            LEFT JOIN attachment a ON a.ROWID=maj.attachment_id
            WHERE LOWER(COALESCE(h.id,'')) IN ({ph})
               OR EXISTS (
                 SELECT 1
                 FROM chat_message_join cmj
                 INNER JOIN chat_handle_join chj ON chj.chat_id=cmj.chat_id
                 INNER JOIN handle hh ON hh.ROWID=chj.handle_id
                 WHERE cmj.message_id=m.ROWID
                   AND LOWER(COALESCE(hh.id,'')) IN ({ph})
               )
            ORDER BY m.date ASC, m.ROWID ASC
            """
            rows = conn.execute(sql, tuple(handles + handles)).fetchall()
        else:
            rows = []
    finally:
        conn.close()

    out: List[MessageRow] = []
    for r in rows:
        t = apple_ts_to_datetime(r["msg_date"])
        if t is None:
            continue
        if t.date() < START_DATE or t.date() > END_DATE:
            continue
        out.append(
            MessageRow(
                message_id=int(r["message_id"]),
                sent_at=t,
                text=str(r["text"] or "").strip(),
                attachment_filename=str(r["attachment_filename"] or "").strip(),
                attachment_mime=str(r["attachment_mime"] or "").strip().lower(),
            )
        )
    return out


def load_face_assets_filename_map(photos_db: Path) -> Dict[str, str]:
    conn = sqlite_ro(photos_db)
    try:
        sql = """
        SELECT DISTINCT
          LOWER(COALESCE(aa.ZORIGINALFILENAME, a.ZFILENAME, '')) AS key_name,
          COALESCE(aa.ZORIGINALFILENAME, a.ZFILENAME, '') AS export_name
        FROM ZDETECTEDFACE df
        INNER JOIN ZASSET a ON a.Z_PK = df.ZASSETFORFACE
        LEFT JOIN ZADDITIONALASSETATTRIBUTES aa ON aa.Z_PK = a.ZADDITIONALATTRIBUTES
        WHERE df.ZPERSONFORFACE IN (?, ?)
          AND TRIM(COALESCE(aa.ZORIGINALFILENAME, a.ZFILENAME, '')) <> ''
        """
        rows = conn.execute(sql, (VIOLET_FACE_ID, ELEANOR_FACE_ID)).fetchall()
    finally:
        conn.close()

    out: Dict[str, str] = {}
    for r in rows:
        key = str(r["key_name"] or "").strip().lower()
        val = str(r["export_name"] or "").strip()
        if key and val and key not in out:
            out[key] = val
    return out


def safe_photos_export(filename: str, export_dir: Path) -> Optional[Path]:
    filename = filename.strip()
    if not filename:
        return None
    export_dir.mkdir(parents=True, exist_ok=True)
    out_dir = str(export_dir).replace('"', '\\"')
    target = filename.replace('"', "")
    script = f'''
set outFolder to POSIX file "{out_dir}"
tell application "Photos"
  set matches to every media item whose filename is "{target}"
  if (count of matches) is 0 then
    return "none"
  end if
  export {{item 1 of matches}} to outFolder with using originals
  return "ok"
end tell
'''
    try:
        proc = subprocess.run(["osascript", "-e", script], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        return None
    if proc.returncode != 0:
        return None

    candidates = sorted([p for p in export_dir.glob("*") if p.is_file() and p.name.lower().startswith(Path(filename).stem.lower())], key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0] if candidates else None


def convert_to_png(src: Path, dst: Path) -> bool:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.suffix.lower() == ".png":
        dst.write_bytes(src.read_bytes())
        return True
    proc = subprocess.run(["sips", "-s", "format", "png", str(src), "--out", str(dst)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return proc.returncode == 0


def build_context(messages: Sequence[MessageRow], i: int) -> str:
    snippets: List[str] = []
    focal = messages[i]
    for j in range(max(0, i - 5), min(len(messages), i + 6)):
        t = (messages[j].text or "").strip()
        if not t:
            continue
        if abs((messages[j].sent_at - focal.sent_at).total_seconds()) > 24 * 3600:
            continue
        snippets.append(t)
    if not snippets:
        return "(no message text)"
    uniq: List[str] = []
    seen: set[str] = set()
    for s in snippets:
        k = s.lower().strip()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(s)
        if len(uniq) >= 6:
            break
    return " | ".join(uniq)


def message_has_image_attachment(msg: MessageRow) -> bool:
    if not msg.attachment_filename:
        return False
    ext = Path(msg.attachment_filename).suffix.lower()
    if ext in {".heic", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}:
        return True
    return msg.attachment_mime.startswith("image/")


def build_pages(messages: Sequence[MessageRow], filename_map: Dict[str, str], stage_dir: Path) -> List[PageRow]:
    export_dir = Path(".local/state/photos_timeline_exports")
    export_dir.mkdir(parents=True, exist_ok=True)

    pages: List[PageRow] = []
    page_counter = 0

    for i, msg in enumerate(messages):
        text = (msg.text or "").strip()
        has_keyword = bool(KEYWORD_RE.search(text))
        has_attach = bool(msg.attachment_filename)
        if not has_keyword and not has_attach:
            continue

        context = build_context(messages, i)
        attach_note = ""
        image_rel = ""
        src_name = ""

        if has_attach:
            raw_name = Path(msg.attachment_filename).name
            src_name = raw_name
            attach_note = f"Attachment referenced: {raw_name}."
            key = raw_name.lower()
            export_name = filename_map.get(key) or raw_name
            exported = safe_photos_export(export_name, export_dir)
            if exported and exported.exists():
                page_counter += 1
                out_name = f"page_{page_counter:04d}.png"
                out_path = stage_dir / out_name
                if convert_to_png(exported, out_path):
                    image_rel = f"/photo_albums/{out_name}"
                    attach_note = f"Attachment linked: {raw_name}."
                else:
                    attach_note = f"Attachment referenced: {raw_name} (conversion failed)."
            else:
                attach_note = f"Attachment referenced: {raw_name} (not exportable from Photos yet)."

        # Always keep memory page if keyword or attachment exists
        caption_parts = []
        if text:
            caption_parts.append(text)
        caption_parts.append(context)
        if attach_note:
            caption_parts.append(attach_note)
        caption = "\n\n".join([p for p in caption_parts if p.strip()])

        pages.append(PageRow(sent_at=msg.sent_at, caption=caption, image_rel_src=image_rel, source_filename=src_name))

    # ensure minimum pages by adding extra keyword/context messages if needed
    if len(pages) < MIN_PAGES:
        extras: List[PageRow] = []
        for i, msg in enumerate(messages):
            if not (msg.text or "").strip():
                continue
            caption = build_context(messages, i)
            extras.append(PageRow(sent_at=msg.sent_at, caption=caption, image_rel_src="", source_filename=""))
        for ex in extras:
            if len(pages) >= MIN_PAGES:
                break
            pages.append(ex)

    pages.sort(key=lambda p: p.sent_at)
    return pages[:MAX_PAGES]


def normalize_csv_tokens(value: str, fallback: Sequence[str]) -> List[str]:
    vals = [x.strip() for x in str(value or "").split(",") if x.strip()]
    return vals[:8] if vals else list(fallback)


def infer_style_with_ai(captions: Sequence[str]) -> Dict[str, str]:
    fallback = {
        "memory_era": "newborn days",
        "mood": "tender and grateful",
        "dominant_palette": "blush, ivory, powder blue",
        "scrapbook_materials": "linen, hospital bands, handwritten notes",
        "motif_keywords": "tiny footprints, blankets, first days",
        "camera_style": "intimate candid",
        "texture_intensity": "balanced",
    }
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return fallback
    body = {
        "model": os.environ.get("CATN8_AI_MODEL", "gpt-4o-mini"),
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": "Return strict JSON style fields."},
            {"role": "user", "content": json.dumps({"captions": list(captions)[:80], "fallback": fallback})},
        ],
        "temperature": 0.4,
    }
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=json.dumps(body).encode("utf-8"), headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, method="POST")
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


def build_cover_prompt(title: str, summary: str, style: Dict[str, str]) -> str:
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


def sql_quote(v: str) -> str:
    return "'" + str(v).replace("\\", "\\\\").replace("'", "''") + "'"


def upload_update_album_via_maintenance(pages: Sequence[PageRow]) -> None:
    style = infer_style_with_ai([p.caption for p in pages])
    palette = normalize_csv_tokens(style["dominant_palette"], ["blush", "ivory", "powder blue"])
    materials = normalize_csv_tokens(style["scrapbook_materials"], ["linen", "paper tape", "notes"])
    motifs = normalize_csv_tokens(style["motif_keywords"], ["tiny footprints", "blankets", "first days"])

    spreads = []
    for i, p in enumerate(pages, start=1):
        images = []
        if p.image_rel_src:
            images.append({
                "src": p.image_rel_src,
                "captured_at": p.sent_at.isoformat(),
                "source_filename": p.source_filename,
                "caption": p.caption,
                "memory_text": p.caption,
            })
        spreads.append({
            "spread_number": i,
            "title": "Opening Notes" if i == 1 else f"Memory Spread {i}",
            "caption": p.caption,
            "photo_slots": 1,
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
        })

    spec = {
        "schema_version": "catn8_scrapbook_spec_v1",
        "dimensions": {"width_px": 1400, "height_px": 1050, "aspect_ratio": "4:3", "safe_margin_px": 56, "bleed_px": 24},
        "controls": {
            "page_turn_style": "ribbon-tabs",
            "zoom": {"min": 0.75, "max": 2.5, "step": 0.25, "initial": 1},
            "downloads": {"allow_cover_download": True, "allow_page_download": True, "formats": ["png", "jpg", "webp"], "default_format": "png"},
        },
        "style_guide": {
            "memory_era": style["memory_era"],
            "mood": style["mood"],
            "palette": palette,
            "materials": materials,
            "motifs": motifs,
            "scrapbook_feel": "A deeply personal, handcrafted scrapbook assembled over months or years.",
        },
        "spreads": spreads,
    }

    cover = next((p.image_rel_src for p in pages if p.image_rel_src), "")
    summary = f"Newborn + delivery conversation memory pass ({START_DATE.isoformat()} to {END_DATE.isoformat()}). {len(pages)} pages."
    cover_prompt = build_cover_prompt(ALBUM_TITLE, summary, style)
    spec_json = json.dumps(spec, ensure_ascii=True)

    sql = f"""
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

INSERT INTO photo_albums (title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, created_by_user_id)
SELECT {sql_quote(ALBUM_TITLE)}, 'violet-newborn-month-1', {sql_quote(summary)}, {sql_quote(cover)}, {sql_quote(cover_prompt)}, {sql_quote(spec_json)}, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM photo_albums WHERE title = {sql_quote(ALBUM_TITLE)} LIMIT 1);

SET @album_id := (SELECT id FROM photo_albums WHERE title = {sql_quote(ALBUM_TITLE)} ORDER BY id DESC LIMIT 1);

UPDATE photo_albums
SET summary = {sql_quote(summary)},
    cover_image_url = {sql_quote(cover)},
    cover_prompt = {sql_quote(cover_prompt)},
    spec_json = {sql_quote(spec_json)},
    is_active = 1
WHERE id = @album_id;

INSERT INTO photo_album_permissions (album_id, group_id, can_view)
SELECT @album_id, g.id, 1
FROM catn8_groups g
WHERE g.slug IN ('photo-albums-users', 'administrators')
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);
""".strip() + "\n"

    state_dir = Path(".local/state")
    state_dir.mkdir(parents=True, exist_ok=True)
    sql_path = state_dir / f"photo_album_newborn_pass2_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    sql_path.write_text(sql, encoding="utf-8")

    base_url = os.environ.get("CATN8_BASE_URL", "https://catn8.us").strip().rstrip("/")
    token = os.environ.get("CATN8_ADMIN_TOKEN", "").strip()
    if not token:
        raise RuntimeError("CATN8_ADMIN_TOKEN is required")

    url = f"{base_url}/api/database_maintenance.php?action=restore_database&admin_token={token}"
    proc = subprocess.run(["curl", "-sS", "-X", "POST", "-F", f"backup_file=@{sql_path};type=text/plain", url], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip())
    payload = json.loads(proc.stdout or "{}")
    if not payload.get("success"):
        raise RuntimeError(f"Maintenance restore failed: {payload}")


def main() -> None:
    load_env_files()
    photos_db = resolve_photos_db_path()
    messages_db = Path("~/Library/Messages/chat.db").expanduser().resolve()
    stage_dir = Path("./photo_albums").resolve()
    stage_dir.mkdir(parents=True, exist_ok=True)

    contact_handles = discover_contact_handles(CONTACT)
    print(f"Resolved {len(contact_handles)} contact handles for {CONTACT}.")

    messages = load_messages(messages_db, contact_handles)
    print(f"Loaded {len(messages)} messages in window {START_DATE}..{END_DATE}.")

    filename_map = load_face_assets_filename_map(photos_db)
    print(f"Loaded {len(filename_map)} face-linked filenames from Photos DB.")

    pages = build_pages(messages, filename_map, stage_dir)
    print(f"Built {len(pages)} candidate pages.")

    if len(pages) < MIN_PAGES:
        raise RuntimeError(f"Could not build minimum {MIN_PAGES} pages; got {len(pages)}")

    upload_update_album_via_maintenance(pages)
    print(f"Updated album '{ALBUM_TITLE}' with {len(pages)} pages.")


if __name__ == "__main__":
    main()
