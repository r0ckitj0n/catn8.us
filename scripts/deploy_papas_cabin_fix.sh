#!/usr/bin/env bash
# Upload only the Papa's Cabin FABRIC8 repair PHP files (no dist build, no DB changes).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT}"

# Preserve Cloud Agent / shell-injected secrets so empty .env placeholders
# cannot clobber them (common on Coden8r VMs).
_PRESERVE_KEYS=(CATN8_DEPLOY_HOST CATN8_DEPLOY_USER CATN8_DEPLOY_PASS CATN8_ADMIN_TOKEN CATN8_DEPLOY_BASE_URL)
declare -A _PRESERVED=()
for _k in "${_PRESERVE_KEYS[@]}"; do
  if [[ -n "${!_k:-}" ]]; then
    _PRESERVED["$_k"]="${!_k}"
  fi
done

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

for _k in "${!_PRESERVED[@]}"; do
  export "${_k}=${_PRESERVED[$_k]}"
done
unset _k _PRESERVE_KEYS _PRESERVED

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/secrets/env_or_keychain.sh"

HOST="${CATN8_DEPLOY_HOST:-home419172903.1and1-data.host}"
USER="${CATN8_DEPLOY_USER:-acc899014616}"
catn8_secret_require CATN8_DEPLOY_PASS
PASS="${CATN8_DEPLOY_PASS}"

FILES=(
  "includes/build_wizard_phase_keys.php"
  "includes/build_wizard_cabin_relink.php"
  "api/build_wizard.php"
  "api/build_wizard_repair_papas_cabin.php"
  "api/build_wizard_diagnostics.php"
)

for f in "${FILES[@]}"; do
  if [[ ! -f "${f}" ]]; then
    echo "Missing required file: ${f}" >&2
    exit 1
  fi
done

echo "Uploading Papa's Cabin repair files to ${HOST}..."
LFTP_CMDS="set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
set sftp:connect-program ssh -a -x -oStrictHostKeyChecking=no -oUserKnownHostsFile=/dev/null"
for f in "${FILES[@]}"; do
  LFTP_CMDS="${LFTP_CMDS}
put ${f} -o ${f}"
done
LFTP_CMDS="${LFTP_CMDS}
bye"

lftp -u "${USER}","${PASS}" "sftp://${HOST}" <<LFTP
${LFTP_CMDS}
LFTP

echo "Done."
echo "1) Diagnose: https://catn8.us/api/build_wizard_repair_papas_cabin.php?action=diagnose&admin_token=YOUR_TOKEN&q=Papa"
echo "2) Repair all cabin projects: https://catn8.us/api/build_wizard_repair_papas_cabin.php?action=repair_all&admin_token=YOUR_TOKEN"
echo "3) Then open https://catn8.us/fabric8 and select Papa's Cabin"
