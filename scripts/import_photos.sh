#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

mkdir -p .local/state
LOG_FILE=".local/state/import_run.log"

DEFAULT_IMPORT_ARGS=(--mode attachment_match)
IMPORT_ARGS=()
FRESH_RUN=0
for arg in "$@"; do
  if [[ "$arg" == "--fresh" ]]; then
    FRESH_RUN=1
    continue
  fi
  IMPORT_ARGS+=("$arg")
done
HAS_MODE_FLAG=0
if [ "${#IMPORT_ARGS[@]}" -gt 0 ]; then
  for arg in "${IMPORT_ARGS[@]}"; do
    if [[ "$arg" == "--mode" ]] || [[ "$arg" == --mode=* ]]; then
      HAS_MODE_FLAG=1
      break
    fi
  done
fi

if [ "${#IMPORT_ARGS[@]}" -eq 0 ]; then
  IMPORT_ARGS=("${DEFAULT_IMPORT_ARGS[@]}")
elif [ "$HAS_MODE_FLAG" -eq 0 ]; then
  IMPORT_ARGS=("${DEFAULT_IMPORT_ARGS[@]}" "${IMPORT_ARGS[@]}")
fi

if [ "$FRESH_RUN" -eq 1 ]; then
  IMPORT_ARGS+=(--no-attachment-checkpoint --rematch-all)
  echo "Fresh import requested: checkpoint resume disabled for this run."
else
  echo "Resume mode enabled: importer will continue from the last attachment checkpoint."
fi

echo "Running importer with args: ${IMPORT_ARGS[*]}"
python3 -u scripts/import_imessage_photo_albums.py "${IMPORT_ARGS[@]}" 2>&1 \
  | tee "$LOG_FILE"

rg -n "Upload complete( for album [0-9]+/[0-9]+)? via (maintenance API SQL restore|direct MySQL connection)" "$LOG_FILE"

bash scripts/deploy.sh --lite
