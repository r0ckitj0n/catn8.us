#!/bin/bash

# Lite incremental deployment to SFTP (changed/missing files only)
# Wrapper for scripts/deploy.sh --lite

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/deploy.sh" --lite "$@"
EXIT_CODE=$?
echo "Run timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z') (exit: ${EXIT_CODE})"
exit "$EXIT_CODE"
