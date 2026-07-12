#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV="${NODE_ENV:-production}"
export ORBITFS_CLOUD="${ORBITFS_CLOUD:-1}"
export PANEL_PORT="${PANEL_PORT:-4000}"
export PORT="${PORT:-3939}"
export SORTER_PORT="${SORTER_PORT:-4055}"
export HIVE_ROOT="${HIVE_ROOT:-/data/hive}"
export HIVE_URL="${HIVE_URL:-http://127.0.0.1:${PORT}}"
export SORTER_URL="${SORTER_URL:-http://127.0.0.1:${SORTER_PORT}}"
export HIVE_SERVER_DIR="${HIVE_SERVER_DIR:-/app/orbitfs-mcp}"
export HIVE_LOG_DIR="${HIVE_LOG_DIR:-/app/orbitfs-mcp/logs}"
export SORTER_DIR="${SORTER_DIR:-/app/orbitfs-panel/plugins/OrbitFS Sorter}"

mkdir -p "$HIVE_ROOT" "$HIVE_LOG_DIR" "/app/orbitfs-panel/logs"

terminate() {
  for pid in "${PANEL_PID:-}" "${SORTER_PID:-}" "${MCP_PID:-}"; do
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
    fi
  done
  wait || true
}

trap terminate SIGINT SIGTERM

node /app/orbitfs-mcp/server.js &
MCP_PID=$!

node "/app/orbitfs-panel/plugins/OrbitFS Sorter/server.js" &
SORTER_PID=$!

node /app/orbitfs-panel/server.js &
PANEL_PID=$!

wait -n "$MCP_PID" "$SORTER_PID" "$PANEL_PID"
status=$?
terminate
exit "$status"
