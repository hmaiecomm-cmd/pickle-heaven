# PROPOSED cloud contract (not official)

Edge → cloud
```
POST /edge/v1/heartbeat   Authorization: Bearer <cloud token>
{"site_id":"site-demo","edge_id":"edge-demo","sent_at":"2026-11-12T02:00:00Z","mode":"real","mapping_revision":3,"active_commands":0,"outbox":{"total":0,"pending":0}}

POST /edge/v1/events
{"site_id":"site-demo","edge_id":"edge-demo","events":[{"event_id":"evt_…","kind":"command.result","created_at":"…","payload":{"command_id":"…","status":"succeeded","verification":"unverified"}}]}
→ 200 {"acked":["evt_…"]}      (receiver de-duplicates by event_id)
```
Cloud → edge: the REST API in `contracts/openapi.yaml`; booking feed `POST /v1/cloud/bookings`.
