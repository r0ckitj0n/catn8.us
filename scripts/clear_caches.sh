#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

log() {
  printf '[clear_caches.sh] %s\n' "$1"
}

log 'Clearing PHP OPCache (if enabled)...'
php -r 'if (function_exists("opcache_reset")) { opcache_reset(); echo "OPcache reset\n"; } else { echo "OPcache not enabled\n"; }' || true

log 'Clearing APCu cache (if enabled)...'
php -r 'if (function_exists("apcu_clear_cache")) { apcu_clear_cache(); echo "APCu cache cleared\n"; } else { echo "APCu not enabled\n"; }' || true

TMP_BASE="${TMPDIR:-/tmp}"
log "Removing temp microcache files under $TMP_BASE..."
find "$TMP_BASE" -maxdepth 1 -name 'catn8_cache_*.json' -print -delete 2>/dev/null || true

log "Removing temp microcache files under $TMP_BASE/catn8_cache/..."
find "$TMP_BASE/catn8_cache" -maxdepth 1 -name '*.json' -print -delete 2>/dev/null || true
# Also clear redundant copies under /tmp in case TMPDIR differs
if [[ "$TMP_BASE" != "/tmp" ]]; then
  find /tmp -maxdepth 1 -name 'catn8_cache_*.json' -print -delete 2>/dev/null || true
  find /tmp/catn8_cache -maxdepth 1 -name '*.json' -print -delete 2>/dev/null || true
fi

log 'Cache clearing complete.'
