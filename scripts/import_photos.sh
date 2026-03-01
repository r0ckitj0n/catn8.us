#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

mkdir -p .local/state
LOG_FILE=".local/state/import_run.log"

DEFAULT_IMPORT_ARGS=(--mode attachment_match)
IMPORT_ARGS=("$@")
if [ "${#IMPORT_ARGS[@]}" -eq 0 ]; then
  IMPORT_ARGS=("${DEFAULT_IMPORT_ARGS[@]}")
fi

echo "Running importer with args: ${IMPORT_ARGS[*]}"
python3 -u scripts/import_imessage_photo_albums.py "${IMPORT_ARGS[@]}" 2>&1 \
  | tee "$LOG_FILE"

rg -n "Upload complete( for album [0-9]+/[0-9]+)? via (maintenance API SQL restore|direct MySQL connection)" "$LOG_FILE"

bash scripts/deploy.sh --lite
