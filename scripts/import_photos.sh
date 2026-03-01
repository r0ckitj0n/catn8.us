#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

mkdir -p .local/state
LOG_FILE=".local/state/import_run.log"

python3 -u scripts/import_imessage_photo_albums.py "$@" \
  | tee "$LOG_FILE"

rg -n "Upload complete via (maintenance API SQL restore|direct MySQL connection)" "$LOG_FILE"

bash scripts/deploy.sh --lite
