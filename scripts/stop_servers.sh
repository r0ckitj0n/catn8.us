#!/bin/bash

# catn8.us Website Stopper
# This script stops the catn8.us website servers and monitoring daemon

# Set up colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Derive project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo -e "${BLUE}=== catn8.us Website Stopper ===${NC}"
echo -e "${BLUE}Stopping all servers and monitoring daemon...${NC}"

# Check if the monitoring script exists, if not display an error
if [ ! -f "./scripts/server_monitor.sh" ]; then
  echo -e "${RED}Error: scripts/server_monitor.sh not found!${NC}"
  echo -e "${YELLOW}Please make sure you're running this script from the correct directory.${NC}"
  exit 1
fi

# Make sure the monitoring script is executable
chmod +x ./scripts/server_monitor.sh

# Stop all servers using the monitor script
echo -e "\n${BLUE}Stopping servers...${NC}"
./scripts/server_monitor.sh stop

# Stop the monitor daemon
echo -e "\n${BLUE}Stopping server monitor daemon...${NC}"
pkill -f 'scripts/server_monitor.sh daemon' || true

# Check if monitor daemon is still running
MONITOR_PID=$(pgrep -f "scripts/server_monitor.sh daemon")
if [ -n "$MONITOR_PID" ]; then
  echo -e "${YELLOW}Server monitor daemon still running (PID: $MONITOR_PID)${NC}"
  echo -e "${YELLOW}Attempting to kill daemon process...${NC}"
  kill $MONITOR_PID 2>/dev/null || true
  sleep 1

  # Final check
  if kill -0 $MONITOR_PID 2>/dev/null; then
    echo -e "${RED}Failed to stop server monitor daemon (PID: $MONITOR_PID)${NC}"
  else
    echo -e "${GREEN}✓ Server monitor daemon stopped successfully${NC}"
  fi
else
  echo -e "${GREEN}✓ Server monitor daemon was not running${NC}"
fi

echo -e "\n${GREEN}=== catn8.us Servers Stopped ===${NC}"
echo -e "${GREEN}All servers and monitoring have been stopped.${NC}"

# Show current status
echo -e "\n${BLUE}Current server status:${NC}"
./scripts/server_monitor.sh status

echo -e "\n${YELLOW}To start the servers again, run:${NC}"
echo -e "  ./scripts/start_servers.sh"
