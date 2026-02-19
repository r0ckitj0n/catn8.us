#!/bin/bash

# catn8.us Server Monitor
# This script monitors and manages the PHP web server for the catn8.us website.
# Note: Node.js dependency has been eliminated - all APIs now run in PHP.

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PHP_PORT=${PORT:-8888}
# Vite dev server port (must match vite.config.js and hot file)
VITE_PORT=${VITE_DEV_PORT:-5178}
LOG_FILE="$WEBSITE_DIR/logs/monitor.log"
CHECK_INTERVAL=60  # Check every 60 seconds
HTTP_START_TIMEOUT="${CATN8_HTTP_START_TIMEOUT:-120}"
HTTP_START_INTERVAL="${CATN8_HTTP_START_INTERVAL:-2}"
HTTP_WAIT_LOG_INTERVAL="${CATN8_HTTP_WAIT_LOG_INTERVAL:-10}"
HTTP_FAILURE_LOG_LINES="${CATN8_HTTP_FAILURE_LOG_LINES:-20}"
HTTP_SERVER_READY_SECS=0

# Enable local DB usage by default in dev (can be overridden by user)
: "${CATN8_DB_DEV_ALLOW:=1}"
export CATN8_DB_DEV_ALLOW

# Default local DB credentials (overrideable before invoking this script)
: "${CATN8_DB_LOCAL_HOST:=localhost}"
: "${CATN8_DB_LOCAL_DB:=catn8}"
: "${CATN8_DB_LOCAL_USER:=root}"
: "${CATN8_DB_LOCAL_PASS:=}"
: "${CATN8_DB_LOCAL_PORT:=3306}"
# Back-compat alias
: "${CATN8_DB_LOCAL_NAME:=${CATN8_DB_LOCAL_DB}}"
export CATN8_DB_LOCAL_HOST CATN8_DB_LOCAL_DB CATN8_DB_LOCAL_NAME CATN8_DB_LOCAL_USER CATN8_DB_LOCAL_PASS CATN8_DB_LOCAL_PORT

# MySQL/Vite management knobs
: "${CATN8_MANAGE_MYSQL:=1}"
MYSQL_PORT="$CATN8_DB_LOCAL_PORT"
MYSQL_WAIT_SECONDS="${CATN8_MYSQL_WAIT_SECONDS:-20}"
VITE_STOP_TIMEOUT="${CATN8_VITE_STOP_TIMEOUT:-15}"
MYSQL_SERVICE_NAMES=("${CATN8_MYSQL_SERVICE:-}" "mysql" "mysql@8.0" "mariadb")

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log function
log() {
  local message="$1"
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
  echo -e "${timestamp} - ${message}" >> "$LOG_FILE"
  echo -e "${timestamp} - ${message}"
}

# Check if a port is in use
is_port_in_use() {
  local port=$1
  lsof -i :$port >/dev/null 2>&1
  return $?
}

# Wait for a port to close with timeout
wait_for_port_close() {
  local port=$1
  local timeout=$2
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if ! is_port_in_use $port; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed+1))
  done
  return 1
}

# Check if a server is responding
is_server_responding() {
  local url=$1
  curl -s --head --request GET $url | grep "200 OK" >/dev/null 2>&1
  return $?
}

wait_for_http_ready() {
  local timeout=$HTTP_START_TIMEOUT
  local interval=$HTTP_START_INTERVAL
  local elapsed=0
  local next_log=$HTTP_WAIT_LOG_INTERVAL
  local url="http://localhost:$PHP_PORT/"

  while [ $elapsed -lt $timeout ]; do
    if curl -s --max-time 2 --connect-timeout 2 -o /dev/null "$url" >/dev/null 2>&1; then
      HTTP_SERVER_READY_SECS=$elapsed
      return 0
    fi

    sleep $interval
    elapsed=$((elapsed+interval))

    if [ $elapsed -ge $next_log ]; then
      log "${YELLOW}Waiting for HTTP server... (${elapsed}/${timeout}s)${NC}"
      next_log=$((next_log+HTTP_WAIT_LOG_INTERVAL))
    fi
  done

  HTTP_SERVER_READY_SECS=$timeout
  return 1
}

