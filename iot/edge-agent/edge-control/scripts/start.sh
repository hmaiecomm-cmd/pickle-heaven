#!/usr/bin/env bash
# Start the stack. MODE=compose (default) or MODE=systemd. Refuses to start a second agent.
set -euo pipefail
MODE="${MODE:-compose}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$MODE" == "systemd" ]]; then
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q 'edge-agent'; then
    echo "Docker edge-agent is running; stop it first." >&2; exit 1; fi
  systemctl enable --now edge-control
else
  if systemctl is-active --quiet edge-control 2>/dev/null; then
    echo "systemd edge-control is active; stop it first." >&2; exit 1; fi
  [[ -f "$HERE/deploy/.env" ]] || { cp "$HERE/.env.example" "$HERE/deploy/.env"; echo "created deploy/.env from .env.example (DEV tokens - change them)"; }
  [[ -d "$HERE/web/dist" ]] || echo "warning: web/dist missing; run 'npm ci && npm run build' in web/"
  (cd "$HERE/deploy" && docker compose up -d --build)
fi
