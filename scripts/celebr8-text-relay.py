#!/usr/bin/env python3
"""Celebr8 iMessage outbox relay for catn8.us.

Polls the authenticated relay API, atomically claims queued messages, sends via
`imsg send`, then reports sent/failed.

Config (env or defaults):
  CELEBR8_RELAY_BASE_URL   default https://catn8.us
  CELEBR8_RELAY_TOKEN      required (or CELEBR8_RELAY_TOKEN_FILE)
  CELEBR8_RELAY_TOKEN_FILE default <repo>/.local/state/celebr8/relay-api-token
  CELEBR8_RELAY_LIMIT      default 10
  CELEBR8_RELAY_ONCE       if 1, run a single poll cycle then exit
  CELEBR8_RELAY_INTERVAL   seconds between polls (default 15)
  CELEBR8_IMSG_BIN         path to imsg (default: imsg on PATH)
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


def process_once(base: str, token: str, limit: int, imsg_bin: str, claimed_by: str) -> int:
    queued = api_request(base, token, "GET", "fetch_queued", query=f"&limit={limit}")
    messages = queued.get("messages") or []
    if not messages:
        return 0

    ids = [int(m["id"]) for m in messages if isinstance(m, dict) and m.get("id")]
    claim = api_request(
        base,
        token,
        "POST",
        "claim",
        {"message_ids": ids, "claimed_by": claimed_by},
    )
    claimed = claim.get("claimed") or []
    handled = 0
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
            n = process_once(base, token, limit, imsg_bin, claimed_by)
            if n == 0:
                print("idle: no claimed messages", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"relay cycle error: {exc}", file=sys.stderr, flush=True)
        if once:
            return 0
        time.sleep(interval)


if __name__ == "__main__":
    raise SystemExit(main())
