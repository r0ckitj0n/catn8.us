#!/bin/bash

# Deploy dist assets only
# Wrapper for scripts/deploy.sh --dist-only

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/deploy.sh" --dist-only "$@"
EXIT_CODE=$?
echo "Run timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z') (exit: ${EXIT_CODE})"
exit "$EXIT_CODE"
