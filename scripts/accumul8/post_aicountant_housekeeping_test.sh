#!/usr/bin/env bash
# Local check for the housekeeping POST helper. Not deployed.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
script="$root/scripts/accumul8/post_aicountant_housekeeping.sh"
failures=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; failures=$((failures + 1)); }

if CATN8_ADMIN_TOKEN= bash "$script" > /tmp/hk-empty.txt 2>&1; then
  fail "empty token should exit non-zero"
else
  if grep -q 'Missing GitHub secret CATN8_ADMIN_TOKEN' /tmp/hk-empty.txt; then
    pass "empty token names CATN8_ADMIN_TOKEN"
  else
    fail "empty token message"
  fi
fi

python3 - <<'PY' &
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length)
        auth = self.headers.get('Authorization', '')
        record = {
            'path': self.path,
            'has_bearer': auth.startswith('Bearer ') and len(auth) > 7,
            'token_in_url': 'admin_token' in self.path or 'token=' in self.path,
            'token_in_body': b'admin_token' in body,
        }
        open('/tmp/hk-request.json', 'w').write(json.dumps(record))
        mode = open('/tmp/hk-mode.txt').read().strip()
        if mode == '500':
            payload = json.dumps({'success': False, 'error': 'boom'}).encode()
            self.send_response(500)
        else:
            payload = json.dumps({
                'success': True,
                'attention_needed': 0,
                'balance_books': {'synced_connection_count': 2, 'error_connection_count': 0},
                'plaid_health': {'healthy': 1, 'problem_count': 0, 'email_decision': 'none', 'email_sent': 0},
            }).encode()
            self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        return

ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
PY
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 0.3

echo 500 > /tmp/hk-mode.txt
if ACCUMUL8_HOUSEKEEPING_URL='http://127.0.0.1:8765/api/accumul8_housekeeping.php' CATN8_ADMIN_TOKEN='test-token-value' ACCUMUL8_OWNER_USER_ID=1 bash "$script" > /tmp/hk-500.txt 2>&1; then
  fail "HTTP 500 should fail the script"
else
  if grep -q 'Housekeeping HTTP 500' /tmp/hk-500.txt && grep -q 'Housekeeping failed with HTTP 500' /tmp/hk-500.txt; then
    pass "HTTP 500 fails visibly"
  else
    fail "HTTP 500 output"
    cat /tmp/hk-500.txt
  fi
fi

echo 200 > /tmp/hk-mode.txt
if ACCUMUL8_HOUSEKEEPING_URL='http://127.0.0.1:8765/api/accumul8_housekeeping.php' CATN8_ADMIN_TOKEN='test-token-value' ACCUMUL8_OWNER_USER_ID=1 bash "$script" > /tmp/hk-200.txt 2>&1; then
  if grep -q 'Housekeeping HTTP 200' /tmp/hk-200.txt && grep -q '"plaid_healthy": 1' /tmp/hk-200.txt && ! grep -q 'test-token-value' /tmp/hk-200.txt; then
    pass "HTTP 200 summarizes without printing the token"
  else
    fail "HTTP 200 output leaked or missed the summary"
    cat /tmp/hk-200.txt
  fi
else
  fail "HTTP 200 should pass"
  cat /tmp/hk-200.txt
fi

python3 - <<'PY'
import json
record = json.load(open('/tmp/hk-request.json'))
assert record['has_bearer'] is True
assert record['token_in_url'] is False
assert record['token_in_body'] is False
assert 'admin_token' not in record['path']
print('PASS token stays in the Authorization header')
PY

if [[ "$failures" -gt 0 ]]; then
  echo "$failures failed"
  exit 1
fi
echo "all passed"
