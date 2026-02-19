#!/bin/bash

# WhimsicalFrog Website Starter
# This script starts the WhimsicalFrog website servers and monitoring daemon

# Set up colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Derive project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo -e "${BLUE}=== catn8.us Website Starter ===${NC}"
echo -e "${BLUE}Checking if servers are already running...${NC}"

# Default local behavior: enable Vite dev/HMR unless explicitly disabled
if [ -f ".disable-vite-dev" ] || [ "${CATN8_VITE_DISABLE_DEV:-}" = "1" ]; then
  echo -e "${YELLOW}Vite dev mode is disabled (.disable-vite-dev or CATN8_VITE_DISABLE_DEV=1).${NC}"
else
  rm -f .disable-vite-dev 2>/dev/null || true
  unset CATN8_VITE_DISABLE_DEV || true
fi

# Check if the monitoring script exists, if not display an error
if [ ! -f "./scripts/server_monitor.sh" ]; then
  echo -e "${RED}Error: scripts/server_monitor.sh not found!${NC}"
  echo -e "${YELLOW}Please make sure you're running this script from the correct directory.${NC}"
  exit 1
fi

# Make sure the monitoring script is executable
chmod +x ./scripts/server_monitor.sh

# Check current server status
./scripts/server_monitor.sh status

# Start servers if they're not running
echo -e "\n${BLUE}Starting servers if needed...${NC}"
./scripts/server_monitor.sh start

# Ensure PM2-managed Vite app is started and show status (only when dev mode is enabled)
if [ ! -f ".disable-vite-dev" ] && [ "${CATN8_VITE_DISABLE_DEV:-}" != "1" ]; then
  if command -v npx >/dev/null 2>&1; then
    npx pm2 start pm2.config.cjs >/dev/null 2>&1 || true
    echo -e "\n${BLUE}PM2 status for catn8-vite:${NC}"
    npx pm2 status catn8-vite || true
  fi
fi

# Check if monitor daemon is already running
MONITOR_PID=$(pgrep -f "scripts/server_monitor.sh daemon")

if [ -n "$MONITOR_PID" ]; then
  echo -e "\n${GREEN}✓ Server monitor daemon is already running (PID: $MONITOR_PID)${NC}"
else
  echo -e "\n${YELLOW}Starting server monitor daemon...${NC}"
  # Ensure logs directory exists
  mkdir -p logs
  # Start the monitor daemon in the background
  ./scripts/server_monitor.sh daemon > logs/monitor.log 2>&1 &
  DAEMON_PID=$!
  sleep 2
  
  # Verify the daemon started successfully
  if kill -0 $DAEMON_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Server monitor daemon started successfully (PID: $DAEMON_PID)${NC}"
    echo -e "${GREEN}  The daemon will automatically restart your server if it crashes${NC}"
  else
    echo -e "${RED}✗ Failed to start server monitor daemon${NC}"
  fi
fi

echo -e "\n${GREEN}=== catn8.us Website is Ready! ===${NC}"
echo -e "${GREEN}You can now access your website at:${NC} http://localhost:${PORT:-8888}"
if [ ! -f ".disable-vite-dev" ] && [ "${CATN8_VITE_DISABLE_DEV:-}" != "1" ]; then
  echo -e "${GREEN}Vite (HMR) is at:${NC} http://localhost:${VITE_DEV_PORT:-5178}"
else
  echo -e "${GREEN}Vite (HMR) is:${NC} disabled"
fi
echo -e "\n${BLUE}Active Monitoring:${NC}"
echo -e "  • Server monitor daemon is running in the background"
echo -e "  • Your server will automatically restart if it crashes"
echo -e "  • Monitor logs are saved to logs/monitor.log"
echo -e "\n${YELLOW}To stop the servers and monitor, run:${NC}"
echo -e "  ./scripts/server_monitor.sh stop && pkill -f 'scripts/server_monitor.sh daemon'"
echo -e "\n${YELLOW}To restart the servers, run:${NC}"
echo -e "  ./scripts/server_monitor.sh restart"
echo -e "\n${YELLOW}To check monitor status, run:${NC}"
echo -e "  ps aux | grep 'scripts/server_monitor.sh daemon' | grep -v grep"

