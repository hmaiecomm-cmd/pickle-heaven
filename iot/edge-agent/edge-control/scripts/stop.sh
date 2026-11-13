#!/usr/bin/env bash
set -euo pipefail
MODE="${MODE:-compose}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$MODE" == "systemd" ]]; then systemctl stop edge-control
else (cd "$HERE/deploy" && docker compose down); fi   # SIGTERM + 20s grace: commands finish, ffmpeg/SDK children are reaped
