#!/usr/bin/env bash
set -euo pipefail

# One-time cleanup helper for accidental remote uploads of local metadata.
# Default mode is preview/list-only. Use --apply to execute deletions.
#
# Usage:
#   bash scripts/cleanup_remote_accidental_dotdirs.sh
#   bash scripts/cleanup_remote_accidental_dotdirs.sh --apply
#   bash scripts/cleanup_remote_accidental_dotdirs.sh --apply --path backups/some-dir/.git

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE_LOCAL="${ROOT_DIR}/.env.local"
ENV_FILE="${ROOT_DIR}/.env"
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
source "${ROOT_DIR}/scripts/secrets/env_or_keychain.sh"

require_var() {
  local key="$1" value="${!1:-}"
  if [[ -z "$value" ]]; then
    echo "Error: ${key} must be set (in environment or .env)." >&2
    exit 1
  fi
}

APPLY=0
declare -a TARGET_PATHS=(
  ".git"
  ".local"
  "backups/duplicate-suffix-2-20260219-122005/.git"
  "backups/duplicate-suffix-2-20260219-122005/.local"
)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      APPLY=1
      shift
      ;;
    --path)
      if [[ -z "${2:-}" ]]; then
        echo "Error: --path requires a remote path argument." >&2
        exit 2
      fi
      TARGET_PATHS+=("$2")
      shift 2
      ;;
    -h|--help)
      sed -n '1,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

require_var CATN8_DEPLOY_HOST
require_var CATN8_DEPLOY_USER
catn8_secret_require CATN8_DEPLOY_PASS

HOST="${CATN8_DEPLOY_HOST}"
USER="${CATN8_DEPLOY_USER}"
PASS="${CATN8_DEPLOY_PASS}"

TMP_LFTP="$(mktemp /tmp/catn8_cleanup_dotdirs.XXXXXX)"
trap 'rm -f "${TMP_LFTP}"' EXIT

{
  echo "set sftp:auto-confirm yes"
  echo "set ssl:verify-certificate no"
  echo "set cmd:fail-exit no"
  echo "open sftp://${USER}:${PASS}@${HOST}"
  for raw_path in "${TARGET_PATHS[@]}"; do
    # Always treat as relative to remote root.
    path="${raw_path#/}"
    if [[ -z "$path" ]]; then
      continue
    fi
    echo "echo ---"
    echo "echo Checking ${path}"
    echo "cls -d \"${path}\" || true"
    if [[ "${APPLY}" == "1" ]]; then
      echo "echo Removing ${path}"
      echo "rm -r \"${path}\" || true"
    fi
  done
  echo "bye"
} > "${TMP_LFTP}"

if [[ "${APPLY}" == "1" ]]; then
  echo "Applying remote cleanup of accidental .git/.local directories..."
else
  echo "Preview mode only (no deletes). Use --apply to remove detected paths."
fi

lftp -f "${TMP_LFTP}"

if [[ "${APPLY}" == "1" ]]; then
  echo "Cleanup command run completed."
else
  echo "Preview completed."
fi
