#!/usr/bin/env bash
set -euo pipefail

# Sweep all .txt files outside backups/ and node_modules/ into backups/text/ preserving paths.
# Usage: scripts/maintenance/sweep_txt_files.sh [--dry-run]

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

# Ensure backups base
BACKUP_BASE="backups/text"
if [[ $DRY_RUN -eq 0 ]]; then
  mkdir -p "$BACKUP_BASE"
fi

# List tracked and untracked .txt files (excluding node_modules, backups, .git)
# Use git ls-files + find for robustness; avoid mapfile for macOS bash compatibility
FILES_LIST=$( {
  git ls-files -co --exclude-standard | grep -E '\.txt$' || true
  find . -type f -name '*.txt' -not -path './.git/*' -not -path './node_modules/*' -not -path './backups/*' -print || true
} | sort -u )

MOVED=0
while IFS= read -r f; do
  # Skip empty lines
  [ -z "$f" ] && continue
  # Normalize leading ./
  rel="${f#./}"
  # Keep robots.txt at repo root (site requirement)
  if [[ "$rel" == "robots.txt" ]]; then
    continue
  fi
  # Skip already under backups/ or node_modules/
  if [[ "$rel" == backups/* ]] || [[ "$rel" == node_modules/* ]]; then
    continue
  fi
  # Determine destination path
  dest="$BACKUP_BASE/$rel"
  dest_dir="$(dirname "$dest")"
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "DRY-RUN: would move '$rel' -> '$dest'"
  else
    mkdir -p "$dest_dir"
    git mv -f "$rel" "$dest" 2>/dev/null || mv -f "$rel" "$dest"
    echo "Moved '$rel' -> '$dest'"
  fi
  ((MOVED+=1)) || true

done <<< "$FILES_LIST"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "DRY-RUN complete. Files listed above would be moved into '$BACKUP_BASE/'."
else
  echo "Sweep complete. Moved $MOVED .txt file(s) into '$BACKUP_BASE/'."
fi
