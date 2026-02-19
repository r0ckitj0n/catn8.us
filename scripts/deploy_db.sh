#!/usr/bin/env bash
set -euo pipefail

# End-to-end helper to copy the local dev DB to production.
# Steps:
#   1. Dump local DB (scripts/db/dump_local_db.sh --gzip)
#   2. Upload dump to live server via SFTP (resume enabled)
#   3. Trigger the restore API on the live site
#
# Usage: scripts/deploy_db.sh [--skip-upload] [--skip-restore]

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Load secrets from env or macOS Keychain
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/secrets/env_or_keychain.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/deploy_db.sh [--skip-upload] [--skip-restore]

Creates a fresh dev dump, uploads it to the live server, and restores it via the
existing REST API.

Required config:
  CATN8_DEPLOY_HOST        Live SFTP host (in .env/.env.local or exported env)
  CATN8_DEPLOY_USER        Live SFTP username (in .env/.env.local or exported env)

Required secrets (env or macOS Keychain via scripts/secrets/env_or_keychain.sh):
  CATN8_DEPLOY_PASS        Live SFTP password
  CATN8_ADMIN_TOKEN        Admin token for /api/database_maintenance.php

Database config (used by dump helpers):
  CATN8_DB_LOCAL_*         Local dev DB (for dump)
  CATN8_DB_LIVE_*          Live DB (only needed by some fallback helpers)

Optional overrides:
  CATN8_DEPLOY_BASE_URL   Base URL for the live site (default https://catn8.us)
  CATN8_REMOTE_SQL_DIR    Remote folder for SQL dumps (default backups/sql)
USAGE
}

SKIP_UPLOAD=0
SKIP_RESTORE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-upload)
      SKIP_UPLOAD=1
      shift
      ;;
    --skip-restore)
      SKIP_RESTORE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

ENV_FILE_LOCAL="$ROOT_DIR/.env.local"
ENV_FILE="$ROOT_DIR/.env"
if [[ -f "$ENV_FILE_LOCAL" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE_LOCAL"
  set +a
elif [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_var() {
  local key="$1" value="${!1:-}"
  if [[ -z "$value" ]]; then
    echo "Error: $key must be set in .env" >&2
    exit 1
  fi
}

require_var CATN8_DEPLOY_HOST
require_var CATN8_DEPLOY_USER
catn8_secret_require CATN8_DEPLOY_PASS
catn8_secret_require CATN8_ADMIN_TOKEN

REMOTE_SQL_DIR="${CATN8_REMOTE_SQL_DIR:-backups/sql}"
RESTORE_BASE="${CATN8_DEPLOY_BASE_URL:-https://catn8.us}"

TMP_LOG="$(mktemp)"
trap 'rm -f "$TMP_LOG"' EXIT

log 'Creating compressed local database dump (scripts/db/dump_local_db.sh --gzip)...'
bash scripts/db/dump_local_db.sh --gzip | tee "$TMP_LOG"

DUMP_PATH=$(grep -Eo '/.+local_db_dump_[0-9-]+_[0-9-]+\.sql(\.gz)?' "$TMP_LOG" | tail -n 1)
if [[ -z "${DUMP_PATH:-}" || ! -f "$DUMP_PATH" ]]; then
  echo 'Failed to locate dump path in scripts/db/dump_local_db.sh output.' >&2
  exit 1
fi

DUMP_BASENAME="$(basename "$DUMP_PATH")"
log "Dump created at $DUMP_PATH"

if [[ $SKIP_UPLOAD -eq 0 ]]; then
  log "Uploading $DUMP_BASENAME to ${CATN8_DEPLOY_HOST}:${REMOTE_SQL_DIR} (resume enabled)..."
  lftp -u "${CATN8_DEPLOY_USER}","${CATN8_DEPLOY_PASS}" "sftp://${CATN8_DEPLOY_HOST}" <<LFTP_CMDS
set sftp:auto-confirm yes
set ssl:verify-certificate no
set net:timeout 30
set net:max-retries 2
mkdir -p ${REMOTE_SQL_DIR}
cd ${REMOTE_SQL_DIR}
put -c "$DUMP_PATH" -o "$DUMP_BASENAME"
bye
LFTP_CMDS
  log 'Upload completed.'
else
  log 'Skipping upload step (--skip-upload).'
fi

if [[ $SKIP_RESTORE -eq 0 ]]; then
  # Use the same maintenance endpoint as deploy_full.sh, pointing at the uploaded backup
  RESTORE_URL="${RESTORE_BASE%/}/api/database_maintenance.php?action=restore_database&admin_token=${CATN8_ADMIN_TOKEN}"
  log "Triggering remote restore via ${RESTORE_URL} ..."
  TMP_RESTORE_BODY="$(mktemp)"
  RESTORE_HTTP_CODE=$(curl -sS -o "$TMP_RESTORE_BODY" -w "%{http_code}" \
    --data-urlencode "server_backup_path=${REMOTE_SQL_DIR}/${DUMP_BASENAME}" \
    "$RESTORE_URL" || printf '000')
  RESTORE_BODY="$(cat "$TMP_RESTORE_BODY" 2>/dev/null || true)"
  rm -f "$TMP_RESTORE_BODY"

  log "Restore HTTP code: ${RESTORE_HTTP_CODE}"
  log "Restore body: ${RESTORE_BODY}"

  if [[ "$RESTORE_HTTP_CODE" != "200" ]]; then
    echo "Restore API call failed with HTTP ${RESTORE_HTTP_CODE}." >&2
    exit 1
  fi
else
  log 'Skipping remote restore step (--skip-restore).'
fi
log 'Database deployment steps finished.'
