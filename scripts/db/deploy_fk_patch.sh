#!/usr/bin/env bash
set -euo pipefail

# Deploy and apply the FK/collation patch for item_size_assignments.
# Steps:
# 1) Generate patch SQL at /tmp/patch_fix_item_fk.sql
# 2) Upload to remote backups/sql (same path used by deploy_db.sh)
# 3) Trigger restore_db_from_backup.php with CATN8_ADMIN_TOKEN
#
# Usage: bash scripts/db/deploy_fk_patch.sh

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

CATN8_DEPLOY_HOST="${CATN8_DEPLOY_HOST:-home419172903.1and1-data.host}"
CATN8_DEPLOY_USER="${CATN8_DEPLOY_USER:-acc899014616}"
catn8_secret_require CATN8_DEPLOY_PASS
catn8_secret_require CATN8_ADMIN_TOKEN

CATN8_DEPLOY_BASE_URL="${CATN8_DEPLOY_BASE_URL:-https://catn8.us}"
REMOTE_SQL_DIR="${CATN8_REMOTE_SQL_DIR:-backups/sql}"
PATCH_LOCAL="/tmp/patch_fix_item_fk.sql"
PATCH_REMOTE_BASENAME="patch_fix_item_fk.sql"
PATCH_REMOTE_PATH="${REMOTE_SQL_DIR%/}/${PATCH_REMOTE_BASENAME}"

cat >"${PATCH_LOCAL}" <<'SQL'
SET FOREIGN_KEY_CHECKS=0;
ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Convert tables to uniform collation (skip errors if missing)
ALTER TABLE items CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE item_size_assignments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Drop any existing FK names we’ve used (ignore errors)
ALTER TABLE item_size_assignments DROP FOREIGN KEY item_size_assignments_fk_items_sku;
ALTER TABLE item_size_assignments DROP FOREIGN KEY item_size_assignments_ibfk_1;

-- Align column definitions
ALTER TABLE items MODIFY sku VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE item_size_assignments MODIFY item_sku VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

-- Recreate FK
ALTER TABLE item_size_assignments
  ADD CONSTRAINT item_size_assignments_fk_items_sku
  FOREIGN KEY (item_sku) REFERENCES items(sku)
  ON DELETE CASCADE ON UPDATE CASCADE;
SET FOREIGN_KEY_CHECKS=1;
SQL

echo "Uploading patch to ${CATN8_DEPLOY_HOST}:${PATCH_REMOTE_PATH} ..."
cat > /tmp/upload_fk_patch.txt <<EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
open sftp://${CATN8_DEPLOY_USER}:${CATN8_DEPLOY_PASS}@${CATN8_DEPLOY_HOST}
cd ${REMOTE_SQL_DIR}
put -c ${PATCH_LOCAL} -o ${PATCH_REMOTE_BASENAME}
bye
EOL
lftp -f /tmp/upload_fk_patch.txt
rm -f /tmp/upload_fk_patch.txt

RESTORE_URL="${CATN8_DEPLOY_BASE_URL%/}/api/restore_db_from_backup.php"
echo "Applying patch via ${RESTORE_URL} ..."
response=$(curl -sS --fail \
  --data-urlencode "file=${PATCH_REMOTE_PATH}" \
  --data-urlencode "admin_token=${CATN8_ADMIN_TOKEN}" \
  "${RESTORE_URL}")

echo "Response: ${response}"
