#\!/bin/bash

# restart_servers.sh - Restart WhimsicalFrog development server
# Usage: ./restart_servers.sh
# Now uses concurrent PHP server (compatible with IONOS production)

set -e

# Change to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}catn8.us Server Restart${NC}"
echo -e "${GREEN}Using concurrent PHP server (compatible with IONOS production)${NC}"

# Ensure helper scripts exist
STOP_SCRIPT="$SCRIPT_DIR/stop_servers.sh"
START_SCRIPT="$SCRIPT_DIR/start_servers.sh"

if [ ! -x "$STOP_SCRIPT" ]; then
  echo -e "${RED}Error: stop_servers.sh not found or not executable!${NC}"
  exit 1
fi

if [ ! -x "$START_SCRIPT" ]; then
  echo -e "${RED}Error: start_servers.sh not found or not executable!${NC}"
  exit 1
fi

echo -e "${YELLOW}Stopping existing servers...${NC}"
"$STOP_SCRIPT"

echo -e "${YELLOW}Starting servers...${NC}"
"$START_SCRIPT"

echo -e "${GREEN}Servers restarted successfully.${NC}"
