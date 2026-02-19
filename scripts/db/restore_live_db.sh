#!/usr/bin/env bash
set -euo pipefail

# Restore a SQL dump into the LIVE database.
# Reads credentials from .env (CATN8_DB_LIVE_*).
# Usage:
#   scripts/db/restore_live_db.sh <dump.sql|dump.sql.gz>
#
# Notes:
# - This will OVERWRITE live tables contained in the dump. Make a live backup first.
# - The dump should be produced with mysqldump --databases <DB> so it contains CREATE/DROP statements.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <dump.sql|dump.sql.gz>" >&2
  exit 1
fi
DUMP_PATH="$1"
if [[ ! -f "$DUMP_PATH" ]]; then
  echo "Error: dump file not found: $DUMP_PATH" >&2
  exit 1
fi

# Load .env if present
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
fi

# Pull live config from environment
HOST="${CATN8_DB_LIVE_HOST:-}"
PORT="${CATN8_DB_LIVE_PORT:-3306}"
USER="${CATN8_DB_LIVE_USER:-}"
PASS="${CATN8_DB_LIVE_PASS:-}"
DB="${CATN8_DB_LIVE_NAME:-}"
SOCKET="${CATN8_DB_LIVE_SOCKET:-}"

if [[ -z "${HOST}" || -z "${USER}" || -z "${DB}" ]]; then
  echo "Error: CATN8_DB_LIVE_HOST, CATN8_DB_LIVE_USER, and CATN8_DB_LIVE_NAME must be set in .env" >&2
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "Error: mysql client is not installed or not in PATH" >&2
  exit 1
fi

# Build mysql args
MYSQL_ARGS=(
  "--host=${HOST}"
  "--port=${PORT}"
  "--user=${USER}"
  "--default-character-set=utf8mb4"
  "--database=${DB}"
)
if [[ -n "${SOCKET}" ]]; then MYSQL_ARGS+=("--socket=${SOCKET}"); fi

if [[ -n "${PASS}" ]]; then export MYSQL_PWD="${PASS}"; else unset MYSQL_PWD 2>/dev/null || true; fi

# Stream import (supports .sql or .sql.gz)
if [[ "${DUMP_PATH}" == *.gz ]]; then
  echo "Restoring (gzip stream) into live '${DB}' on ${HOST}:${PORT} ..."
  gzip -dc "${DUMP_PATH}" | mysql "${MYSQL_ARGS[@]}"
else
  echo "Restoring (plain SQL) into live '${DB}' on ${HOST}:${PORT} ..."
  mysql "${MYSQL_ARGS[@]}" < "${DUMP_PATH}"
fi

echo "Restore completed."
