#!/usr/bin/env bash
# rotate_logs.sh - Safe log rotation for /logs/ directory
# - Rotates files larger than MAX_SIZE_MB
# - Keeps NUM_KEEP compressed archives per log file
# - Uses copytruncate-like approach to avoid breaking file descriptors
# - Preserves ownership and permissions

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
MAX_SIZE_MB="50"         # rotate if > 50 MB
NUM_KEEP="7"             # keep last 7 rotations
DATE_SUFFIX="$(date +%Y%m%d_%H%M%S)"

if [[ ! -d "$LOG_DIR" ]]; then
  echo "Log directory not found: $LOG_DIR" >&2
  exit 0
fi

rotate_one() {
  local file="$1"
  local size_mb
  size_mb=$(du -m "$file" | awk '{print $1}')
  if [[ "$size_mb" -lt "$MAX_SIZE_MB" ]]; then
    return 0
  fi

  local base="$(basename "$file")"
  local dir="$(dirname "$file")"
  local rotated="$dir/${base}.${DATE_SUFFIX}.log"

  # Preserve ownership and mode
  local owner group mode
  owner=$(stat -f %Su "$file" 2>/dev/null || echo "")
  group=$(stat -f %Sg "$file" 2>/dev/null || echo "")
  mode=$(stat -f %p "$file" 2>/dev/null | tail -c 4 || echo "644")

  echo "Rotating $file ($size_mb MB) -> $rotated.gz"
  cp "$file" "$rotated"
  : > "$file"  # truncate in place (copytruncate)

  # Compress rotated copy
  gzip -f "$rotated"

  # Restore permissions on the truncated file
  if [[ -n "$mode" ]]; then chmod "$mode" "$file" || true; fi
  if [[ -n "$owner" ]]; then chown "$owner" "$file" || true; fi
  if [[ -n "$group" ]]; then chgrp "$group" "$file" || true; fi

  # Prune old rotations
  ls -1t "$dir/${base}."*.log.gz 2>/dev/null | tail -n +$((NUM_KEEP+1)) | while read -r old; do
    echo "Pruning $old"
    rm -f "$old"
  done
}

export -f rotate_one
export DATE_SUFFIX MAX_SIZE_MB NUM_KEEP

find "$LOG_DIR" -maxdepth 1 -type f \
  \( -name "*.log" -o -name "*.out" -o -name "*.err" \) \
  -print0 | while IFS= read -r -d '' f; do
    rotate_one "$f"
  done

echo "Rotation complete."
