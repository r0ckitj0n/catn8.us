#!/usr/bin/env python3
from __future__ import annotations

import argparse
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
from typing import Dict, List, Optional, Sequence, Set, Tuple

PRE_BIRTH_DAYS = 7
DEFAULT_MAX_PAGES = 5000


@dataclass
class ChildConfig:
    name: str
    birth_date: dt.date
    contacts: List[str]


@dataclass
class MessageRow:
    message_id: int
    sent_at: dt.datetime
    text: str
    attachment_filename: str
    attachment_mime: str


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build resumable family timeline albums")
    p.add_argument("--state-file", default=".local/state/family_timeline_state.json")
    p.add_argument("--photos-db", default="~/Pictures/Photos Library.photoslibrary/database/Photos.sqlite")
    p.add_argument("--messages-db", default="~/Library/Messages/chat.db")
    p.add_argument("--max-pages-per-album", type=int, default=DEFAULT_MAX_PAGES)
    p.add_argument("--max-albums", type=int, default=0, help="0 means no cap")
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args()


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


def parse_date(v: str) -> dt.date:
    return dt.datetime.strptime(v.strip(), "%Y-%m-%d").date()


def add_months(d: dt.date, months: int) -> dt.date:
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    dim = [31, 29 if (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return dt.date(y, m, min(d.day, dim[m - 1]))


def ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suf = "th"
    else:
        suf = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf}"


def sanitize_slug(title: str) -> str:
    out = []
    prev_dash = False
    for ch in title.lower():
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        elif not prev_dash:
            out.append("-")
            prev_dash = True
    return ("".join(out).strip("-") or "album")[:120]


def sqlite_ro(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def resolve_photos_db_path(input_path: str) -> Path:
    preferred = Path(os.path.expanduser(input_path)).resolve()
    if preferred.exists():
        return preferred
    candidates = [
        Path("~/Library/Photos/Libraries/Syndication.photoslibrary/database/Photos.sqlite").expanduser(),
        Path("~/Library/Photos/Libraries/Photos Library.photoslibrary/database/Photos.sqlite").expanduser(),
    ]
    for c in candidates:
        if c.exists():
            return c.resolve()
    raise FileNotFoundError(f"Photos DB not found: {preferred}")


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
                out.update({f"1{d}", f"+1{d}"})
            elif len(d) == 11 and d.startswith("1"):
                out.update({d[1:], f"+{d}"})
    return sorted(out)


def discover_contact_handles(contact: str) -> List[str]:
    contact = contact.lower().strip()
    handles: Set[str] = set()
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


def load_messages(messages_db: Path, handles: Sequence[str], start: dt.date, end: dt.date) -> List[MessageRow]:
    if not handles:
        return []
    conn = sqlite_ro(messages_db)
    try:
        hs = [h.lower() for h in handles if h]
        ph = ",".join(["?"] * len(hs))
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
        rows = conn.execute(sql, tuple(hs + hs)).fetchall()
    finally:
        conn.close()

    out: List[MessageRow] = []
    for r in rows:
        t = apple_ts_to_datetime(r["msg_date"])
        if t is None:
            continue
        if t.date() < start or t.date() > end:
            continue
        out.append(MessageRow(
            message_id=int(r["message_id"]),
            sent_at=t,
            text=str(r["text"] or "").strip(),
            attachment_filename=str(r["attachment_filename"] or "").strip(),
            attachment_mime=str(r["attachment_mime"] or "").strip().lower(),
        ))
    return out


def load_photos_alias_map(photos_db: Path) -> Dict[str, List[str]]:
    conn = sqlite_ro(photos_db)
    try:
        rows = conn.execute(
            """
            SELECT DISTINCT COALESCE(aa.ZORIGINALFILENAME,'') original_name, COALESCE(a.ZFILENAME,'') asset_name
            FROM ZASSET a
            LEFT JOIN ZADDITIONALASSETATTRIBUTES aa ON aa.Z_PK=a.ZADDITIONALATTRIBUTES
            WHERE TRIM(COALESCE(aa.ZORIGINALFILENAME,a.ZFILENAME,'')) <> ''
            """
        ).fetchall()
    finally:
        conn.close()

    out: Dict[str, List[str]] = {}
    for r in rows:
        for name in [str(r["original_name"] or "").strip(), str(r["asset_name"] or "").strip()]:
            if not name:
                continue
            full = name.lower()
            stem = Path(name).stem.lower()
            out.setdefault(full, [])
            if name not in out[full]:
                out[full].append(name)
            if stem:
                out.setdefault(stem, [])
                if name not in out[stem]:
                    out[stem].append(name)
    return out


def safe_photos_export(candidates: Sequence[str], export_dir: Path) -> Optional[Path]:
    export_dir.mkdir(parents=True, exist_ok=True)
    out_dir = str(export_dir).replace('"', '\\"')
    for cand in candidates:
        cand = cand.strip()
        if not cand:
            continue
        target = cand.replace('"', "")
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
            p = subprocess.run(["osascript", "-e", script], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
        except subprocess.TimeoutExpired:
            continue
        if p.returncode != 0:
            continue
        found = sorted([x for x in export_dir.glob("*") if x.is_file() and x.name.lower().startswith(Path(cand).stem.lower())], key=lambda x: x.stat().st_mtime, reverse=True)
        if found:
            return found[0]
    return None


def convert_to_png(src: Path, dst: Path) -> bool:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.suffix.lower() == ".png":
        if not dst.exists():
            dst.write_bytes(src.read_bytes())
        return True
    if dst.exists():
        return True
    p = subprocess.run(["sips", "-s", "format", "png", str(src), "--out", str(dst)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return p.returncode == 0


def make_caption(messages: Sequence[MessageRow], idx: int, attach_note: str) -> str:
    focal = messages[idx]
    snippets: List[str] = []
    for j in range(max(0, idx - 6), min(len(messages), idx + 7)):
        t = (messages[j].text or "").strip()
        if not t:
            continue
        if abs((messages[j].sent_at - focal.sent_at).total_seconds()) > 24 * 3600:
            continue
        snippets.append(t)
    uniq: List[str] = []
    seen: Set[str] = set()
    for s in snippets:
        k = s.lower().strip()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(s)
    parts = [focal.text.strip()] if focal.text.strip() else []
    if uniq:
        parts.append(" | ".join(uniq[:12]))
    if attach_note:
        parts.append(attach_note)
    return "\n\n".join([p for p in parts if p.strip()]) or "(no message text)"


def infer_style(captions: Sequence[str], child_name: str) -> Dict[str, str]:
    fallback = {
        "memory_era": "family timeline",
        "mood": "tender and nostalgic",
        "dominant_palette": "blush, ivory, powder blue",
        "scrapbook_materials": "linen, handwritten notes, paper tape",
        "motif_keywords": "baby blankets, tiny footprints, family smiles",
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
            {"role": "system", "content": "Return strict JSON scrapbook style fields."},
            {"role": "user", "content": json.dumps({"child": child_name, "captions": list(captions)[:120], "fallback": fallback})},
        ],
        "temperature": 0.4,
    }
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=json.dumps(body).encode("utf-8"), headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
        parsed = json.loads(raw["choices"][0]["message"]["content"])
        out = {k: str(parsed.get(k) or fallback[k]) for k in fallback.keys()}
        if out["texture_intensity"] not in {"subtle", "balanced", "rich"}:
            out["texture_intensity"] = "balanced"
        return out
    except Exception:
        return fallback


def cover_prompt(title: str, summary: str, style: Dict[str, str]) -> str:
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


def normalize_csv_tokens(value: str, fallback: Sequence[str]) -> List[str]:
    vals = [x.strip() for x in str(value or "").split(",") if x.strip()]
    return vals[:8] if vals else list(fallback)


def sql_quote(v: str) -> str:
    return "'" + str(v).replace("\\", "\\\\").replace("'", "''") + "'"


def build_album_windows(child: ChildConfig, now: dt.date) -> List[Tuple[str, dt.date, dt.date]]:
    windows: List[Tuple[str, dt.date, dt.date]] = []

    first_start = child.birth_date - dt.timedelta(days=PRE_BIRTH_DAYS)
    first_end = child.birth_date + dt.timedelta(days=30)
    windows.append((f"{child.name}'s 1st Month", first_start, first_end))

    prev_end = first_end
    for month_no in range(2, 37):
        start = prev_end + dt.timedelta(days=1)
        end = add_months(start, 1) - dt.timedelta(days=1)
        windows.append((f"{child.name}'s {ordinal(month_no)} Month", start, end))
        prev_end = end

    year_no = 3
    year_start = child.birth_date + dt.timedelta(days=365 * 2)
    while year_start <= now:
        year_end = min(year_start + dt.timedelta(days=365) - dt.timedelta(days=1), now)
        windows.append((f"{child.name}'s {ordinal(year_no)} Year", year_start, year_end))
        year_no += 1
        year_start = year_end + dt.timedelta(days=1)

    return windows


def build_album_sql(title: str, slug: str, summary: str, cover_src: str, cover_prompt_text: str, spec_json: str) -> str:
    return f"""
INSERT INTO photo_albums (title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, created_by_user_id)
SELECT {sql_quote(title)}, {sql_quote(slug)}, {sql_quote(summary)}, {sql_quote(cover_src)}, {sql_quote(cover_prompt_text)}, {sql_quote(spec_json)}, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM photo_albums WHERE title = {sql_quote(title)} LIMIT 1);

SET @album_id := (SELECT id FROM photo_albums WHERE title = {sql_quote(title)} ORDER BY id DESC LIMIT 1);

UPDATE photo_albums
SET summary = {sql_quote(summary)},
    cover_image_url = {sql_quote(cover_src)},
    cover_prompt = {sql_quote(cover_prompt_text)},
    spec_json = {sql_quote(spec_json)},
    is_active = 1
WHERE id = @album_id;

INSERT INTO photo_album_permissions (album_id, group_id, can_view)
SELECT @album_id, g.id, 1
FROM catn8_groups g
WHERE g.slug IN ('photo-albums-users', 'administrators')
ON DUPLICATE KEY UPDATE can_view = VALUES(can_view);
""".strip()


def upload_sql(sql_text: str, state_dir: Path) -> None:
    sql_path = state_dir / f"family_timeline_step_{dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.sql"
    sql_path.write_text(sql_text, encoding="utf-8")

    base_url = os.environ.get("CATN8_BASE_URL", "https://catn8.us").strip().rstrip("/")
    token = os.environ.get("CATN8_ADMIN_TOKEN", "").strip()
    if not token:
        raise RuntimeError("CATN8_ADMIN_TOKEN is required")

    url = f"{base_url}/api/database_maintenance.php?action=restore_database&admin_token={token}"
    p = subprocess.run(["curl", "-sS", "-X", "POST", "-F", f"backup_file=@{sql_path};type=text/plain", url], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip() or p.stdout.strip())
    payload = json.loads(p.stdout or "{}")
    if not payload.get("success"):
        raise RuntimeError(f"Maintenance restore failed: {payload}")


def load_state(state_file: Path) -> Dict[str, object]:
    if not state_file.exists():
        return {"completed_albums": [], "updated_at": ""}
    try:
        data = json.loads(state_file.read_text(errors="ignore"))
        if not isinstance(data, dict):
            return {"completed_albums": [], "updated_at": ""}
        if not isinstance(data.get("completed_albums"), list):
            data["completed_albums"] = []
        return data
    except Exception:
        return {"completed_albums": [], "updated_at": ""}


def save_state(state_file: Path, state: Dict[str, object]) -> None:
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state["updated_at"] = dt.datetime.now().isoformat()
    state_file.write_text(json.dumps(state, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def main() -> None:
    load_env_files()
    args = parse_args()

    state_file = Path(args.state_file).expanduser().resolve()
    state = load_state(state_file)
    completed = set(str(x) for x in state.get("completed_albums", []))

    photos_db = resolve_photos_db_path(args.photos_db)
    messages_db = Path(os.path.expanduser(args.messages_db)).resolve()
    state_dir = state_file.parent
    export_dir = state_dir / "photos_timeline_exports"
    stage_dir = Path("./photo_albums").resolve()
    state_dir.mkdir(parents=True, exist_ok=True)
    export_dir.mkdir(parents=True, exist_ok=True)
    stage_dir.mkdir(parents=True, exist_ok=True)

    children = [
        ChildConfig(name="Violet", birth_date=parse_date("2021-11-29"), contacts=["Trinity"]),
        ChildConfig(name="Eleanor", birth_date=parse_date("2025-12-31"), contacts=["Trinity"]),
        ChildConfig(name="Lyrielle", birth_date=parse_date("2025-02-21"), contacts=["Elijah", "Marisa", "Lyrielle", "Lyra"]),
    ]

    contact_handles_cache: Dict[str, List[str]] = {}
    alias_map = load_photos_alias_map(photos_db)
    print(f"Loaded {len(alias_map)} Photos filename aliases.")

    album_count = 0
    exported_cache: Dict[str, Optional[Path]] = {}
    page_seq = 0

    sql_prefix = """
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
    """.strip()

    for child in children:
        now = dt.date.today()
        windows = build_album_windows(child, now)
        print(f"{child.name}: {len(windows)} windows planned")

        handles: Set[str] = set()
        for contact in child.contacts:
            if contact not in contact_handles_cache:
                contact_handles_cache[contact] = discover_contact_handles(contact)
            handles.update(contact_handles_cache[contact])
        child_handles = sorted(handles)
        print(f"{child.name}: {len(child_handles)} handle(s)")

        for title, start, end in windows:
            if title in completed:
                continue
            if args.max_albums > 0 and album_count >= args.max_albums:
                save_state(state_file, state)
                print(f"Reached max albums cap ({args.max_albums}).")
                return

            messages = load_messages(messages_db, child_handles, start, end)
            if not messages:
                completed.add(title)
                state["completed_albums"] = sorted(completed)
                save_state(state_file, state)
                print(f"Skip {title}: no messages")
                continue

            pages = []
            for i, msg in enumerate(messages):
                attach_note = ""
                image_rel = ""
                src_name = ""

                raw_name = Path(msg.attachment_filename).name if msg.attachment_filename else ""
                if raw_name:
                    src_name = raw_name
                    attach_note = f"Attachment referenced: {raw_name}."
                    cands: List[str] = []
                    for key in (raw_name.lower(), Path(raw_name).stem.lower()):
                        for cand in alias_map.get(key, []):
                            if cand not in cands:
                                cands.append(cand)
                    if raw_name not in cands:
                        cands.append(raw_name)

                    cache_key = (cands[0] if cands else raw_name).lower()
                    exported = exported_cache.get(cache_key)
                    if cache_key not in exported_cache:
                        exported = safe_photos_export(cands, export_dir)
                        exported_cache[cache_key] = exported

                    if exported and exported.exists():
                        page_seq += 1
                        out_name = f"family_page_{page_seq:06d}.png"
                        out_path = stage_dir / out_name
                        if convert_to_png(exported, out_path):
                            image_rel = f"/photo_albums/{out_name}"
                            attach_note = f"Attachment linked: {raw_name}."
                        else:
                            attach_note = f"Attachment referenced: {raw_name} (image conversion unavailable)."
                    else:
                        attach_note = f"Attachment referenced: {raw_name} (image currently unavailable)."

                caption = make_caption(messages, i, attach_note)
                pages.append((msg.sent_at, caption, image_rel, src_name, msg.text))

            if not pages:
                completed.add(title)
                state["completed_albums"] = sorted(completed)
                save_state(state_file, state)
                print(f"Skip {title}: no pages built")
                continue

            pages.sort(key=lambda x: x[0])
            pages = pages[: max(1, args.max_pages_per_album)]

            style = infer_style([p[1] for p in pages], child.name)
            palette = normalize_csv_tokens(style["dominant_palette"], ["blush", "ivory", "powder blue"])
            materials = normalize_csv_tokens(style["scrapbook_materials"], ["linen", "paper tape", "notes"])
            motifs = normalize_csv_tokens(style["motif_keywords"], ["tiny footprints", "blankets", "first days"])

            spreads = []
            for sidx, (sent_at, caption, image_rel, src_name, raw_text) in enumerate(pages, start=1):
                images = []
                if image_rel:
                    images.append(
                        {
                            "src": image_rel,
                            "captured_at": sent_at.isoformat(),
                            "source_filename": src_name,
                            "caption": caption,
                            "memory_text": caption,
                        }
                    )
                spreads.append(
                    {
                        "spread_number": sidx,
                        "title": "Opening Notes" if sidx == 1 else f"Memory Spread {sidx}",
                        "caption": caption,
                        "raw_text": raw_text,
                        "photo_slots": 1,
                        "embellishments": [motifs[(sidx - 1) % len(motifs)], materials[(sidx - 1) % len(materials)]],
                        "background_prompt": " | ".join(
                            [
                                "[CATN8_SCRAPBOOK_SPREAD_BG_V1]",
                                f"Spread: {sidx}/{len(pages)}",
                                f"Mood: {style['mood']}",
                                f"Memory era: {style['memory_era']}",
                                f"Palette: {', '.join(palette)}",
                                f"Materials: {', '.join(materials)}",
                                f"Motifs: {', '.join(motifs)}",
                            ]
                        ),
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

            summary = f"Auto timeline import for {child.name} ({start.isoformat()} to {end.isoformat()}). {len(pages)} pages."
            cover_src = next((p[2] for p in pages if p[2]), "")
            cp = cover_prompt(title, summary, style)
            slug = sanitize_slug(title)
            album_sql = build_album_sql(title, slug, summary, cover_src, cp, json.dumps(spec, ensure_ascii=True))
            full_sql = sql_prefix + "\n\n" + album_sql + "\n"

            if args.dry_run:
                print(f"DRY RUN prepared: {title} ({len(pages)} pages)")
                album_count += 1
                continue

            upload_sql(full_sql, state_dir)
            completed.add(title)
            state["completed_albums"] = sorted(completed)
            save_state(state_file, state)
            album_count += 1
            print(f"Completed: {title} ({len(pages)} pages)")

    print("Timeline import finished.")


if __name__ == "__main__":
    main()
