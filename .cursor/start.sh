#!/usr/bin/env bash
# Per-boot startup: bring up a local MariaDB instance for the PHP backend.
# Idempotent and safe to run on every boot: it initializes the data directory
# once, starts mysqld only if it is not already listening, and ensures the app
# database and local root access exist.
set -euo pipefail

STATE_DIR="${CATN8_MYSQL_HOME:-$HOME/.catn8}"
DATA_DIR="$STATE_DIR/mysql-data"
SOCKET="$STATE_DIR/mysqld.sock"
PIDFILE="$STATE_DIR/mysqld.pid"
LOGFILE="$STATE_DIR/mysqld.log"

mkdir -p "$STATE_DIR"

# Initialize the data directory once. root@localhost gets empty-password native
# auth so local dev tooling can connect over the socket without sudo.
if [ ! -d "$DATA_DIR/mysql" ]; then
    mkdir -p "$DATA_DIR"
    mariadb-install-db --no-defaults \
        --auth-root-authentication-method=normal \
        --datadir="$DATA_DIR" >/dev/null
fi

# Start mysqld if it is not already accepting connections.
if ! mysqladmin --no-defaults --socket="$SOCKET" ping >/dev/null 2>&1; then
    nohup mariadbd --no-defaults \
        --datadir="$DATA_DIR" \
        --socket="$SOCKET" \
        --pid-file="$PIDFILE" \
        --bind-address=127.0.0.1 \
        --port=3306 \
        >"$LOGFILE" 2>&1 &

    for _ in $(seq 1 60); do
        if mysqladmin --no-defaults --socket="$SOCKET" ping >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

if ! mysqladmin --no-defaults --socket="$SOCKET" ping >/dev/null 2>&1; then
    echo "ERROR: MariaDB failed to start; last log lines:" >&2
    tail -n 40 "$LOGFILE" >&2 || true
    exit 1
fi

# Ensure the app database exists and root can connect over TCP with an empty
# password (matches the local defaults in .env.example). Application tables are
# created on demand by the PHP bootstrap, so no schema import is required here.
mysql --no-defaults --socket="$SOCKET" -u root <<'SQL'
CREATE DATABASE IF NOT EXISTS catn8 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;
FLUSH PRIVILEGES;
SQL

echo "MariaDB ready (socket=$SOCKET, tcp=127.0.0.1:3306, db=catn8)."
