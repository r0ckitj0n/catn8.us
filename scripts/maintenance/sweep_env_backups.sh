#!/usr/bin/env bash
set -euo pipefail

# Sweep .env backup-like files and relocate them into backups/env/
# Patterns handled:
#  - .env.backup_*
#  - .env.bak*
#  - .env.*.bak*
# Skips anything already under backups/.

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

mkdir -p backups/env

# Collect candidates using git to respect ignore rules; fall back to filesystem scan.
collect_candidates() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git ls-files -mo --exclude-standard | grep -E '(^|/)\.env(\.backup_.*|\.bak.*|\..*\.bak.*)?$' || true
    # Also include untracked hidden files not picked up by the above (best-effort)
    find . -type f -name ".env.backup_*" -o -name ".env.bak*" -o -name ".env.*.bak*" 2>/dev/null | sed 's#^\./##' || true
  else
    find . -type f -name ".env.backup_*" -o -name ".env.bak*" -o -name ".env.*.bak*" 2>/dev/null | sed 's#^\./##' || true
  fi
}

# De-duplicate and filter out backups/
_candidates=$(collect_candidates | sort -u | grep -v '^backups/' || true)

moved_any=0

# Iterate over candidates (newline-separated). Use IFS to preserve spaces in filenames.
OLDIFS="$IFS"
IFS=$'\n'
for f in $_candidates; do
  [ -n "$f" ] || continue
  [ -f "$f" ] || continue
  # Target name: keep basename as-is under backups/env/
  base="$(basename "$f")"
  target="backups/env/$base"

  # Avoid overwriting existing file with same name; append timestamp if needed
  if [ -e "$target" ]; then
    ts="$(date +%Y%m%d_%H%M%S)"
    target="backups/env/${base}.${ts}"
  fi

  echo "[sweep_env_backups] Moving $f -> $target"
  # Prefer git mv to preserve history and stage the change; fallback to mv
  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if git mv -f "$f" "$target" 2>/dev/null; then
      moved_any=1
    else
      mv -f "$f" "$target"
      moved_any=1
      # If moved outside git, add the target to git if the source was tracked
      if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
        git add "$target" || true
        git rm --cached -f "$f" || true
      fi
    fi
  else
    mv -f "$f" "$target"
    moved_any=1
  fi
done
IFS="$OLDIFS"

if [ "$moved_any" -eq 1 ]; then
  echo "[sweep_env_backups] Completed. .env backups relocated to backups/env/."
else
  echo "[sweep_env_backups] No .env backups found outside backups/."
fi
