#!/usr/bin/env python3
"""Celebr8 iMessage outbox relay for catn8.us.

Polls the authenticated relay API, atomically claims queued messages, sends via
`imsg send`, then reports sent/failed.

After each send cycle, optionally wakes Celebr8r for pending Ask-Celebr8r
requests via a Grok Bot routine webhook (see env vars below).

Also (read-only) scans ~/Library/Messages/chat.db for new inbound guest texts /
tapbacks matching upcoming-party guests, queues type=rsvp Ask-Celebr8r requests,
then the wake step notifies Celebr8r. Never backfills on first run.

Config (env or defaults):
  CELEBR8_RELAY_BASE_URL   default https://catn8.us
  CELEBR8_RELAY_TOKEN      required (or CELEBR8_RELAY_TOKEN_FILE)
  CELEBR8_RELAY_TOKEN_FILE default <repo>/.local/state/celebr8/relay-api-token
                           Compil8r: /Users/jongraves/.local/state/catn8/celebr8/relay-api-token
  CELEBR8_RELAY_LIMIT      default 10
  CELEBR8_RELAY_ONCE       if 1, run a single poll cycle then exit
  CELEBR8_RELAY_INTERVAL   seconds between polls (default 15)
  CELEBR8_IMSG_BIN         path to imsg (default: imsg on PATH)
  CELEBR8_IMSG_DB          override chat.db path (default ~/Library/Messages/chat.db)
  CELEBR8_IMSG_LAST_ROWID_FILE  default ~/.local/state/catn8/celebr8/imsg-last-rowid

Celebr8r webhook wake (optional; skipped quietly if unset):
  CELEBR8_AGENT_WEBHOOK_URL        Grok Bot routine POST URL
  CELEBR8_AGENT_WEBHOOK_KEY_FILE   file containing the routine sender key
  CELEBR8_AGENT_WEBHOOK_KEY_HEADER optional header name for the key
                                   (default Authorization). If Authorization,
                                   value is sent as "Bearer <key>" (Grok Bot
                                   routine panel default). For any other header
                                   name, the raw key is sent as the value.

Never logs the webhook key. Does not follow redirects when posting the wake.
Never logs message bodies or unrelated chat.db content.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_token() -> str:
    env_token = (os.environ.get("CELEBR8_RELAY_TOKEN") or "").strip()
    if env_token:
        return env_token
    token_file = Path(
        os.environ.get(
            "CELEBR8_RELAY_TOKEN_FILE",
            str(repo_root() / ".local/state/celebr8/relay-api-token"),
        )
    )
    if token_file.is_file():
        return token_file.read_text(encoding="utf-8").strip()
    raise SystemExit(
        f"Missing relay token. Set CELEBR8_RELAY_TOKEN or create {token_file}"
    )


def api_request(
    base: str,
    token: str,
    method: str,
    action: str,
    payload: dict[str, Any] | None = None,
    query: str = "",
) -> dict[str, Any]:
    url = f"{base.rstrip('/')}/api/celebr8_relay.php?action={action}{query}"
    data = None
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {action}: {err_body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error for {action}: {exc}") from exc
    try:
        parsed = json.loads(body) if body else {}
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON for {action}: {body[:200]}") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError(f"Unexpected response for {action}")
    return parsed


def send_imsg(to_address: str, text: str, imsg_bin: str) -> None:
    cmd = [imsg_bin, "send", "--to", to_address, "--text", text]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or f"exit {result.returncode}").strip()
        raise RuntimeError(detail[:1500])


def load_webhook_key(path: Path) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8").strip()


def post_agent_webhook(url: str, key: str, header_name: str, payload: dict[str, Any]) -> None:
    """POST a minimal wake payload. Never logs the key. No redirects."""
    header_name = (header_name or "Authorization").strip() or "Authorization"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if header_name.lower() == "authorization":
        # Grok Bot routine panel: Authorization: Bearer <key>
        value = key if key.lower().startswith("bearer ") else f"Bearer {key}"
        headers["Authorization"] = value
    else:
        headers[header_name] = key

    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    # Refuse redirects so the Authorization header cannot be forwarded elsewhere.
    class _NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
            raise urllib.error.HTTPError(newurl, code, f"redirect refused ({msg})", headers, fp)

    opener = urllib.request.build_opener(_NoRedirect())
    with opener.open(req, timeout=30) as resp:
        # Drain body; do not print (server might echo credentials).
        _ = resp.read()
        if int(getattr(resp, "status", 200) or 200) >= 400:
            raise RuntimeError(f"webhook HTTP {resp.status}")


def wake_celebr8r(base: str, token: str) -> int:
    webhook_url = (os.environ.get("CELEBR8_AGENT_WEBHOOK_URL") or "").strip()
    key_file = (os.environ.get("CELEBR8_AGENT_WEBHOOK_KEY_FILE") or "").strip()
    if not webhook_url or not key_file:
        return 0
    key = load_webhook_key(Path(key_file))
    if not key:
        print("celebr8r wake skipped: webhook key file empty or missing", flush=True)
        return 0
    header_name = (os.environ.get("CELEBR8_AGENT_WEBHOOK_KEY_HEADER") or "Authorization").strip()

    pending = api_request(base, token, "GET", "list_pending_requests", query="&limit=20")
    requests = pending.get("requests") or []
    woken = 0
    for req in requests:
        if not isinstance(req, dict):
            continue
        rid = int(req.get("id") or 0)
        if rid <= 0:
            continue
        party_id = req.get("party_id")
        preview = str(req.get("preview") or req.get("request_text") or "")[:160]
        payload = {
            "request_id": rid,
            "party_id": party_id,
            "preview": preview,
            "request_type": req.get("request_type") or req.get("type") or "text",
        }
        try:
            post_agent_webhook(webhook_url, key, header_name, payload)
            api_request(
                base,
                token,
                "POST",
                "mark_request_notified",
                {"request_id": rid},
            )
            print(f"woke celebr8r request_id={rid} party_id={party_id}", flush=True)
            woken += 1
        except Exception as exc:  # noqa: BLE001 - continue other requests
            # Do not include key or full URL with credentials.
            print(f"celebr8r wake failed request_id={rid}: {type(exc).__name__}", file=sys.stderr, flush=True)
    return woken


def normalize_phone(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw or "@" in raw:
        return ""
    digits = re.sub(r"\D+", "", raw)
    if not digits:
        return ""
    if len(digits) == 10:
        return "+1" + digits
    if len(digits) == 11 and digits[0] == "1":
        return "+" + digits
    if raw.startswith("+"):
        return "+" + digits
    return "+" + digits


def last_rowid_path() -> Path:
    override = (os.environ.get("CELEBR8_IMSG_LAST_ROWID_FILE") or "").strip()
    if override:
        return Path(override)
    return Path.home() / ".local" / "state" / "catn8" / "celebr8" / "imsg-last-rowid"


def chat_db_path() -> Path:
    override = (os.environ.get("CELEBR8_IMSG_DB") or "").strip()
    if override:
        return Path(override)
    return Path.home() / "Library" / "Messages" / "chat.db"


def read_last_rowid(path: Path) -> int | None:
    if not path.is_file():
        return None
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def write_last_rowid(path: Path, rowid: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(str(int(rowid)) + "\n", encoding="utf-8")


def table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    # PRAGMA table_info: cid, name, type, notnull, dflt_value, pk
    return {str(r[1]) for r in rows}


def open_chat_db_readonly(db_path: Path) -> sqlite3.Connection | None:
    if not db_path.is_file():
        print(f"inbound skip: chat.db not found at {db_path}", flush=True)
        return None
    uri = f"file:{db_path}?mode=ro"
    try:
        conn = sqlite3.connect(uri, uri=True, timeout=5)
        conn.row_factory = sqlite3.Row
        # Force a tiny read so Full Disk Access failures surface here.
        conn.execute("SELECT 1").fetchone()
        return conn
    except sqlite3.Error as exc:
        print(
            f"inbound skip: cannot open chat.db read-only (Full Disk Access?): {type(exc).__name__}",
            flush=True,
        )
        return None


def apple_epoch_to_iso(value: Any) -> str:
    """Convert Messages date (nanoseconds since 2001-01-01) to ISO-8601 when possible."""
    try:
        n = int(value)
    except (TypeError, ValueError):
        return ""
    # Cocoa epoch: 2001-01-01 UTC.
    if n > 10_000_000_000_000:  # nanoseconds
        seconds = n / 1_000_000_000 + 978307200
    elif n > 10_000_000_000:  # microseconds-ish
        seconds = n / 1_000_000 + 978307200
    else:
        seconds = n + 978307200
    try:
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(seconds))
    except (OverflowError, OSError, ValueError):
        return ""


def fetch_inbound_candidates(
    conn: sqlite3.Connection,
    after_rowid: int,
) -> tuple[list[dict[str, Any]], int]:
    """Return (candidate messages matched later by phone), max_rowid_seen."""
    msg_cols = table_columns(conn, "message")
    handle_cols = table_columns(conn, "handle")
    required_msg = {"ROWID", "guid", "is_from_me"}
    if not required_msg.issubset(msg_cols):
        print("inbound skip: unexpected message table columns", flush=True)
        return [], after_rowid
    if "id" not in handle_cols or "ROWID" not in handle_cols:
        print("inbound skip: unexpected handle table columns", flush=True)
        return [], after_rowid

    text_col = "text" if "text" in msg_cols else None
    date_col = "date" if "date" in msg_cols else None
    handle_col = "handle_id" if "handle_id" in msg_cols else None
    assoc_type_col = "associated_message_type" if "associated_message_type" in msg_cols else None
    assoc_guid_col = "associated_message_guid" if "associated_message_guid" in msg_cols else None

    max_row = conn.execute("SELECT COALESCE(MAX(ROWID), 0) AS m FROM message").fetchone()
    max_rowid = int(max_row["m"] if max_row else 0)
    if after_rowid <= 0:
        return [], max_rowid

    select_bits = ["m.ROWID AS rowid", "m.guid AS guid", "m.is_from_me AS is_from_me"]
    if text_col:
        select_bits.append(f"m.{text_col} AS text")
    if date_col:
        select_bits.append(f"m.{date_col} AS date_raw")
    if handle_col:
        select_bits.append(f"m.{handle_col} AS handle_id")
    if assoc_type_col:
        select_bits.append(f"m.{assoc_type_col} AS associated_message_type")
    if assoc_guid_col:
        select_bits.append(f"m.{assoc_guid_col} AS associated_message_guid")
    select_bits.append("h.id AS handle_address")

    join_sql = ""
    if handle_col:
        join_sql = f"LEFT JOIN handle h ON h.ROWID = m.{handle_col}"
    else:
        join_sql = "LEFT JOIN handle h ON 0"

    # Include normal inbound (is_from_me=0). Also include tapback/reaction rows when
    # associated_message_type is set (macOS uses non-zero values for reactions).
    where = "m.ROWID > ? AND (m.is_from_me = 0"
    if assoc_type_col:
        where += f" OR (m.{assoc_type_col} IS NOT NULL AND m.{assoc_type_col} <> 0)"
    where += ")"

    sql = (
        f"SELECT {', '.join(select_bits)} FROM message m {join_sql} "
        f"WHERE {where} ORDER BY m.ROWID ASC LIMIT 500"
    )
    rows = conn.execute(sql, (after_rowid,)).fetchall()
    out: list[dict[str, Any]] = []
    for row in rows:
        rowid = int(row["rowid"] or 0)
        if rowid > max_rowid:
            max_rowid = rowid
        guid = str(row["guid"] or "").strip()
        if not guid or rowid <= 0:
            continue
        is_from_me = int(row["is_from_me"] or 0) == 1
        assoc_type = int(row["associated_message_type"] or 0) if assoc_type_col else 0
        is_reaction = assoc_type != 0
        # Skip our own non-reaction sends; allow inbound + reactions.
        if is_from_me and not is_reaction:
            continue
        if is_from_me and is_reaction:
            # Own reaction on someone else's message — ignore for guest RSVP matching.
            continue
        address = str(row["handle_address"] or "").strip()
        phone = normalize_phone(address)
        if not phone:
            continue
        text = str(row["text"] or "") if text_col else ""
        if is_reaction and not text:
            text = f"[reaction type={assoc_type}]"
        date_iso = apple_epoch_to_iso(row["date_raw"]) if date_col else ""
        out.append(
            {
                "rowid": rowid,
                "message_guid": guid,
                "phone": phone,
                "text": text,
                "date": date_iso,
                "is_reaction": is_reaction,
            }
        )
    return out, max_rowid


def queue_inbound_rsvp(base: str, token: str) -> int:
    """Scan chat.db for new guest texts and create rsvp requests. Returns created count."""
    state_path = last_rowid_path()
    db_path = chat_db_path()
    conn = open_chat_db_readonly(db_path)
    if conn is None:
        return 0
    try:
        last = read_last_rowid(state_path)
        if last is None:
            max_row = conn.execute("SELECT COALESCE(MAX(ROWID), 0) AS m FROM message").fetchone()
            max_rowid = int(max_row["m"] if max_row else 0)
            write_last_rowid(state_path, max_rowid)
            print(f"inbound first-run: set last-seen ROWID={max_rowid} (no backfill)", flush=True)
            return 0

        candidates, max_seen = fetch_inbound_candidates(conn, last)
        if max_seen < last:
            max_seen = last

        if not candidates:
            if max_seen > last:
                write_last_rowid(state_path, max_seen)
            return 0

        upcoming = api_request(base, token, "GET", "list_upcoming_guests")
        parties = upcoming.get("parties") or []
        phone_index: dict[str, list[tuple[int, int]]] = {}
        for party in parties:
            if not isinstance(party, dict):
                continue
            party_id = int(party.get("party_id") or 0)
            if party_id <= 0:
                continue
            for guest in party.get("guests") or []:
                if not isinstance(guest, dict):
                    continue
                guest_id = int(guest.get("guest_id") or 0)
                phone = normalize_phone(str(guest.get("phone") or ""))
                if guest_id <= 0 or not phone:
                    continue
                phone_index.setdefault(phone, []).append((party_id, guest_id))

        by_party: dict[int, list[dict[str, Any]]] = {}
        matched = 0
        for msg in candidates:
            phone = msg["phone"]
            matches = phone_index.get(phone) or []
            if not matches:
                continue
            matched += 1
            for party_id, guest_id in matches:
                by_party.setdefault(party_id, []).append(
                    {
                        "guest_id": guest_id,
                        "phone": phone,
                        "message_guid": msg["message_guid"],
                        "rowid": msg["rowid"],
                        "date": msg["date"],
                        "text": msg["text"],
                        "is_reaction": bool(msg["is_reaction"]),
                    }
                )

        created_total = 0
        if by_party:
            payload = {
                "parties": [
                    {"party_id": pid, "messages": msgs}
                    for pid, msgs in sorted(by_party.items())
                ]
            }
            result = api_request(base, token, "POST", "create_rsvp_requests", payload)
            created_total = int(result.get("created_count") or len(result.get("created") or []))
            print(
                f"inbound queued rsvp requests={created_total} matched_msgs={matched} parties={len(by_party)}",
                flush=True,
            )
        else:
            print(f"inbound: {len(candidates)} new msgs, 0 guest matches", flush=True)

        write_last_rowid(state_path, max_seen)
        return created_total
    finally:
        conn.close()


def process_once(base: str, token: str, limit: int, imsg_bin: str, claimed_by: str) -> int:
    queued = api_request(base, token, "GET", "fetch_queued", query=f"&limit={limit}")
    messages = queued.get("messages") or []
    handled = 0
    if messages:
        ids = [int(m["id"]) for m in messages if isinstance(m, dict) and m.get("id")]
        claim = api_request(
            base,
            token,
            "POST",
            "claim",
            {"message_ids": ids, "claimed_by": claimed_by},
        )
        claimed = claim.get("claimed") or []
        for msg in claimed:
            mid = int(msg.get("id") or 0)
            to_address = str(msg.get("to_address") or "").strip()
            body = str(msg.get("body") or "")
            if mid <= 0 or not to_address:
                continue
            try:
                send_imsg(to_address, body, imsg_bin)
                api_request(base, token, "POST", "mark_sent", {"message_id": mid})
                print(f"sent message_id={mid} to={to_address}", flush=True)
            except Exception as exc:  # noqa: BLE001 - report every failure to API
                api_request(
                    base,
                    token,
                    "POST",
                    "mark_failed",
                    {"message_id": mid, "error": str(exc)},
                )
                print(f"failed message_id={mid} to={to_address}: {exc}", flush=True)
            handled += 1

    inbound_created = 0
    try:
        # After send; before wake so new type=rsvp pending requests are woken this tick.
        inbound_created = queue_inbound_rsvp(base, token)
    except Exception as exc:  # noqa: BLE001
        print(f"inbound cycle error: {exc}", file=sys.stderr, flush=True)

    try:
        woken = wake_celebr8r(base, token)
        if woken == 0 and handled == 0 and inbound_created == 0:
            print("idle: no claimed messages, no inbound rsvp, no pending celebr8r wakes", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"celebr8r wake cycle error: {exc}", file=sys.stderr, flush=True)

    return handled


def main() -> int:
    base = (os.environ.get("CELEBR8_RELAY_BASE_URL") or "https://catn8.us").strip()
    token = load_token()
    limit = max(1, min(100, int(os.environ.get("CELEBR8_RELAY_LIMIT") or "10")))
    interval = max(5, int(os.environ.get("CELEBR8_RELAY_INTERVAL") or "15"))
    once = (os.environ.get("CELEBR8_RELAY_ONCE") or "").strip() in {"1", "true", "yes"}
    imsg_bin = (os.environ.get("CELEBR8_IMSG_BIN") or "imsg").strip()
    claimed_by = (os.environ.get("CELEBR8_RELAY_CLAIMED_BY") or os.uname().nodename).strip()

    print(f"celebr8-text-relay starting base={base} once={once}", flush=True)
    while True:
        try:
            process_once(base, token, limit, imsg_bin, claimed_by)
        except Exception as exc:  # noqa: BLE001
            print(f"relay cycle error: {exc}", file=sys.stderr, flush=True)
        if once:
            return 0
        time.sleep(interval)


if __name__ == "__main__":
    raise SystemExit(main())
