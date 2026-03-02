#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE_LOCAL="$ROOT_DIR/.env.local"
ENV_FILE="$ROOT_DIR/.env"
if [[ -f "$ENV_FILE_LOCAL" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE_LOCAL"
  set +a
elif [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/secrets/env_or_keychain.sh"

require_var() {
  local key="$1"
  local value="${!key:-}"
  if [[ -z "$value" ]]; then
    echo "Error: $key must be set." >&2
    exit 1
  fi
}

require_var CATN8_DEPLOY_HOST
require_var CATN8_DEPLOY_USER
catn8_secret_require CATN8_DEPLOY_PASS

mkdir -p "$ROOT_DIR/.local/state"
TS="$(date +%Y%m%d-%H%M%S)"
REMOTE_RAW="$ROOT_DIR/.local/state/remote-images-raw-${TS}.txt"
REMOTE_LIST="$ROOT_DIR/.local/state/remote-images-${TS}.txt"
LOCAL_LIST="$ROOT_DIR/.local/state/local-images-${TS}.txt"
ONLY_REMOTE="$ROOT_DIR/.local/state/only-remote-images-${TS}.txt"
ONLY_LOCAL="$ROOT_DIR/.local/state/only-local-images-${TS}.txt"
COMMON="$ROOT_DIR/.local/state/common-images-${TS}.txt"

LFTP_FILE="$ROOT_DIR/.local/state/list_remote_images_${TS}.lftp"
cat > "$LFTP_FILE" <<LFTP
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
open sftp://${CATN8_DEPLOY_USER}:${CATN8_DEPLOY_PASS}@${CATN8_DEPLOY_HOST}
find images
bye
LFTP

lftp -f "$LFTP_FILE" > "$REMOTE_RAW"
rm -f "$LFTP_FILE"

IMAGE_EXT_RE='\.(png|jpe?g|webp|gif|svg|bmp|avif|ico)$'

sed 's#^\./##' "$REMOTE_RAW" | rg -i '^images/' | rg -i "$IMAGE_EXT_RE" | sort -u > "$REMOTE_LIST"
find images -type f | sed 's#^\./##' | rg -i "$IMAGE_EXT_RE" | sort -u > "$LOCAL_LIST"

comm -23 "$REMOTE_LIST" "$LOCAL_LIST" > "$ONLY_REMOTE"
comm -13 "$REMOTE_LIST" "$LOCAL_LIST" > "$ONLY_LOCAL"
comm -12 "$REMOTE_LIST" "$LOCAL_LIST" > "$COMMON"

count_remote="$(wc -l < "$REMOTE_LIST")"
count_local="$(wc -l < "$LOCAL_LIST")"
count_only_remote="$(wc -l < "$ONLY_REMOTE")"
count_only_local="$(wc -l < "$ONLY_LOCAL")"
count_common="$(wc -l < "$COMMON")"

echo "Image compare complete."
echo "  remote files:      $count_remote"
echo "  local files:       $count_local"
echo "  only on live:      $count_only_remote"
echo "  only on local:     $count_only_local"
echo "  in both:           $count_common"
echo
echo "Artifacts:"
echo "  $REMOTE_LIST"
echo "  $LOCAL_LIST"
echo "  $ONLY_REMOTE"
echo "  $ONLY_LOCAL"
echo "  $COMMON"
echo
echo "Top live-only folders:"
if [[ "$count_only_remote" -gt 0 ]]; then
  awk -F'/' '{ if (NF >= 2) print $1"/"$2; else print $1 }' "$ONLY_REMOTE" | sort | uniq -c | sort -nr | head -n 20
else
  echo "  (none)"
fi

echo
echo "Top local-only folders:"
if [[ "$count_only_local" -gt 0 ]]; then
  awk -F'/' '{ if (NF >= 2) print $1"/"$2; else print $1 }' "$ONLY_LOCAL" | sort | uniq -c | sort -nr | head -n 20
else
  echo "  (none)"
fi
