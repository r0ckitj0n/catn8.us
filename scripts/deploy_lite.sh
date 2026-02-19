#!/bin/bash

# Lite incremental deployment to SFTP (changed/missing files only)
# Wrapper for scripts/deploy.sh --lite

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/deploy.sh" --lite "$@"
