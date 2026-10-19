#!/usr/bin/env bash
# POST Accumul8 housekeeping. The admin token stays in the Authorization header.
# It is never placed in the URL, the JSON body, or a normal log line.
set -euo pipefail

if [[ -z "${CATN8_ADMIN_TOKEN:-}" ]]; then
  echo "Missing GitHub secret CATN8_ADMIN_TOKEN"
  exit 1
fi

if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
  echo "::add-mask::${CATN8_ADMIN_TOKEN}"
fi

owner="${ACCUMUL8_OWNER_USER_ID:-1}"
if [[ ! "$owner" =~ ^[1-9][0-9]*$ ]]; then
  echo "ACCUMUL8_OWNER_USER_ID must be a positive integer"
  exit 1
fi

url="${ACCUMUL8_HOUSEKEEPING_URL:-https://catn8.us/api/accumul8_housekeeping.php}"
case "$url" in
  *\?*|*'admin_token'*|*'#'*)
    echo "Housekeeping URL must not include a query string or token"
    exit 1
    ;;
esac

payload="$(printf '{"owner_user_id":%s,"days_ahead":90,"send_email":1,"create_notification_rule":1,"email_on_attention_only":1}' "$owner")"
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

http_code="$(
  curl --silent --show-error --max-time 240 \
    -o "$body_file" \
    -w '%{http_code}' \
    -X POST "$url" \
    -H "Authorization: Bearer ${CATN8_ADMIN_TOKEN}" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json' \
    --data "$payload"
)"

python3 - "$http_code" "$body_file" <<'PY'
import json
import sys

code = sys.argv[1]
path = sys.argv[2]
print(f"Housekeeping HTTP {code}")
try:
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
except Exception:
    print("Housekeeping response was not JSON")
    sys.exit(0 if code.startswith("2") else 1)

if not isinstance(payload, dict):
    print("Housekeeping response was not a JSON object")
    sys.exit(0 if code.startswith("2") else 1)

def count_at(obj, *keys):
    current = obj
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    if isinstance(current, bool):
        return int(current)
    if isinstance(current, int):
        return current
    return None

summary = {
    "success": payload.get("success"),
    "error": payload.get("error") if isinstance(payload.get("error"), str) else "",
    "attention_needed": count_at(payload, "attention_needed"),
    "synced_connection_count": count_at(payload, "balance_books", "synced_connection_count"),
    "error_connection_count": count_at(payload, "balance_books", "error_connection_count"),
    "plaid_healthy": count_at(payload, "plaid_health", "healthy"),
    "plaid_problem_count": count_at(payload, "plaid_health", "problem_count"),
    "plaid_email_decision": payload.get("plaid_health", {}).get("email_decision") if isinstance(payload.get("plaid_health"), dict) else None,
    "plaid_email_sent": count_at(payload, "plaid_health", "email_sent"),
}
# Drop empty error so a healthy body does not look like a failure.
if summary["error"] == "":
    del summary["error"]
print(json.dumps(summary, sort_keys=True))
PY

case "$http_code" in
  2??) ;;
  *)
    echo "Housekeeping failed with HTTP ${http_code}"
    exit 1
    ;;
esac
