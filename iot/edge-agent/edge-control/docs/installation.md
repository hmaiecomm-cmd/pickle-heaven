# Installation

Run **one** of the two methods — never both (one agent owns the serial ports).

## A. Docker Compose (default: Mock mode)
```bash
cd web && npm ci && npm run build && cd ..
cp .env.example deploy/.env      # edit tokens + EDGE_MEDIA_INTERNAL_SECRET (dev values are NOT for production)
cd deploy && docker compose up -d --build
curl http://localhost:8080/v1/health
```
Hardware: `docker compose -f compose.yaml -f compose.hardware.yaml up -d` after editing the by-id device paths (no `privileged`). Data: volumes `edge-data`, `edge-cache`.
Ports: see `docs/media-streaming.md`. The stack never changes firewalls and never contacts production devices.

## B. systemd (native)
`sudo scripts/install.sh`, edit `/etc/edge-control/edge-control.env` + YAML, `sudo systemctl enable --now edge-control`.
Paths: `/etc/edge-control/` (config), `/var/lib/edge-control/` (SQLite), `/var/cache/edge-control/` (temp/cache). Requires ffmpeg and a MediaMTX instance (`EDGE_MEDIAMTX_*`).

## Local development (no Docker)
```bash
pip install -e ".[dev]" && cp .env.example .env
python -m edge_control.main          # API on :8000, Mock mode
cd web && npm ci && npm run dev      # UI on :5173 (proxies /v1 and /media)
```
The agent refuses to start without `EDGE_AUTH_TOKENS` / `EDGE_AUTH_TOKENS_FILE`.
