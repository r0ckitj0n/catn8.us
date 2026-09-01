#!/usr/bin/env bash
# Upload Papa's Cabin repair PHP files from GitHub main (no local git required).
set -eo pipefail

if [[ -z "${CATN8_DEPLOY_PASS:-}" ]]; then
  echo "Set CATN8_DEPLOY_PASS first (from CATN8 Deployment.rtf)." >&2
  exit 1
fi

DEPLOY_HOST="${CATN8_DEPLOY_HOST:-home419172903.1and1-data.host}"
DEPLOY_USER="${CATN8_DEPLOY_USER:-acc899014616}"
BASE="https://raw.githubusercontent.com/r0ckitj0n/catn8.us/main"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

FILES=(
  "includes/build_wizard_phase_keys.php"
  "includes/build_wizard_cabin_relink.php"
  "api/build_wizard.php"
  "api/build_wizard_repair_papas_cabin.php"
  "api/build_wizard_diagnostics.php"
)

for f in "${FILES[@]}"; do
  echo "Downloading ${f}..."
  mkdir -p "${TMP}/$(dirname "${f}")"
  curl -fsSL "${BASE}/${f}" -o "${TMP}/${f}"
done

echo "Uploading to ${DEPLOY_HOST}..."
{
  echo "set sftp:auto-confirm yes"
  echo "set ssl:verify-certificate no"
  echo "set cmd:fail-exit yes"
  for f in "${FILES[@]}"; do
    echo "put ${TMP}/${f} -o ${f}"
  done
  echo "bye"
} | lftp -u "${DEPLOY_USER},${CATN8_DEPLOY_PASS}" "sftp://${DEPLOY_HOST}"

echo "Upload complete."
echo "Open in browser (replace YOUR_ADMIN_TOKEN):"
echo "  https://catn8.us/api/build_wizard_repair_papas_cabin.php?action=repair_all&admin_token=YOUR_ADMIN_TOKEN"
