#!/usr/bin/env bash
# Prints /v1/health. With EDGE_TOKEN set, also prints a short /v1/system/status summary. Read-only.
set -euo pipefail
BASE="${EDGE_URL:-http://127.0.0.1:8080}"
curl -fsS "$BASE/v1/health"; echo
if [[ -n "${EDGE_TOKEN:-}" ]]; then
  curl -fsS -H "Authorization: Bearer $EDGE_TOKEN" "$BASE/v1/system/status" \
   | python3 -c 'import json,sys; s=json.load(sys.stdin); print({k:s[k] for k in ("status","mode","simulation_mapping","mapping_revision")}); print("media:",s["media"]["gateway"]); print("nvr:",s["nvr"]["driver"], s["nvr"]["sdk"]["state"]); print("cloud:",s["cloud"]["enabled"], s["cloud"]["outbox"])'
fi
