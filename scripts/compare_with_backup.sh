#!/bin/bash
# Compare current project against a known-good backup and produce a detailed diff report
# Usage: bash scripts/compare_with_backup.sh [BACKUP_DIR]
# Default BACKUP_DIR: 
#   /Users/jongraves/Documents/Websites/WhimsicalFrog - Backups/2025-09-23

set -euo pipefail

# Resolve project root
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Default backup path (note the space in the folder name)
DEFAULT_BACKUP_DIR="/Users/jongraves/Documents/Websites/WhimsicalFrog - Backups/2025-09-23"
BACKUP_DIR="${1:-$DEFAULT_BACKUP_DIR}"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "[compare] ERROR: Backup directory not found: $BACKUP_DIR" >&2
  exit 1
fi

# Reports directory
REPORTS_DIR="$ROOT_DIR/reports"
mkdir -p "$REPORTS_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
REPORT_FILE="$REPORTS_DIR/diff_report_$TS.txt"
SUMMARY_FILE="$REPORTS_DIR/diff_summary_$TS.txt"

# Common excludes (paths relative to each root)
EXCLUDES=(
  "--exclude=.git"
  "--exclude=node_modules"
  "--exclude=dist"
  "--exclude=vendor"
  "--exclude=.DS_Store"
  "--exclude=.cache"
  "--exclude=hot"
  "--exclude=.vite"
)

# Run unified diff recursively, capturing output
# We run diff in both directions to capture "Only in" lines relative to each root consistently.
# Primary diff: backup vs current
{
  echo "=== Diff: BACKUP vs CURRENT ==="
  echo "Backup: $BACKUP_DIR"
  echo "Current: $ROOT_DIR"
  echo "Timestamp: $TS"
  echo
  diff -ruN "${EXCLUDES[@]}" "$BACKUP_DIR" "$ROOT_DIR" || true
} | tee "$REPORT_FILE" >/dev/null

# Build a concise summary from the diff output
# - Changed files: lines starting with "diff "
# - Only-in (added/removed): lines starting with "Only in"
{
  echo "# Diff Summary ($TS)"
  echo "Backup: $BACKUP_DIR"
  echo "Current: $ROOT_DIR"
  echo
  echo "## Added/Removed (Only in)"
  grep -E "^Only in " "$REPORT_FILE" | sed 's/^/ - /' || true
  echo
  echo "## Changed Files"
  grep -E "^diff \-ruN " "$REPORT_FILE" | awk '{print $4, $5, $6}' | sed 's/^/ - /' || true
  echo
  echo "## Notes"
  echo " - Excluded: .git, node_modules, dist, vendor, .DS_Store, .cache, hot, .vite"
  echo " - Full details in: $REPORT_FILE"
} | tee "$SUMMARY_FILE" >/dev/null

# Final pointers
echo "[compare] Summary: $SUMMARY_FILE"
echo "[compare] Full report: $REPORT_FILE"
