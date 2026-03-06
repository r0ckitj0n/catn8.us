#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 --user-id=<id>|--user-uuid=<uuid> --db-profile=live|local --source=<url_or_path> [--source=<url_or_path> ...] [--default-owner=<owner>] [--source-owner=<source=owner>] [--default-category=<category>]"
  exit 1
fi

USER_ARG=""
PROFILE_ARG="--db-profile=local"
SOURCES=()
PREPARE_EXTRA_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --user-id=*|--user-uuid=*) USER_ARG="$arg" ;;
    --db-profile=*) PROFILE_ARG="$arg" ;;
    --source=*) SOURCES+=("${arg#--source=}") ;;
    --default-owner=*|--source-owner=*|--default-category=*) PREPARE_EXTRA_ARGS+=("$arg") ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

if [ -z "$USER_ARG" ]; then
  echo "Missing --user-id or --user-uuid"
  exit 1
fi
if [ "${#SOURCES[@]}" -eq 0 ]; then
  echo "Provide at least one --source"
  exit 1
fi

OUT=".local/state/valid8/import_rows.json"
mkdir -p .local/state/valid8

CMD=(python3 scripts/maintenance/prepare_valid8_import.py --output "$OUT")
for extra in "${PREPARE_EXTRA_ARGS[@]}"; do
  CMD+=("$extra")
done
for src in "${SOURCES[@]}"; do
  CMD+=(--source "$src")
done

"${CMD[@]}"
php scripts/maintenance/import_valid8_rows.php --input="$OUT" "$USER_ARG" "$PROFILE_ARG"
