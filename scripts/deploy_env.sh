#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

source "${SCRIPT_DIR}/secrets/env_or_keychain.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/deploy_env.sh [path/to/.env]

Uploads a local env file to the live server as /.env (with a .env.bak backup).

Required config (in .env/.env.local or exported env):
  CATN8_DEPLOY_HOST
  CATN8_DEPLOY_USER

Required secret (env or macOS Keychain via scripts/secrets/env_or_keychain.sh):
  CATN8_DEPLOY_PASS

Notes:
  - The remote file is uploaded to / and chmod'd to 600.
  - This script does not edit secrets in Keychain; it only uses them for SFTP auth.
USAGE
}

 # Load .env.local if present, else .env (to provide CATN8_DEPLOY_* defaults)
 ENV_FILE_LOCAL="${SCRIPT_DIR}/../.env.local"
 ENV_FILE_DEFAULT="${SCRIPT_DIR}/../.env"
 if [[ -f "${ENV_FILE_LOCAL}" ]]; then
   set -a
   # shellcheck disable=SC1090
   . "${ENV_FILE_LOCAL}"
   set +a
 elif [[ -f "${ENV_FILE_DEFAULT}" ]]; then
   set -a
   # shellcheck disable=SC1090
   . "${ENV_FILE_DEFAULT}"
   set +a
 fi

DEFAULT_ENV_FILE=".env"
ENV_FILE="${1:-$DEFAULT_ENV_FILE}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[deploy_env] Error: $ENV_FILE does not exist"
  exit 1
fi

if [[ -z "${CATN8_DEPLOY_HOST:-}" ]]; then
  echo "[deploy_env] Error: CATN8_DEPLOY_HOST must be set (in .env/.env.local or exported env)" >&2
  exit 1
fi
if [[ -z "${CATN8_DEPLOY_USER:-}" ]]; then
  echo "[deploy_env] Error: CATN8_DEPLOY_USER must be set (in .env/.env.local or exported env)" >&2
  exit 1
fi
catn8_secret_require CATN8_DEPLOY_PASS

HOST="${CATN8_DEPLOY_HOST}"
USER="${CATN8_DEPLOY_USER}"
PASS="${CATN8_DEPLOY_PASS}"
REMOTE_PATH="/"

TMP_FILE=$(mktemp)
cat > "$TMP_FILE" <<EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
open sftp://$USER:$PASS@$HOST
lcd .
cd $REMOTE_PATH
mv .env .env.bak && chmod 600 .env.bak || true
put $ENV_FILE -o .env
chmod 600 .env
bye
EOL

lftp -f "$TMP_FILE"
rm -f "$TMP_FILE"

echo "[deploy_env] Uploaded $ENV_FILE to $HOST:$REMOTE_PATH/.env"