report_http_failure() {
  local log_path="$WEBSITE_DIR/logs/http_server.log"
  if [ -f "$log_path" ]; then
    log "${RED}HTTP server log excerpt (last ${HTTP_FAILURE_LOG_LINES} lines):${NC}"
    tail -n "$HTTP_FAILURE_LOG_LINES" "$log_path" 2>/dev/null | while IFS= read -r line; do
      if [ -n "$line" ]; then
        log "  $line"
      else
        log ""
      fi
    done
  else
    log "${YELLOW}No HTTP server log found at $log_path${NC}"
  fi
}

# Kill lingering processes by pattern
force_kill_processes() {
  local pattern=$1
  pkill -f "$pattern" >/dev/null 2>&1 || true
}

# ===================== MySQL HELPER FUNCTIONS =====================

detect_mysql_service() {
  if [ "$CATN8_MANAGE_MYSQL" != "1" ]; then
    return 1
  fi
  if ! command -v brew >/dev/null 2>&1; then
    return 1
  fi
  local services
  services=$(brew services list 2>/dev/null || true)
  [ -z "$services" ] && return 1
  for svc in "${MYSQL_SERVICE_NAMES[@]}"; do
    [ -z "$svc" ] && continue
    if echo "$services" | grep -E "^${svc}[[:space:]]" >/dev/null 2>&1; then
      echo "$svc"
      return 0
    fi
  done
  return 1
}

start_mysql_service() {
  if [ "$CATN8_MANAGE_MYSQL" != "1" ]; then
    return 0
  fi
  local svc
  svc=$(detect_mysql_service) || return 1
  log "${BLUE}Starting MySQL service via brew services ($svc)...${NC}"
  brew services start "$svc" >/dev/null 2>&1 || true
  wait_for_mysql_ready
}

stop_mysql_service() {
  if [ "$CATN8_MANAGE_MYSQL" != "1" ]; then
    return 0
  fi
  local svc
  svc=$(detect_mysql_service) || return 1
  log "${BLUE}Stopping MySQL service via brew services ($svc)...${NC}"
  brew services stop "$svc" >/dev/null 2>&1 || true
  wait_for_mysql_shutdown
}

wait_for_mysql_ready() {
  if [ "$CATN8_MANAGE_MYSQL" != "1" ]; then
    return 0
  fi
  if ! command -v mysqladmin >/dev/null 2>&1; then
    log "${YELLOW}mysqladmin not found; skipping MySQL readiness probe${NC}"
    return 0
  fi
  local elapsed=0
  local timeout=$MYSQL_WAIT_SECONDS
  while [ $elapsed -lt $timeout ]; do
    if mysqladmin ping -h "$CATN8_DB_LOCAL_HOST" -P "$MYSQL_PORT" --silent >/dev/null 2>&1; then
      log "${GREEN}MySQL responded on $CATN8_DB_LOCAL_HOST:$MYSQL_PORT${NC}"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed+1))
  done
  log "${RED}MySQL did not become ready within ${MYSQL_WAIT_SECONDS}s${NC}"
  return 1
}

wait_for_mysql_shutdown() {
  if wait_for_port_close $MYSQL_PORT $MYSQL_WAIT_SECONDS; then
    log "${GREEN}MySQL port $MYSQL_PORT closed successfully${NC}"
    return 0
  fi
  log "${YELLOW}MySQL port $MYSQL_PORT still busy after ${MYSQL_WAIT_SECONDS}s; forcing shutdown${NC}"
  lsof -ti tcp:$MYSQL_PORT | xargs kill -9 2>/dev/null || true
  if wait_for_port_close $MYSQL_PORT 5; then
    log "${GREEN}MySQL force-stop successful${NC}"
  else
    log "${RED}Unable to stop MySQL process on port $MYSQL_PORT${NC}"
    return 1
  fi
}

# Node.js server functions removed - no longer needed
# All APIs now run in PHP

