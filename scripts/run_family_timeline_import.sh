#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.local/state"
PID_FILE="$STATE_DIR/family_timeline_import.pid"
LOG_FILE="$STATE_DIR/family_timeline_import.log"
STATE_FILE="$STATE_DIR/family_timeline_state.json"
PY_SCRIPT="$ROOT_DIR/scripts/build_family_timeline_albums.py"

mkdir -p "$STATE_DIR"

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

print_status() {
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    echo "Status: RUNNING (pid=$pid)"
  else
    echo "Status: STOPPED"
  fi
  echo "State file: $STATE_FILE"
  echo "Log file:   $LOG_FILE"
}

start_import() {
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    echo "Import already running (pid=$pid)."
    return 0
  fi

  echo "Starting family timeline import..."
  {
    echo ""
    echo "===== Family timeline import started: $(date '+%Y-%m-%d %H:%M:%S') ====="
  } >> "$LOG_FILE"
  (
    cd "$ROOT_DIR"
    nohup python3 -u "$PY_SCRIPT" --state-file "$STATE_FILE" "$@" >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  )

  sleep 1
  if is_running; then
    echo "Started import process (pid=$(cat "$PID_FILE"))."
  else
    echo "Failed to start import process. See log: $LOG_FILE"
    rm -f "$PID_FILE"
    return 1
  fi
}

stop_import() {
  if ! is_running; then
    echo "No running import process found."
    rm -f "$PID_FILE"
    return 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  echo "Stopping import process pid=$pid ..."
  kill "$pid" 2>/dev/null || true

  for _ in {1..10}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PID_FILE"
      echo "Stopped."
      return 0
    fi
    sleep 1
  done

  echo "Process still running; forcing kill..."
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Killed."
}

monitor_loop() {
  echo "Monitor controls: [k] kill import, [q] quit monitor, [r] refresh"
  while true; do
    clear
    echo "=== Family Timeline Import Monitor ==="
    print_status
    echo ""
    if [[ -f "$LOG_FILE" ]]; then
      echo "--- Recent log output ---"
      tail -n 25 "$LOG_FILE"
    else
      echo "No log file yet."
    fi
    echo ""
    echo "Press k to kill, q to quit monitor."

    local key=""
    IFS= read -rsn1 -t 2 key || true
    case "$key" in
      k|K)
        stop_import
        ;;
      q|Q)
        break
        ;;
      r|R|"")
        ;;
      *)
        ;;
    esac

    if [[ -f "$PID_FILE" ]] && ! is_running; then
      rm -f "$PID_FILE"
    fi
  done
}

usage() {
  cat <<USAGE
Usage:
  $(basename "$0") [start|monitor|status|stop] [-- <python-args>]

Examples:
  $(basename "$0")
  $(basename "$0") start -- --max-albums 2
  $(basename "$0") status
  $(basename "$0") monitor
  $(basename "$0") stop

Default behavior with no command: start + monitor.

Recoverability:
  Uses checkpoint state at: $STATE_FILE
  Re-runs skip completed albums and continue where prior run left off.
USAGE
}

main() {
  local cmd="start-monitor"
  if [[ $# -gt 0 ]]; then
    cmd="$1"
    shift
  fi

  local py_args=()
  if [[ $# -gt 0 ]]; then
    if [[ "$1" == "--" ]]; then
      shift
    fi
    py_args=("$@")
  fi

  case "$cmd" in
    start)
      if (( ${#py_args[@]} > 0 )); then
        start_import "${py_args[@]}"
      else
        start_import
      fi
      ;;
    monitor)
      monitor_loop
      ;;
    status)
      print_status
      ;;
    stop)
      stop_import
      ;;
    start-monitor)
      if (( ${#py_args[@]} > 0 )); then
        start_import "${py_args[@]}"
      else
        start_import
      fi
      monitor_loop
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      echo "Unknown command: $cmd"
      usage
      return 1
      ;;
  esac
}

main "$@"
