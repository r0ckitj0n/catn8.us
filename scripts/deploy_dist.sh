#!/bin/bash

# Deploy dist assets only
# Wrapper for scripts/deploy.sh --dist-only

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/deploy.sh" --dist-only "$@"
