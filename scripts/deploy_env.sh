#!/bin/bash

# Deploy .env.live to production as .env
# Wrapper for scripts/deploy.sh --env-only

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/deploy.sh" --env-only "$@"
EXIT_CODE=$?
echo "Run timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z') (exit: ${EXIT_CODE})"
exit "$EXIT_CODE"
