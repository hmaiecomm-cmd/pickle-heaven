# Integration gaps — information still required

Nothing below is guessed in code. Until supplied, the matching *real* driver reports `not_configured` / `unsupported`
and the Mock driver is used for development.

## 1. Air conditioner (HVAC)
- Model/vendor, RS-485 protocol document (Modbus map or vendor frames), serial parameters, address.
- Supported modes, setpoint range/step, fan speeds, read-back registers.
- Status: `drivers/hvac/modbus_driver.py` / `vendor_driver.py` → `not_configured`.
- Remember: communication control ≠ cutting power (circuit-13 is a 24h bypass circuit).

## 2. Door-lock controller
- Confirmed model/firmware. A SOYAL AR-721H/727H protocol PDF was supplied (`vendor/access/docs`), but the real controller
  model is **not confirmed**. Needed: node ID, serial parameters, configured relay pulse time, whether a door-contact/status read
  exists, and whether `18H` polling is acceptable (it can change networking/stand-alone mode, so it is not used).
- AR721W `88/89` DO examples have inconsistent length/text in the PDF → not implemented.

## 3. Relay / 18 power circuits
- Controller model + firmware (an **M-7000 DIO mapping table V1.18 (2025-09)** was supplied; it is a generic table, **not**
  proof of the installed model). Needed: DO count per unit, slave IDs, serial settings, confirmed function codes,
  DO active-state (polarity) setting, safe/power-on values policy, watchdog policy.
- Per circuit: which contactor/driver the DO energises, wiring, feedback (aux contact/current sensor), whether circuit 09's
  heater is 儲熱型 and whether a second heater exists, voltages of 05/12 (110V/220V), unknown loads (null today).
- For 12–16 (hardware bypass): independent supply read-back, if wanted.
- Per reservation circuit: `offline_policy` (what to do when the cloud cache is stale) — all are `unconfigured`.

## 4. NVR (Hikvision)
- Exact model + firmware, Linux CPU architecture of the venue PC, ports (RTSP/HTTP/SDK), user with minimal rights.
- Channel numbering for the six cameras, stream ids (main/sub), codecs (H.264/H.265), audio.
- Whether `Streaming/tracks/...` playback works on this NVR, meaning of the `z` suffix (UTC vs local), ISAPI search
  availability + XML schema for the firmware, ONVIF Profile G, SDK search/playback/download.
- Retention actually kept (the UI shows 14 days but real data decides).

## 5. Cameras
- Encoding/stream settings (codec, bitrate, GOP) per camera; whether sub stream is H.264 (browser-friendly).

## 6. 顧好雲 platform
- Official API contract (auth, endpoints, event schema, booking feed, media receiver protocol), how the cloud reaches the
  venue (VPN or authenticated reverse tunnel), TURN/STUN policy. `contracts/examples/cloud-proposed.md` is **proposed only**.

## 7. Documents that could not be fully read
- Hikvision RTSP page (`knowbot.hikvision.com`): readable in a real browser (live + playback sections read 2026-11-12);
  plain HTTP clients get 403. Camera-side sections were not read.
- Hikvision SDK download page (`open.hikvision.com/...`): not reachable from this environment; **no SDK was downloaded**.
  The operator must download the Linux *device network SDK* manually (see `docs/hikvision-sdk-installation.md`).
