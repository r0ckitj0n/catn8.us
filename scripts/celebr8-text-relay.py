#!/usr/bin/env python3
"""Celebr8 iMessage outbox relay for catn8.us.

Polls the authenticated relay API, atomically claims queued messages, sends via
`imsg send`, then reports sent/failed.

After each send cycle, optionally wakes Celebr8r for pending Ask-Celebr8r
requests via a Grok Bot routine webhook (see env vars below).

Config (env or defaults):
  CELEBR8_RELAY_BASE_URL   default https://catn8.us
  CELEBR8_RELAY_TOKEN      required (or CELEBR8_RELAY_TOKEN_FILE)
  CELEBR8_RELAY_TOKEN_FILE default <repo>/.local/state/celebr8/relay-api-token
                           Compil8r: /Users/jongraves/.local/state/catn8/celebr8/relay-api-token
  CELEBR8_RELAY_LIMIT      default 10
  CELEBR8_RELAY_ONCE       if 1, run a single poll cycle then exit
  CELEBR8_RELAY_INTERVAL   seconds between polls (default 15)
  CELEBR8_IMSG_BIN         path to imsg (default: imsg on PATH)

Celebr8r webhook wake (optional; skipped quietly if unset):
  CELEBR8_AGENT_WEBHOOK_URL        Grok Bot routine POST URL
  CELEBR8_AGENT_WEBHOOK_KEY_FILE   file containing the routine sender key
  CELEBR8_AGENT_WEBHOOK_KEY_HEADER optional header name for the key
                                   (default Authorization). If Authorization,
                                   value is sent as "Bearer <key>" (Grok Bot
                                   routine panel default). For any other header
                                   name, the raw key is sent as the value.

Never logs the webhook key. Does not follow redirects when posting the wake.
"""

from __future__ import annotations

import json
import os
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
    opener = urllib.request.build_opener(urllib.request.HTTPHandler())
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

    try:
        woken = wake_celebr8r(base, token)
        if woken == 0 and handled == 0:
            print("idle: no claimed messages, no pending celebr8r wakes", flush=True)
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
