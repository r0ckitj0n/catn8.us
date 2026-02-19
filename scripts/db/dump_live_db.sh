#!/usr/bin/env bash
set -euo pipefail

# Dump the LIVE database to backups/sql/ with a timestamped filename.
# Reads credentials from .env (CATN8_DB_LIVE_*).
# Usage:
#   scripts/db/dump_live_db.sh [--gzip]
#
# Example:
#   ./scripts/db/dump_live_db.sh --gzip

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
OUT_DIR="${ROOT_DIR}/backups/sql"

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

# Flags
GZIP_OUTPUT=0
for arg in "$@"; do
  case "$arg" in
    --gzip|-z) GZIP_OUTPUT=1; shift;;
    *) ;;
  esac
done

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "Error: mysqldump is not installed or not in PATH" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"
TS="$(date +%F_%H-%M-%S)"
BASENAME="live_db_dump_${TS}.sql"
OUT_PATH="${OUT_DIR}/${BASENAME}"

MYSQLDUMP_ARGS=(
  "--host=${HOST}"
  "--port=${PORT}"
  "--user=${USER}"
  "--single-transaction"
  "--default-character-set=utf8mb4"
  "--routines"
  "--triggers"
  "--events"
  "--skip-lock-tables"
)

if [[ -n "${SOCKET}" ]]; then MYSQLDUMP_ARGS+=("--socket=${SOCKET}"); fi

# Exclude secrets table so dumps don't include encrypted application secrets.
MYSQLDUMP_ARGS+=("--ignore-table=${DB}.secrets")

MYSQLDUMP_ARGS+=("--databases" "${DB}")

if [[ -n "${PASS}" ]]; then export MYSQL_PWD="${PASS}"; else unset MYSQL_PWD 2>/dev/null || true; fi

echo "Creating LIVE database dump for '${DB}' -> ${OUT_PATH}"
mysqldump "${MYSQLDUMP_ARGS[@]}" > "${OUT_PATH}"

if [[ ${GZIP_OUTPUT} -eq 1 ]]; then
  echo "Compressing dump (gzip)"
  gzip -f "${OUT_PATH}"
  OUT_PATH="${OUT_PATH}.gz"
fi

echo "Done: ${OUT_PATH}"
