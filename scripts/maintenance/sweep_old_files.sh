#!/usr/bin/env bash
set -euo pipefail

# Sweep and relocate files with legacy "old" suffix/patterns into backups/legacy/ preserving paths
# Patterns: *-old*, *_old*, *.old*
# Exclusions: backups/, node_modules/, vendor/, dist/, .git/, placeholder.* assets
# Usage: scripts/maintenance/sweep_old_files.sh [--dry-run]

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

root_dir="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$root_dir"

# Ensure git is available and repository is initialized
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository; aborting sweep." >&2
  exit 0
fi

# Find candidates (portable; avoid mapfile)
files_list=$(git ls-files -o -c --exclude-standard | \
  grep -Ei '(^|/)([^/]*(-old|_old|\.old)[^/]*)$' | \
  grep -Ev '^(backups/|node_modules/|vendor/|dist/|\.git/)' | \
  grep -Ev '^scripts/maintenance/sweep_old_files\.sh$' | \
  grep -Ev '(^|/)placeholder\.[a-zA-Z0-9]+$' || true)

if [[ -z "${files_list}" ]]; then
  exit 0
fi

echo "$files_list" | while IFS= read -r f; do
  # Skip directories just in case (ls-files usually lists files)
  if [[ -d "$f" ]]; then
    continue
  fi
  dest="backups/legacy/$f"
  dest_dir="$(dirname "$dest")"
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "[DRY-RUN] would move: $f -> $dest"
  else
    mkdir -p "$dest_dir"
    # Use git mv if file is tracked or untracked; fallback to mv
    if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      git mv -f "$f" "$dest"
    else
      # Untracked file: move and add
      mv -f "$f" "$dest"
      git add -f "$dest"
    fi
    echo "Moved: $f -> $dest"
  fi
done