# Start PHP-FPM server (for concurrent request handling)
start_php_fpm() {
  cd "$WEBSITE_DIR"
  log "${BLUE}Starting PHP-FPM for concurrent request handling...${NC}"
  
  # Check if PHP-FPM is installed
  if ! command -v php-fpm >/dev/null 2>&1; then
    log "${RED}PHP-FPM not found. Installing via Homebrew...${NC}"
    brew install php || {
      log "${RED}Failed to install PHP-FPM. Please install manually: brew install php${NC}"
      return 1
    }
  fi
  
  # Stop any existing PHP-FPM processes
  pkill -9 php-fpm 2>/dev/null || true
  sleep 1
  
  # Start PHP-FPM on port 9000 (FastCGI)
  php-fpm -y /dev/null \
    -d listen=127.0.0.1:9000 \
    -d pm=dynamic \
    -d pm.max_children=10 \
    -d pm.start_servers=3 \
    -d pm.min_spare_servers=2 \
    -d pm.max_spare_servers=5 \
    > logs/php_fpm.log 2>&1 &
  
  sleep 2
  
  if pgrep -q php-fpm; then
    log "${GREEN}PHP-FPM started successfully (concurrent requests enabled)${NC}"
  else
    log "${RED}Failed to start PHP-FPM${NC}"
    return 1
  fi
}

