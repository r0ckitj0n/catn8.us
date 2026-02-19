#!/bin/bash
# Restore selected files from a known-good backup into the current project.
# Creates timestamped backups of the current files before overwriting.
# Usage:
#   bash scripts/restore_from_backup.sh [--dry-run] [--backup "PATH"] file1 [file2 ...]
# Defaults:
#   --backup "/Users/jongraves/Documents/Websites/WhimsicalFrog - Backups/2025-09-23"

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=0
BACKUP_DIR="/Users/jongraves/Documents/Websites/WhimsicalFrog - Backups/2025-09-23"

# parse args
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1; shift;;
    --backup)
      BACKUP_DIR="$2"; shift 2;;
    *)
      ARGS+=("$1"); shift;;
  esac
done

if [ ${#ARGS[@]} -eq 0 ]; then
  echo "Usage: $0 [--dry-run] [--backup PATH] file1 [file2 ...]" >&2
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "[restore] ERROR: Backup dir not found: $BACKUP_DIR" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_OUT_DIR="$ROOT_DIR/reports/restore_backups/$TS"
mkdir -p "$BACKUP_OUT_DIR"

# restore loop
for REL in "${ARGS[@]}"; do
  SRC="$BACKUP_DIR/$REL"
  DST="$ROOT_DIR/$REL"
  echo "[restore] File: $REL"
  if [ ! -f "$SRC" ]; then
    echo "  - SKIP (missing in backup): $SRC"
    continue
  fi
  # ensure parent dir exists
  DST_DIR="$(dirname "$DST")"
  if [ ! -d "$DST_DIR" ]; then
    echo "  - Creating directory: $DST_DIR"
    [ "$DRY_RUN" -eq 0 ] && mkdir -p "$DST_DIR"
  fi
  # make backup of current file if present
  if [ -f "$DST" ]; then
    OUT_BKP_DIR="$BACKUP_OUT_DIR/$(dirname "$REL")"
    mkdir -p "$OUT_BKP_DIR"
    echo "  - Backing up current to: $OUT_BKP_DIR/$(basename "$REL")"
    [ "$DRY_RUN" -eq 0 ] && cp -p "$DST" "$OUT_BKP_DIR/"
  else
    echo "  - Note: current file missing; will create new"
  fi
  # show diff preview
  echo "  - Diff preview (backup -> current):"
  diff -u "$SRC" "$DST" || true
  # copy if not dry-run
  if [ "$DRY_RUN" -eq 0 ]; then
    echo "  - Restoring from backup"
    cp -p "$SRC" "$DST"
  else
    echo "  - DRY RUN: not copying"
  fi
  echo
done

echo "[restore] Done. Backups saved to: $BACKUP_OUT_DIR"
