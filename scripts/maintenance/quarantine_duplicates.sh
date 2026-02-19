#!/usr/bin/env bash
# Quarantine duplicate/backup files into backups/ preserving paths.
# Safe to run multiple times; idempotent for already-moved files.
# Intended to run locally in pre-commit and manually for repo cleanup.

set -euo pipefail

# Repo root
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DUP_DIR="$REPO_ROOT/backups/duplicates"
BAK_DIR="$REPO_ROOT/backups/bak"
mkdir -p "$DUP_DIR" "$BAK_DIR"

# Flags
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run|--plan) DRY_RUN=1 ;;
  esac
done

# Excludes
EXCLUDES=(
  "$REPO_ROOT/backups" "$REPO_ROOT/node_modules" "$REPO_ROOT/dist" "$REPO_ROOT/vendor" "$REPO_ROOT/.git"
)

moved_any=0
moved_list=()
planned_count=0
actual_count=0

is_excluded() { local p="$1"; for e in "${EXCLUDES[@]}"; do [[ "$p" == "$e"* ]] && return 0; done; return 1; }

is_duplicate_suffixed() {
  local base="$1"
  [[ "$base" =~ [[:space:]]([2-9]|[1-9][0-9]+)(\.[^/\\]+)?$ ]]
}

is_bak_artifact() {
  local base="$1"
  [[ "$base" =~ \.bak([._-]|$) ]] || [[ "$base" =~ (^|[._\ -])bak[0-9]?[-._] ]]
}

is_other_backup_artifact() {
  local base="$1"
  [[ "$base" =~ \.backup(\.[^/\\]+)?$ ]] || [[ "$base" =~ \.orig$ ]] || [[ "$base" =~ \.old$ ]] || [[ "$base" =~ ~$ ]]
}

# Iterate candidates (portable: avoids 'mapfile' not present on macOS Bash 3)
while IFS= read -r abs; do
  [[ -z "$abs" ]] && continue
  is_excluded "$abs" && continue
  # Skip files already under backups
  [[ "$abs" == "$REPO_ROOT/backups/"* ]] && continue

  rel="${abs#$REPO_ROOT/}"
  base="$(basename "$abs")"
  dest_root=""
  if is_duplicate_suffixed "$base"; then
    dest_root="$DUP_DIR"
  elif is_bak_artifact "$base"; then
    dest_root="$BAK_DIR"
  elif is_other_backup_artifact "$base"; then
    dest_root="$DUP_DIR"
  else
    continue
  fi

  dest="$dest_root/$rel"
  dest_dir="$(dirname "$dest")"
  mkdir -p "$dest_dir"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    planned_count=$((planned_count+1))
    moved_any=1
    moved_list+=("PLAN: $rel -> ${dest#$REPO_ROOT/}")
    continue
  fi

  # Prefer git mv if file is tracked to preserve history
  if git -C "$REPO_ROOT" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
    if git -C "$REPO_ROOT" mv -f "$rel" "$dest" >/dev/null 2>&1; then
      actual_count=$((actual_count+1))
    else
      mv -f "$abs" "$dest" && actual_count=$((actual_count+1))
    fi
  else
    mv -f "$abs" "$dest" && actual_count=$((actual_count+1))
  fi
  moved_any=1
  moved_list+=("$rel -> ${dest#$REPO_ROOT/}")

done < <(
  find "$REPO_ROOT" \
    \( \
      -path "$REPO_ROOT/backups" -o \
      -path "$REPO_ROOT/backups/*" -o \
      -path "$REPO_ROOT/node_modules" -o \
      -path "$REPO_ROOT/node_modules/*" -o \
      -path "$REPO_ROOT/dist" -o \
      -path "$REPO_ROOT/dist/*" -o \
      -path "$REPO_ROOT/vendor" -o \
      -path "$REPO_ROOT/vendor/*" -o \
      -path "$REPO_ROOT/.git" -o \
      -path "$REPO_ROOT/.git/*" \
    \) -prune -o \
    -type f -print 2>/dev/null | sort -u
)

# Stage changes if any
if [[ "$moved_any" -eq 1 ]]; then
  if [[ "$DRY_RUN" -eq 0 ]]; then
    git -C "$REPO_ROOT" add -A "$DUP_DIR" "$BAK_DIR" >/dev/null 2>&1 || true
    # Remove any now-missing paths from the index (in case mv fallback happened)
    git -C "$REPO_ROOT" add -A >/dev/null 2>&1 || true
  fi

  printf "Quarantined duplicate/backup files to backups/:\n" >&2
  for m in "${moved_list[@]}"; do printf " - %s\n" "$m" >&2; done
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf "Quarantine summary: planned=%d moved=0\n" "$planned_count" >&2
  else
    printf "Quarantine summary: planned=%d moved=%d\n" "$planned_count" "$actual_count" >&2
  fi
fi

exit 0
