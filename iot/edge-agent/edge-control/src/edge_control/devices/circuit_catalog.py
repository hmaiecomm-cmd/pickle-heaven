"""Canonical 18-circuit catalog from the venue's power-line list (18powerlinelist.jpg).

Voltages/loads are *planning data from the drawing*, not measurements or ratings.
Unknown power is None (never 0).  Control mode drives the policy engine.
"""
from __future__ import annotations

from typing import Any

# control_mode: reservation | business_hours | night_hours | always_on_bypass | reserved
CIRCUIT_CATALOG: list[dict[str, Any]] = [
    dict(circuit_id="circuit-01", number=1, name="球場 A 主燈（8 盞）", zone="court_a", voltage="220V",
         load_w=2400, load_note="約 300W×8（圖面規劃值）", control_mode="reservation", follows="court_a",
         wiring_mode="unconfirmed"),
    dict(circuit_id="circuit-02", number=2, name="球場 A 涼風扇（4 台）", zone="court_a", voltage="220V",
         load_w=4800, load_note="約 1200W×4（圖面規劃值）", control_mode="reservation", follows="court_a",
         wiring_mode="unconfirmed"),
    dict(circuit_id="circuit-03", number=3, name="球場 B 主燈（8 盞）", zone="court_b", voltage="220V",
         load_w=2400, load_note="約 300W×8（圖面規劃值）", control_mode="reservation", follows="court_b",
         wiring_mode="unconfirmed"),
    dict(circuit_id="circuit-04", number=4, name="球場 B 涼風扇（4 台）", zone="court_b", voltage="220V",
         load_w=4800, load_note="約 1200W×4（圖面規劃值）", control_mode="reservation", follows="court_b",
         wiring_mode="unconfirmed"),
    dict(circuit_id="circuit-05", number=5, name="大門及 Pro Shop 招牌", zone="entrance", voltage="110V/220V 待確認",
         load_w=None, load_note="待確認", control_mode="business_hours", wiring_mode="unconfirmed"),
    dict(circuit_id="circuit-06", number=6, name="Pro Shop 室內照明（含廁所及辦公室）", zone="pro_shop",
         voltage="110V／全電壓燈具", load_w=None, load_note="待確認", control_mode="business_hours",
         wiring_mode="unconfirmed"),
    dict(circuit_id="circuit-07", number=7, name="Pro Shop 室內插座", zone="pro_shop", voltage="110V",
         load_w=None, load_note="待確認", control_mode="business_hours", wiring_mode="unconfirmed"),
    dict(circuit_id="circuit-08", number=8, name="休息區壁掛扇（4 台）", zone="lounge", voltage="220V",
         load_w=None, load_note="待確認", control_mode="business_hours", wiring_mode="unconfirmed"),
    dict(circuit_id="circuit-09", number=9, name="浴室熱水器", zone="bathroom", voltage="220V",
         load_w=None, load_note="待確認，型式待確認", control_mode="business_hours", wiring_mode="unconfirmed",
         source_note="圖片列出兩筆 09 浴室熱水器，其中一筆註記「儲熱型」。",
         issue="熱水器型式（儲熱型／其他）及是否實際有第二台待確認；僅建立一筆 circuit-09，不產生第 19 路。"),
    dict(circuit_id="circuit-10", number=10, name="環境氣氛燈－露營燈", zone="ambient", voltage="110V",
         load_w=None, load_note="瓦數待確認", control_mode="night_hours", wiring_mode="unconfirmed"),
    dict(circuit_id="circuit-11", number=11, name="環境氣氛燈－地燈", zone="ambient", voltage="220V",
         load_w=100, load_note="100W（圖面規劃值）", control_mode="night_hours", wiring_mode="unconfirmed"),
    dict(circuit_id="circuit-12", number=12, name="大門監控及門鎖", zone="entrance", voltage="110V/220V 待確認",
         load_w=None, load_note="待確認", control_mode="always_on_bypass", wiring_mode="hardware_bypass",
         critical_power=True,
         policy_note="電源保持供電；開門由 Access Controller 管理，不可用切斷此迴路代替開門。"),
    dict(circuit_id="circuit-13", number=13, name="Pro Shop 冷氣（3 台）", zone="pro_shop", voltage="220V",
         load_w=6315, load_note="2105W×3（圖面規劃值）", control_mode="always_on_bypass",
         wiring_mode="hardware_bypass", critical_power=True,
         policy_note="電源保持供電；冷氣開關與溫度由 HVAC RS-485 管理，通訊控制不等於電源控制。"),
    dict(circuit_id="circuit-14", number=14, name="辦公室弱電箱專用插座", zone="office", voltage="220V",
         load_w=None, load_note="待確認", control_mode="always_on_bypass", wiring_mode="hardware_bypass",
         critical_power=True, policy_note="可能供應 Edge／網路設備，critical_power 保護。"),
    dict(circuit_id="circuit-15", number=15, name="辦公室電器", zone="office", voltage="110V",
         load_w=None, load_note="待確認", control_mode="always_on_bypass", wiring_mode="hardware_bypass"),
    dict(circuit_id="circuit-16", number=16, name="販賣機專用插座", zone="lounge", voltage="220V",
         load_w=None, load_note="待確認", control_mode="always_on_bypass", wiring_mode="hardware_bypass"),
    dict(circuit_id="circuit-17", number=17, name="預留迴路 1", zone="spare", voltage="220V",
         load_w=None, load_note="未定", control_mode="reserved", wiring_mode="reserved", enabled=False),
    dict(circuit_id="circuit-18", number=18, name="預留迴路 2", zone="spare", voltage="220V",
         load_w=None, load_note="未定", control_mode="reserved", wiring_mode="reserved", enabled=False),
]

DEFAULT_SCHEDULES = {
    "business_hours": {"start": "08:00", "end": "22:00"},
    "night_hours": {"start": "18:00", "end": "22:00"},
}

for _c in CIRCUIT_CATALOG:
    _c.setdefault("enabled", True)
    _c.setdefault("critical_power", False)
    _c.setdefault("follows", None)
    _c.setdefault("source_note", None)
    _c.setdefault("issue", None)
    _c.setdefault("policy_note", None)
    _c["power_confirmed"] = False  # drawing data only; never field-measured here

assert len({c["circuit_id"] for c in CIRCUIT_CATALOG}) == 18
