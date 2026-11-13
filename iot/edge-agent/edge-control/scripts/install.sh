#!/usr/bin/env bash
# Native (systemd) install helper. It creates a user, directories and a venv. It does NOT:
#   - start the service, open firewall ports, touch serial devices or contact any NVR/cloud.
# Run as root on the venue PC. Refuses if the Docker stack is running (one agent per serial port).
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo "run as root" >&2; exit 1; fi
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^edge-control-edge-agent'; then
  echo "Docker edge-agent is running; stop it first (only ONE agent may own the serial ports)." >&2; exit 1
fi

SRC="$(cd "$(dirname "$0")/.." && pwd)"
id edge-control >/dev/null 2>&1 || useradd --system --home /var/lib/edge-control --shell /usr/sbin/nologin edge-control
usermod -aG dialout edge-control
install -d -o edge-control -g edge-control -m 750 /var/lib/edge-control /var/cache/edge-control
install -d -o root -g edge-control -m 750 /etc/edge-control /opt/edge-control

python3 -m venv /opt/edge-control/venv
/opt/edge-control/venv/bin/pip install --upgrade pip
/opt/edge-control/venv/bin/pip install "$SRC"

[[ -f /etc/edge-control/edge-control.env ]] || install -m 640 -o root -g edge-control "$SRC/.env.example" /etc/edge-control/edge-control.env
for f in "$SRC"/config/examples/*.yaml; do
  [[ -f /etc/edge-control/$(basename "$f") ]] || install -m 640 -o root -g edge-control "$f" /etc/edge-control/
done
install -m 644 "$SRC/deploy/systemd/edge-control.service" /etc/systemd/system/edge-control.service
systemctl daemon-reload

cat <<'MSG'
Installed. Next (manual):
  1. Edit /etc/edge-control/edge-control.env  (tokens, EDGE_MODE, secrets - keep it mode 640)
  2. Edit /etc/edge-control/*.yaml for your site (keep mock until devices are confirmed)
  3. systemctl enable --now edge-control      (start.sh does the same)
  4. scripts/check_health.sh
MSG
