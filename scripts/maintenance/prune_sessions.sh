#!/usr/bin/env bash
# Prune old PHP session files in a target sessions directory.
# Safe-by-default: only deletes files matching the standard PHP session pattern (sess_*).
# Usage examples:
#   ./prune_sessions.sh                      # prune default /tmp/whimsicalfrog_sessions older than 2 days
#   SESSION_DIR=/some/other/path ./prune_sessions.sh 3  # prune older than 3 days in a custom dir
#   DRY_RUN=1 ./prune_sessions.sh            # show what would be deleted
#
# Environment variables:
#   SESSION_DIR  Directory containing PHP session files (default: /tmp/whimsicalfrog_sessions)
#   DRY_RUN      If set to non-empty, only print files (do not delete)
#
# Positional args:
#   $1           Max age in days (default: 2)
set -euo pipefail

SESSION_DIR=${SESSION_DIR:-"/tmp/whimsicalfrog_sessions"}
MAX_AGE_DAYS=${1:-2}

if [ ! -d "$SESSION_DIR" ]; then
  echo "Sessions directory not found: $SESSION_DIR" >&2
  exit 0
fi

# Resolve absolute path for safety
SESSION_DIR_ABS=$(cd "$SESSION_DIR" && pwd)

# Safety checks: refuse to operate on very shallow or root-like paths
case "$SESSION_DIR_ABS" in
  "/"|"/root"|"/home"|"/Users"|"/var"|"/var/www"|"/var/www/html")
    echo "Refusing to operate on unsafe directory: $SESSION_DIR_ABS" >&2
    exit 1
    ;;
  *)
    ;;
esac

# Find candidate files: only sess_* files older than MAX_AGE_DAYS
if [ -n "${DRY_RUN:-}" ]; then
  echo "[DRY RUN] Would delete files in $SESSION_DIR_ABS older than $MAX_AGE_DAYS days:"
  find "$SESSION_DIR_ABS" -type f -name 'sess_*' -mtime +"$MAX_AGE_DAYS" -print
  exit 0
fi

# Perform deletion
DELETED=0
while IFS= read -r -d '' f; do
  rm -f -- "$f" && DELETED=$((DELETED+1)) || true
done < <(find "$SESSION_DIR_ABS" -type f -name 'sess_*' -mtime +"$MAX_AGE_DAYS" -print0)

echo "Pruned $DELETED session file(s) older than $MAX_AGE_DAYS day(s) from $SESSION_DIR_ABS"
