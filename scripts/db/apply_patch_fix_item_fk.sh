#!/usr/bin/env bash
set -euo pipefail

# Applies the FK/collation patch that was uploaded to backups/sql/patch_fix_item_fk.sql
# Usage: bash scripts/db/apply_patch_fix_item_fk.sh

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE_LOCAL="${ROOT_DIR}/.env.local"
ENV_FILE="${ROOT_DIR}/.env"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/secrets/env_or_keychain.sh"

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

catn8_secret_require CATN8_ADMIN_TOKEN

PATCH_PATH="backups/sql/patch_fix_item_fk.sql"
RESTORE_URL="${CATN8_DEPLOY_BASE_URL:-https://catn8.us}/api/restore_db_from_backup.php"

echo "Applying patch via ${RESTORE_URL} ..."
response=$(curl -sS --fail \
  --data-urlencode "file=${PATCH_PATH}" \
  --data-urlencode "admin_token=${CATN8_ADMIN_TOKEN}" \
  "${RESTORE_URL}")

echo "Response: ${response}"