# Start PHP server
start_php_server() {
  cd "$WEBSITE_DIR"
  
  # Start lightweight HTTP server using Python (handles concurrent requests)
  # Note: PHP-FPM not required - Python spawns PHP subprocesses which run concurrently
  log "${BLUE}Starting concurrent PHP server on port $PHP_PORT...${NC}"
  export CATN8_PHP_PORT="$PHP_PORT"
  
  python3 -c '
import http.server
import socketserver
import subprocess
import urllib.parse
import os
import sys
import socket
from pathlib import Path

class ConcurrentPHPHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress default logging to avoid cluttering console
        pass
    
    def do_GET(self):
        self.handle_request()
    
    def do_POST(self):
        self.handle_request()
    
    def do_PUT(self):
        self.handle_request()
    
    def do_DELETE(self):
        self.handle_request()
    
    def handle_request(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.lstrip("/") or "index.php"
        
        # Always use router.php for dynamic routing (handles Vite proxy, PHP routes, etc)
        # Only serve static files directly if they exist in common asset dirs
        static_prefixes = ("/images/", "/dist/", "/fonts/")
        is_static = any(parsed.path.startswith(prefix) for prefix in static_prefixes)
        
        if is_static:
            # Serve static files directly
            try:
                super().do_GET()
            except:
                self.send_error(404)
        else:
            # Route through router.php for everything else (PHP, Vite proxy, etc)
            self.serve_php(path, parsed.query)
    
    def serve_php(self, path, query):
        # Map to file via router.php
        if not path or path.endswith("/"):
            path = "index.php"
        
        # Use router.php for all requests
        file_path = Path("router.php")
        if not file_path.exists():
            file_path = Path(path)
            if not file_path.exists():
                self.send_error(404)
                return
        
        # Set up CGI environment
        env = os.environ.copy()
        env["REQUEST_METHOD"] = self.command
        env["REQUEST_URI"] = self.path
        env["QUERY_STRING"] = query or ""
        env["HTTP_HOST"] = self.headers.get("Host", "localhost:" + os.environ.get("CATN8_PHP_PORT", "8888"))
        env["SCRIPT_FILENAME"] = str(file_path.absolute())
        env["SCRIPT_NAME"] = "/" + path
        env["SERVER_NAME"] = "localhost"
        env["SERVER_PORT"] = os.environ.get("CATN8_PHP_PORT", "8888")
        env["SERVER_PROTOCOL"] = self.request_version
        env["REMOTE_ADDR"] = self.client_address[0]
        
        # Read request body first
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b""
        
        # Set CGI-specific variables (without HTTP_ prefix)
        if content_length > 0:
            env["CONTENT_LENGTH"] = str(content_length)
        content_type = self.headers.get("Content-Type", "")
        if content_type:
            env["CONTENT_TYPE"] = content_type
        
        # Copy all headers as HTTP_* variables
        for key, value in self.headers.items():
            # Skip Content-Length and Content-Type (already set above)
            if key.lower() not in ["content-length", "content-type"]:
                env_key = "HTTP_" + key.upper().replace("-", "_")
                env[env_key] = value
        
        try:
            # Execute PHP in CGI mode so headers are properly emitted
            # Try php-cgi first (proper CGI binary), fallback to php CLI
            php_binary = "php-cgi"
            try:
                subprocess.run([php_binary, "-v"], capture_output=True, check=True)
            except:
                php_binary = "php"
            
            result = subprocess.run(
                [php_binary, "-d", "display_errors=0", "-d", "cgi.force_redirect=0", str(file_path)],
                input=post_data,
                capture_output=True,
                env=env,
                timeout=int(env.get("CATN8_PHP_TIMEOUT", "150")),
                cwd=str(Path.cwd())
            )
            
            # Parse headers from PHP CGI output
            output = result.stdout
            if b"\r\n\r\n" in output:
                headers, body = output.split(b"\r\n\r\n", 1)
            elif b"\n\n" in output:
                headers, body = output.split(b"\n\n", 1)
            else:
                headers = b""
                body = output
            
            # Parse PHP headers and extract status code
            status_code = 200
            php_headers = {}
            has_location = False
            explicit_status = None
            
            if headers:
                for line in headers.decode("utf-8", errors="ignore").split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    if ":" in line:
                        key, value = line.split(":", 1)
                        key = key.strip()
                        value = value.strip()
                        php_headers[key] = value
                        # Check for Status header from PHP
                        if key.lower() == "status":
                            try:
                                explicit_status = int(value.split()[0])
                            except:
                                pass
                        # Detect Location header for redirects
                        if key.lower() == "location":
                            has_location = True
            
            # Determine final status code: prefer explicit Status, fallback to 302 for redirects, else 200
            if explicit_status:
                status_code = explicit_status
            elif has_location:
                status_code = 302
            
            # Send response with correct status
            self.send_response(status_code)
            
            # Send PHP headers
            for key, value in php_headers.items():
                if key.lower() != "status":  # Skip Status header (not a valid HTTP header)
                    self.send_header(key, value)
            
            # Add default Content-Type if not present
            if "Content-Type" not in php_headers and "content-type" not in php_headers:
                self.send_header("Content-Type", "text/html; charset=UTF-8")
            
            self.end_headers()
            self.wfile.write(body)
            
        except subprocess.TimeoutExpired:
            self.send_error(504, "Gateway Timeout")
        except Exception as e:
            self.send_error(500, str(e))

class DualStackServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    address_family = socket.AF_INET6
    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()

PORT = int(os.environ.get("CATN8_PHP_PORT", "8888"))
# Bind to :: to listen on both IPv6 and IPv4 (via dual stack)
with DualStackServer(("::", PORT), ConcurrentPHPHandler) as httpd:
    httpd.allow_reuse_address = True
    print(f"HTTP server started on port {PORT}", file=sys.stderr)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
' > logs/http_server.log 2>&1 &
  
  HTTP_SERVER_PID=$!
  log "${BLUE}Waiting up to ${HTTP_START_TIMEOUT}s for HTTP server to respond...${NC}"

  if wait_for_http_ready; then
    log "${GREEN}HTTP server started successfully after ${HTTP_SERVER_READY_SECS}s (PID: $HTTP_SERVER_PID)${NC}"
    log "${GREEN}✓ Concurrent request handling is now ENABLED${NC}"
    return 0
  fi

  log "${RED}HTTP server failed to become ready within ${HTTP_START_TIMEOUT}s${NC}"
  report_http_failure
  log "${YELLOW}Initiating shutdown of incomplete HTTP server startup...${NC}"
  stop_php_server >/dev/null 2>&1 || true
  return 1
}

# Stop Node.js server function removed - no longer needed

# ===================== VITE DEV SERVER FUNCTIONS =====================

# Re-enable Vite dev mode (only clears env flag; never overrides manual disable)
reenable_vite_dev_mode() {
  cd "$WEBSITE_DIR"
  local changed=0

  if [ -f ".disable-vite-dev" ]; then
    log "${YELLOW}Vite dev intentionally disabled (.disable-vite-dev present); leaving dev server off${NC}"
    return 0
  fi

  if [ "${CATN8_VITE_DISABLE_DEV:-}" = "1" ]; then
    unset CATN8_VITE_DISABLE_DEV
    changed=1
  fi

  if [ $changed -eq 1 ]; then
    log "${BLUE}Re-enabled Vite dev environment variables${NC}"
  fi
}

# Start Vite dev server via PM2 (catn8-vite)
start_vite_server() {
  reenable_vite_dev_mode
  cd "$WEBSITE_DIR"
  if [ -f ".disable-vite-dev" ] || [ "${CATN8_VITE_DISABLE_DEV:-}" = "1" ]; then
    log "${YELLOW}Vite dev server disabled via flag or environment; skipping start${NC}"
    stop_vite_server >/dev/null 2>&1 || true
    if command -v npx >/dev/null 2>&1; then
      npx pm2 delete catn8-vite >/dev/null 2>&1 || true
      npx pm2 delete wf-vite >/dev/null 2>&1 || true
    fi
    rm -f hot
    return 0
  fi

  # Allow callers to override the origin/port; default to localhost:5178
  : "${VITE_PORT:=5178}"
  : "${VITE_DEV_PORT:=$VITE_PORT}"
  : "${VITE_HMR_PORT:=$VITE_PORT}"
  : "${CATN8_VITE_ORIGIN:=http://localhost:${VITE_PORT}}"
  export VITE_DEV_PORT VITE_HMR_PORT CATN8_VITE_ORIGIN
  local normalized_origin="${CATN8_VITE_ORIGIN%/}"

  log "${BLUE}Starting Vite dev server via PM2 on ${normalized_origin}...${NC}"

  # Ensure logs dir exists
  mkdir -p logs

  # Ensure node_modules are installed
  if [ ! -d "node_modules" ]; then
    log "${YELLOW}node_modules not found – installing dependencies (this may take a while)...${NC}"
    npm ci --include=optional --silent || npm install --include=optional --silent
  fi

  # Write hot file explicitly
  echo "$normalized_origin" > hot

  # Start/Restart PM2 app
  if command -v npx >/dev/null 2>&1; then
    npx pm2 start pm2.config.cjs --update-env >/dev/null 2>&1 || true
    npx pm2 restart catn8-vite --update-env >/dev/null 2>&1 || npx pm2 start pm2.config.cjs --update-env >/dev/null 2>&1 || true
    npx pm2 save >/dev/null 2>&1 || true
  else
    log "${RED}npx not found; cannot manage Vite via PM2${NC}"
  fi

  # Wait up to ~8 seconds for @vite/client to respond
  local tries=0
  local health_url="${normalized_origin}/@vite/client"
  while [ $tries -lt 16 ]; do
    if curl -sI "$health_url" | grep -q "200"; then
      log "${GREEN}Vite dev server started successfully via PM2${NC}"
      return 0
    fi
    sleep 0.5
    tries=$((tries+1))
  done

  log "${RED}Failed to start Vite dev server via PM2 – see logs/vite_server.log or 'npx pm2 logs catn8-vite'${NC}"
  return 1
}

# Stop Vite dev server
stop_vite_server() {
  cd "$WEBSITE_DIR"
  log "${BLUE}Stopping Vite dev server (PM2)...${NC}"
  if command -v npx >/dev/null 2>&1; then
    npx pm2 stop catn8-vite >/dev/null 2>&1 || true
    npx pm2 delete catn8-vite >/dev/null 2>&1 || true
  fi
  # Also kill any stray listeners
  pkill -f "vite" >/dev/null 2>&1 || true
  pkill -f "npm run dev" >/dev/null 2>&1 || true

  if wait_for_port_close $VITE_PORT $VITE_STOP_TIMEOUT; then
    log "${GREEN}Vite dev server stopped successfully${NC}"
  else
    log "${YELLOW}Vite port $VITE_PORT still busy after ${VITE_STOP_TIMEOUT}s; forcing shutdown${NC}"
    lsof -ti tcp:$VITE_PORT | xargs kill -9 2>/dev/null || true
    if wait_for_port_close $VITE_PORT 5; then
      log "${GREEN}Vite force-stop successful${NC}"
    else
      log "${RED}Unable to stop Vite process on port $VITE_PORT${NC}"
    fi
  fi
  rm -f hot
  return 0
}

# Check & restart Vite server if needed
check_and_restart_vite() {
  cd "$WEBSITE_DIR"
  if [ -f ".disable-vite-dev" ] || [ "${CATN8_VITE_DISABLE_DEV:-}" = "1" ]; then
    log "${YELLOW}Vite dev server disabled; skipping health check${NC}"
    return 0
  fi

  local origin="${CATN8_VITE_ORIGIN:-}"
  if [ -z "$origin" ] && [ -f hot ]; then
    origin="$(cat hot 2>/dev/null)"
  fi
  if [ -z "$origin" ]; then
    origin="http://localhost:${VITE_PORT}"
  fi
  local health_url="${origin%/}/@vite/client"
  if ! is_server_responding "$health_url"; then
    log "${YELLOW}Vite dev server not responding; restarting via PM2...${NC}"
    if command -v npx >/dev/null 2>&1; then
      npx pm2 restart catn8-vite --update-env >/dev/null 2>&1 || npx pm2 start pm2.config.cjs --update-env >/dev/null 2>&1 || true
      npx pm2 save >/dev/null 2>&1 || true
    fi
  else
    log "${GREEN}Vite dev server is running correctly${NC}"
  fi
}

# ===================== EXISTING PHP FUNCTIONS =====================

# Stop PHP server
stop_php_server() {
  log "${BLUE}Stopping PHP web server...${NC}"
  
  # Kill Python HTTP server
  pkill -f "python3.*ConcurrentPHPHandler" || true
  
  # Kill old PHP built-in server if still running
  pkill -f "php -S localhost:$PHP_PORT" || true
  
  # Kill PHP-FPM
  pkill -9 php-fpm 2>/dev/null || true
  
  # Kill anything on the port
  lsof -ti tcp:$PHP_PORT | xargs kill -9 2>/dev/null || true
  
  sleep 1
  if ! is_port_in_use $PHP_PORT; then
    log "${GREEN}PHP web server stopped successfully${NC}"
    return 0
  else
    log "${RED}Failed to stop PHP web server${NC}"
    return 1
  fi
}

# Node.js monitoring function removed - no longer needed

# Check and restart PHP server if needed
check_and_restart_php() {
  if ! is_port_in_use $PHP_PORT; then
    log "${YELLOW}PHP web server is not running. Restarting...${NC}"
    start_php_server
  elif ! is_server_responding "http://localhost:$PHP_PORT"; then
    log "${YELLOW}PHP web server is not responding. Restarting...${NC}"
    stop_php_server
    start_php_server
  else
    log "${GREEN}PHP web server is running correctly${NC}"
  fi
}

# Start all servers
start_all() {
  if [ "$CATN8_MANAGE_MYSQL" = "1" ]; then
    if ! start_mysql_service; then
      log "${YELLOW}MySQL service not managed (missing brew service?). Continuing without DB control.${NC}"
    fi
  fi
  log "${BLUE}Starting catn8.us PHP server...${NC}"
  if ! start_php_server; then
    log "${RED}Aborting startup because the HTTP server never became ready.${NC}"
    return 1
  fi
  log "${BLUE}Starting Vite dev server (PM2)...${NC}"
  start_vite_server
  show_access_info
  return 0
}

# Stop all servers
stop_all() {
  log "${BLUE}Stopping catn8.us Vite dev server...${NC}"
  stop_vite_server
  log "${BLUE}Stopping catn8.us PHP server...${NC}"
  stop_php_server
  if [ "$CATN8_MANAGE_MYSQL" = "1" ]; then
    if ! stop_mysql_service; then
      log "${YELLOW}Unable to stop MySQL service automatically; it may not be managed via brew services${NC}"
    fi
  fi
}

# Restart all servers
restart_all() {
  log "${BLUE}Restarting all catn8.us servers...${NC}"
  stop_all
  sleep 3
  start_all
}

# Check status of PHP server
check_status() {
  echo -e "${BLUE}=== catn8.us Server Status ===${NC}"
  
  if is_port_in_use $PHP_PORT; then
    echo -e "${GREEN}✓ PHP web server is running on port $PHP_PORT${NC}"
  else
    echo -e "${RED}✗ PHP web server is NOT running${NC}"
  fi

  if is_port_in_use $VITE_PORT; then
    echo -e "${GREEN}✓ Vite dev server is listening on port $VITE_PORT${NC}"
  else
    echo -e "${YELLOW}⚠︎ Vite dev server is not running${NC}"
  fi

  if [ "$CATN8_MANAGE_MYSQL" = "1" ]; then
    if command -v mysqladmin >/dev/null 2>&1 && mysqladmin ping -h "$CATN8_DB_LOCAL_HOST" -P "$MYSQL_PORT" --silent >/dev/null 2>&1; then
      echo -e "${GREEN}✓ MySQL responded on $CATN8_DB_LOCAL_HOST:$MYSQL_PORT${NC}"
    elif is_port_in_use $MYSQL_PORT; then
      echo -e "${GREEN}✓ MySQL port $MYSQL_PORT is in use${NC}"
    else
      echo -e "${RED}✗ MySQL appears to be stopped on port $MYSQL_PORT${NC}"
    fi
  fi
  
  show_access_info
}

# Show access information
show_access_info() {
  echo -e "\n${BLUE}=== Access Information ===${NC}"
  echo -e "${GREEN}Website:${NC} http://localhost:$PHP_PORT"
  echo -e "${GREEN}Frontend Hot-Reload (Vite):${NC} http://localhost:$VITE_PORT"
  echo -e "${GREEN}API Endpoints (all PHP-based):${NC}"
  echo -e "  - Items: http://localhost:$PHP_PORT/api/get_items.php"
  echo -e "  - Inventory: http://localhost:$PHP_PORT/api/inventory.php"
  echo -e "  - Orders: http://localhost:$PHP_PORT/api/orders.php"
  echo -e "  - Users: http://localhost:$PHP_PORT/api/users.php"
  echo -e "\n${YELLOW}To set up automatic monitoring, add this to your crontab:${NC}"
  echo -e "*/5 * * * * $WEBSITE_DIR/scripts/server_monitor.sh monitor >> $LOG_FILE 2>&1"
  echo -e "${YELLOW}This will check your PHP server every 5 minutes and restart it if needed.${NC}\n"
}

# Monitor PHP server continuously
monitor() {
  log "${BLUE}Starting continuous monitoring (checking every $CHECK_INTERVAL seconds)...${NC}"
  while true; do
    check_and_restart_php
    check_and_restart_vite
    sleep $CHECK_INTERVAL
  done
}

# Monitor PHP server once
monitor_once() {
  log "${BLUE}Checking PHP server status...${NC}"
  check_and_restart_php
}

# Main function
main() {
  # Create log directory + log file if they don't exist
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
  touch "$LOG_FILE" 2>/dev/null || true
  
  # Process command line arguments
  case "$1" in
    start)
      start_all
      ;;
    stop)
      stop_all
      ;;
    restart)
      restart_all
      ;;
    status)
      check_status
      ;;
    monitor)
      monitor_once
      ;;
    daemon)
      monitor
      ;;
    *)
      echo -e "${BLUE}catn8.us Server Monitor${NC}"
      echo -e "Usage: $0 {start|stop|restart|status|monitor|daemon}"
      echo -e "  start   - Start all servers"
      echo -e "  stop    - Stop all servers"
      echo -e "  restart - Restart all servers"
      echo -e "  status  - Check server status"
      echo -e "  monitor - Check and restart servers if needed (run once)"
      echo -e "  daemon  - Continuously monitor and restart servers"
      exit 1
      ;;
  esac
}

# Run main function with all arguments
main "$@"
