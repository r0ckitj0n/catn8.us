#!/bin/bash
set -euo pipefail

# scripts/deploy_dist.sh
# 1. Rebuilds the Vite assets (via scripts/release.sh --no-deploy)
# 2. Uploads the freshly generated dist/ directory to the configured SFTP target
#
# Required config (preferred):
#   CATN8_DEPLOY_HOST, CATN8_DEPLOY_USER
# Required secret (env or macOS Keychain via scripts/secrets/env_or_keychain.sh):
#   CATN8_DEPLOY_PASS
#
# Optional overrides:
#   SFTP_HOST, SFTP_USER, SFTP_PASSWORD (explicitly override CATN8_* if set)
# Optional env vars:
#   SFTP_PORT (default 22)
#   SFTP_REMOTE_PATH (default /)
#   SFTP_REMOTE_DIST (default "dist" relative to SFTP_REMOTE_PATH)
#   CATN8_DEPLOY_DELETE=0 to keep remote files that no longer exist locally (default deletes)
#
# Usage: ./scripts/deploy_dist.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" )" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Load secrets from env or macOS Keychain
# shellcheck disable=SC1091
source "$PROJECT_ROOT/scripts/secrets/env_or_keychain.sh"

 # Load .env.local if present, else .env
 ENV_FILE_LOCAL="$PROJECT_ROOT/.env.local"
 ENV_FILE="$PROJECT_ROOT/.env"
 if [[ -f "${ENV_FILE_LOCAL}" ]]; then
   set -a
   # shellcheck disable=SC1090
   . "${ENV_FILE_LOCAL}"
   set +a
 elif [[ -f "${ENV_FILE}" ]]; then
   set -a
   # shellcheck disable=SC1090
   . "${ENV_FILE}"
   set +a
 fi

# Prefer centralized CATN8_* deploy vars. Allow explicit SFTP_* override if already set.
: "${SFTP_HOST:=${CATN8_DEPLOY_HOST:-}}"
: "${SFTP_USER:=${CATN8_DEPLOY_USER:-}}"

if [[ -z "${SFTP_PASSWORD:-}" ]]; then
  catn8_secret_require CATN8_DEPLOY_PASS
  SFTP_PASSWORD="${CATN8_DEPLOY_PASS}"
fi

: "${SFTP_REMOTE_PATH:=/}"

if [[ -z "${SFTP_HOST:-}" || -z "${SFTP_USER:-}" || -z "${SFTP_PASSWORD:-}" ]]; then
  echo "[deploy_dist] Error: SFTP credentials missing (SFTP_HOST / SFTP_USER / SFTP_PASSWORD)" >&2
  exit 1
fi

PORT="${SFTP_PORT:-22}"
BASE_REMOTE_PATH="${SFTP_REMOTE_PATH:-/}"
# Normalize double slashes
BASE_REMOTE_PATH="/${BASE_REMOTE_PATH#/}"
REMOTE_DIST_SUBPATH="${SFTP_REMOTE_DIST:-dist}"
REMOTE_DIST_PATH="${BASE_REMOTE_PATH%/}/${REMOTE_DIST_SUBPATH#/}"

DELETE_FLAG="--delete"
if [[ "${CATN8_DEPLOY_DELETE:-1}" = "0" ]]; then
  DELETE_FLAG=""
fi

if ! command -v lftp >/dev/null 2>&1; then
  echo "[deploy_dist] Error: lftp is required (brew install lftp)" >&2
  exit 1
fi

if [[ "${CATN8_SKIP_RELEASE_BUILD:-0}" != "1" ]]; then
  if [[ ! -x "scripts/release.sh" ]]; then
    echo "[deploy_dist] Error: scripts/release.sh not found or not executable" >&2
    exit 1
  fi
  echo "[deploy_dist] Running release.sh build (no deploy) to ensure a clean dist build..."
  bash scripts/release.sh --no-deploy
fi

echo "[deploy_dist] Uploading dist/ to $SFTP_HOST:$PORT$REMOTE_DIST_PATH ..."
COMMAND_FILE="$(mktemp deploy_dist.XXXXXX)"
cat > "$COMMAND_FILE" <<EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
open sftp://$SFTP_USER:$SFTP_PASSWORD@$SFTP_HOST:$PORT
mirror --reverse $DELETE_FLAG --verbose --ignore-time --no-perms \
  dist $REMOTE_DIST_PATH
bye
EOL

if lftp -f "$COMMAND_FILE"; then
  echo "[deploy_dist] ✅ Dist uploaded successfully."
else
  echo "[deploy_dist] ❌ Dist upload failed."
  rm -f "$COMMAND_FILE"
  exit 1
fi
rm -f "$COMMAND_FILE"

echo "[deploy_dist] Done. Remember to clear any downstream caches (Cloudflare, nginx microcache, OPcache) if they serve stale assets."
