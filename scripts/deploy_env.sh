#!/bin/bash

# Deploy .env.live to production as .env
# Wrapper for scripts/deploy.sh --env-only

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/deploy.sh" --env-only "$@"
