#!/usr/bin/env bash
# Upload only the Papa's Cabin FABRIC8 repair PHP files (no dist build, no DB changes).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT}"

ENV_FILE_LOCAL="${ROOT}/.env.local"
ENV_FILE="${ROOT}/.env"
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

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/secrets/env_or_keychain.sh"

HOST="${CATN8_DEPLOY_HOST:-home419172903.1and1-data.host}"
USER="${CATN8_DEPLOY_USER:-acc899014616}"
catn8_secret_require CATN8_DEPLOY_PASS
PASS="${CATN8_DEPLOY_PASS}"

FILES=(
  "includes/build_wizard_cabin_relink.php"
  "api/build_wizard.php"
)

for f in "${FILES[@]}"; do
  if [[ ! -f "${f}" ]]; then
    echo "Missing required file: ${f}" >&2
    exit 1
  fi
done

echo "Uploading Papa's Cabin repair files to ${HOST}..."
lftp -u "${USER}","${PASS}" "sftp://${HOST}" <<LFTP
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
put includes/build_wizard_cabin_relink.php -o includes/build_wizard_cabin_relink.php
put api/build_wizard.php -o api/build_wizard.php
bye
LFTP

echo "Done. Open https://catn8.us/fabric8 and select Papa's Cabin to run auto-repair on bootstrap."
echo "Or POST /api/build_wizard.php?action=repair_cabin_references with {\"project_id\":65} while logged in."
