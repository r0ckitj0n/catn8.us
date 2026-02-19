#!/usr/bin/env bash
set -euo pipefail

# Dump the local database to backups/sql/ with a timestamped filename.
# Reads credentials from .env (CATN8_DB_LOCAL_*). Falls back to sane defaults if set in the environment.
# Usage:
#   scripts/db/dump_local_db.sh [--gzip]
#
# Example:
#   ./scripts/db/dump_local_db.sh --gzip

# Resolve repo root (two levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE_LOCAL="${ROOT_DIR}/.env.local"
ENV_FILE="${ROOT_DIR}/.env"
OUT_DIR="${ROOT_DIR}/backups/sql"

# Load .env.local if present, else .env
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

# Pull config from environment (.env should populate these)
HOST="${CATN8_DB_LOCAL_HOST:-127.0.0.1}"
PORT="${CATN8_DB_LOCAL_PORT:-3306}"
USER="${CATN8_DB_LOCAL_USER:-root}"
PASS="${CATN8_DB_LOCAL_PASS:-}"
DB="${CATN8_DB_LOCAL_NAME:-${CATN8_DB_LOCAL_DB:-catn8}}"
SOCKET="${CATN8_DB_LOCAL_SOCKET:-}"

# Parse flags
GZIP_OUTPUT=0
for arg in "$@"; do
  case "$arg" in
    --gzip|-z)
      GZIP_OUTPUT=1
      shift
      ;;
    *) ;;
  esac
done

# Check prerequisites: find mysqldump in PATH or common Homebrew locations
MYSQLDUMP_BIN="$(command -v mysqldump || true)"
if [[ -z "${MYSQLDUMP_BIN}" ]]; then
  for CAND in \
    /opt/homebrew/opt/mysql-client/bin/mysqldump \
    /usr/local/opt/mysql-client/bin/mysqldump \
    /opt/homebrew/bin/mysqldump \
    /usr/local/bin/mysqldump; do
    if [[ -x "${CAND}" ]]; then MYSQLDUMP_BIN="${CAND}"; break; fi
  done
fi
if [[ -z "${MYSQLDUMP_BIN}" ]]; then
  echo "Error: mysqldump is not installed or not in PATH" >&2
  exit 1
fi

# Ensure output directory exists
mkdir -p "${OUT_DIR}"

TS="$(date +%F_%H-%M-%S)"
BASENAME="local_db_dump_${TS}.sql"
OUT_PATH="${OUT_DIR}/${BASENAME}"

# Build mysqldump args
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

# Add socket if provided
if [[ -n "${SOCKET}" ]]; then
  MYSQLDUMP_ARGS+=("--socket=${SOCKET}")
fi

# Exclude secrets table so deploys do not overwrite production secrets.
# (Requires fully-qualified table name.)
MYSQLDUMP_ARGS+=("--ignore-table=${DB}.secrets")

# Add the database without CREATE DATABASE/USE so dumps restore cleanly into a differently named live DB
MYSQLDUMP_ARGS+=("${DB}")

# Run the dump (avoid exposing password in process list using MYSQL_PWD)
if [[ -n "${PASS}" ]]; then
  export MYSQL_PWD="${PASS}"
else
  # If no password, ensure MYSQL_PWD is unset
  unset MYSQL_PWD 2>/dev/null || true
fi

echo "Creating database dump for '${DB}' -> ${OUT_PATH}"
"${MYSQLDUMP_BIN}" "${MYSQLDUMP_ARGS[@]}" > "${OUT_PATH}"

if [[ ${GZIP_OUTPUT} -eq 1 ]]; then
  echo "Compressing dump (gzip)"
  gzip -f "${OUT_PATH}"
  OUT_PATH="${OUT_PATH}.gz"
fi

# Output final path
echo "Done: ${OUT_PATH}"
