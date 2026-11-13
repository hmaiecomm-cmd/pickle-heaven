# Device mapping: 18 circuits, controllers, buses, cameras

## 18 circuits (`config/examples/circuits.yaml`, source: `18powerlinelist.jpg`)
Voltages/power are planning data from the drawing — **not measurements or ratings**; unknown = `null` (never 0).

| # | Name | V | Planned load | Mode |
|---|---|---|---|---|
| 01 | 球場 A 主燈（8 盞） | 220V | 2400W (≈300W×8) | reservation (court_a) |
| 02 | 球場 A 涼風扇（4 台） | 220V | 4800W (≈1200W×4) | reservation (court_a) |
| 03 | 球場 B 主燈（8 盞） | 220V | 2400W | reservation (court_b) |
| 04 | 球場 B 涼風扇（4 台） | 220V | 4800W | reservation (court_b) |
| 05 | 大門及 Pro Shop 招牌 | 110/220V ? | ? | business_hours 08–22 |
| 06 | Pro Shop 室內照明 | 110V/全電壓 | ? | business_hours |
| 07 | Pro Shop 室內插座 | 110V | ? | business_hours |
| 08 | 休息區壁掛扇（4 台） | 220V | ? | business_hours |
| 09 | 浴室熱水器 | 220V | ? (type ?) | business_hours |
| 10 | 露營燈 | 110V | ? | night_hours 18–22 |
| 11 | 地燈 | 220V | 100W | night_hours |
| 12 | 大門監控及門鎖 | 110/220V ? | ? | always_on_bypass |
| 13 | Pro Shop 冷氣（3 台） | 220V | 6315W (2105W×3) | always_on_bypass |
| 14 | 辦公室弱電箱插座 | 220V | ? | always_on_bypass + `critical_power` |
| 15 | 辦公室電器 | 110V | ? | always_on_bypass |
| 16 | 販賣機插座 | 220V | ? | always_on_bypass |
| 17–18 | 預留 | 220V | – | reserved (disabled, no binding) |

The drawing lists **two** "09 浴室熱水器" rows (one noted 儲熱型). Only `circuit-09` exists; `source_note` and `issue` keep the duplicate for site follow-up. No 19th circuit.

## Policy engine (single gate)
`commands/policy.py` is used by the API, batch, scheduler, restart recovery and maintenance test-write. Stable codes:
`circuit_always_on_protected` (12–16, both ON and OFF), `circuit_reserved` (17–18), `critical_power_protected`, `circuit_unbound`,
`mapping_not_active`, `controller_missing`, `simulation_mapping_in_real_mode`, `mapping_changed`.
Bypass is a wiring decision: the UI shows "設計常供電 · 供電狀態：未確認" unless an independent read-back exists.
Door opening is Access-controller business (circuit-12 is never used to "open"), AC on/off is HVAC business (circuit-13).

## Scheduler (`scheduling/`)
Reservation circuits follow `booking` events (booking_id + revision; replays/older revisions ignored; cancelled ignored). Intervals are padded with
lead/lag minutes and **merged** (overlap/adjacent) so one ending booking never switches off a neighbour. Business/night windows use
Asia/Taipei and may cross midnight. Cloud data older than `offline_cache_max_minutes` is not trusted: the per-circuit `offline_policy`
decides (`unconfigured` ⇒ no action, flagged). Manual overrides expire (max `manual_override_max_minutes`). The reconciler only submits normal commands.

## Protocol profiles — never mixed
- `modbus_m7000` (M-7000 DIO, V1.18 pp.70–71): Base-1 reference numbers. `00001`→coil offset 0, `00016`→15, `40485`→holding 484 (table_type + reference_address,
  PDU offset computed read-only). Only DO value coils `00001–00016` (R/W) may be written, and never above the controller's confirmed `do_count`.
  Never touched: safe values `00129–00144`, power-on `00161–00176`, `00257` (meaning depends on firmware: `*2` ≤199 clear-latch vs `*1` ≥200 protocol), `40485` module address,
  `40486` baud/parity, polarity bits. Function codes must be in the controller's operator-confirmed list.
- `soyal_721_727`: frame `7E LEN DEST CMD DATA XOR SUM`; 21H relay control; 84H timed door relay (pulse length is set on the controller);
  node 0/FF refused; no 18H polling; 88/89 unsupported. It is an access controller, not an 18-circuit power controller.
- A bus has one protocol; one serial path = one bus. Same offset in different tables ≠ same address; the same physical output cannot be bound twice.

## Deployment mapping workflow (Admin)
System → 部署與位址映射 (tabs: buses, controllers, 18 circuits, cameras/NVR, validate/apply log):
draft (`PUT /v1/mapping/draft`, `expected_revision` = draft revision) → validate → diff → apply (`expected_revision` = active revision) → versions → rollback.
`mapping_status`: unbound → draft → validated (**configuration consistent, hardware not tested**) → active. Apply/rollback only change configuration:
`hardware_commands_sent: 0`. They are refused while the affected bus has in-flight commands or the affected cameras have sessions. Commands store `mapping_revision`
and fail with `mapping_changed` if the mapping moved before execution. "讀取狀態" uses only a side-effect-free read; "測試 ON/OFF" needs Admin + `maintenance_mode: true` +
typed confirmation, one circuit, never bypass/reserved/unbound. All initial real mappings are `null`/`unbound`; the mock mapping is flagged `simulation_only`.
A DO is a *control output*: which contactor it drives and the feedback are site facts recorded in `integration-gaps.md`, not inferred from planned wattage.
