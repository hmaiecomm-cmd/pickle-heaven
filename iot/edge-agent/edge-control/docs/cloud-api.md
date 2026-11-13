# Cloud interface

The official 顧好雲 contract has **not** been provided. Everything here is **proposed**; nothing claims platform integration.

## Cloud → Edge (REST, the OpenAPI in `contracts/openapi.yaml`)
Bearer token per integration (role `operator`, optionally scoped `devices`/`cameras`); optional `X-Site-Id`/`X-Edge-Id` must equal local identity.
**Network**: production needs a reachable VPN or an authenticated reverse tunnel initiated by the venue. Never assume the cloud can reach a private venue IP.
Booking feed (proposed): `POST /v1/cloud/bookings {events:[{booking_id,court,start,end,status,revision}]}`.

## Edge → Cloud (proposed; disabled while `EDGE_CLOUD_URL` is empty)
- `POST {url}/edge/v1/heartbeat` `{site_id,edge_id,sent_at,mode,mapping_revision,active_commands,outbox}`
- `POST {url}/edge/v1/events` `{site_id,edge_id,events:[{event_id,kind,created_at,payload}]}` → `{"acked":[event_id…]}`; the receiver **must de-duplicate by `event_id`**.
- Kinds: `command.result`, `device.state_snapshot`. Outbox: SQLite, exponential backoff 2s→600s, bounded (`outbox_max_rows`), acked rows deleted, secrets redacted before storage.
`/v1/system/status` → `cloud` shows disabled/enabled, last success, last error.
