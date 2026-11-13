"""Load YAML configuration into validated models and build the seed deployment mapping."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from edge_control.config.schema import (
    BusDef, CameraBinding, CameraConfig, CamerasFile, CircuitBinding, CircuitConfig, CircuitsFile, ControllerDef,
    Deployment, DeviceConfig, DevicesFile, HikvisionConfig, MediaConfig, NvrDef, PoliciesConfig, ScheduleWindow,
    SiteConfig,
)
from edge_control.config.settings import Settings
from edge_control.devices.camera_catalog import CAMERA_CATALOG
from edge_control.devices.circuit_catalog import CIRCUIT_CATALOG, DEFAULT_SCHEDULES


@dataclass
class AppConfig:
    site: SiteConfig
    devices: dict[str, DeviceConfig]
    circuits: list[CircuitConfig]
    cameras: list[CameraConfig]
    nvr_id: str
    policies: PoliciesConfig
    media: MediaConfig
    hikvision: HikvisionConfig
    seed_deployment: Deployment
    warnings: list[str] = field(default_factory=list)

    def circuit(self, circuit_id: str) -> CircuitConfig | None:
        return next((c for c in self.circuits if c.circuit_id == circuit_id), None)

    def camera(self, camera_id: str) -> CameraConfig | None:
        return next((c for c in self.cameras if c.camera_id == camera_id), None)


def _read(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def default_circuits() -> list[CircuitConfig]:
    out = []
    for raw in CIRCUIT_CATALOG:
        c = dict(raw)
        sched = DEFAULT_SCHEDULES.get(c["control_mode"])
        c["schedule"] = ScheduleWindow(**sched) if sched else None
        out.append(CircuitConfig(**c))
    return out


def default_cameras() -> list[CameraConfig]:
    return [CameraConfig(**c) for c in CAMERA_CATALOG]


def unbound_circuit_bindings(circuits: list[CircuitConfig]) -> list[CircuitBinding]:
    """All real controller/channel/address fields are null; wiring_mode mirrors the plan."""
    return [CircuitBinding(circuit_id=c.circuit_id, wiring_mode=c.wiring_mode, mapping_status="unbound")
            for c in circuits]


def unbound_camera_bindings(cameras: list[CameraConfig], nvr_id: str | None = None) -> list[CameraBinding]:
    return [CameraBinding(camera_id=c.camera_id, nvr_id=nvr_id, mapping_status="unbound") for c in cameras]


def mock_deployment(circuits: list[CircuitConfig], cameras: list[CameraConfig], nvr_id: str) -> Deployment:
    """SIMULATION ONLY mapping.  Never copy these ids/channels into a real deployment."""
    switchable = [c for c in circuits if c.wiring_mode != "hardware_bypass" and c.control_mode != "reserved"]
    controller = ControllerDef(
        controller_id="mock-relay-1", kind="relay_controller", vendor="MOCK", model="MOCK-SIMULATOR",
        protocol="unspecified", bus_id="mock-bus-relay", node_id=None, do_count=len(switchable),
        capabilities=["do_write", "do_readback_simulated"], simulation_only=True, model_confirmed=False,
        profile_source="simulation only")
    bindings = []
    ch = 0
    for c in circuits:
        if c in switchable:
            ch += 1
            bindings.append(CircuitBinding(
                circuit_id=c.circuit_id, wiring_mode="relay_switched", controller_id="mock-relay-1",
                physical_output_channel=ch, active_polarity="high", feedback_type="none",
                mapping_status="active", note="SIMULATION ONLY mapping"))
        else:
            bindings.append(CircuitBinding(
                circuit_id=c.circuit_id, wiring_mode=c.wiring_mode, mapping_status="unbound"))
    cams = []
    for i, cam in enumerate(cameras, start=1):
        cams.append(CameraBinding(
            camera_id=cam.camera_id, nvr_id=nvr_id, nvr_channel=f"mock-ch-{i}", isapi_track_id=f"mock-track-{i}",
            sdk_channel_id=f"mock-sdk-{i}", rtsp_stream_ids={"main": f"mock-main-{i}", "sub": f"mock-sub-{i}"},
            codec="h264", audio_capability=False, live_capable=True, search_capable=True, playback_capable=True,
            mapping_status="active", note="SIMULATION ONLY mapping"))
    return Deployment(
        simulation_only=True,
        buses=[BusDef(bus_id="mock-bus-relay", protocol_profile="unspecified", note="SIMULATION ONLY")],
        controllers=[controller], circuits=bindings,
        nvrs=[NvrDef(nvr_id=nvr_id, vendor="mock", driver="mock", note="SIMULATION ONLY")], cameras=cams)


def load_app_config(settings: Settings) -> AppConfig:
    d = settings.config_dir
    warnings: list[str] = []

    site_raw = _read(d / "site.yaml") or {}
    site = SiteConfig(**{"site_id": settings.site_id, "edge_id": settings.id, **site_raw})
    # env identity wins over file so deployments cannot be spoofed by a copied YAML
    site = site.model_copy(update={"site_id": settings.site_id or site.site_id, "edge_id": settings.id or site.edge_id})

    dev_raw = _read(d / "devices.yaml")
    if dev_raw is None:
        warnings.append("devices.yaml missing: using built-in mock devices")
        dev_raw = {"devices": [
            {"device_id": "hvac-1", "kind": "hvac", "name": "冷氣 1", "driver": "mock"},
            {"device_id": "access-1", "kind": "access", "name": "門鎖控制器 1", "driver": "mock", "doors": ["door-1"]},
            {"device_id": "mock-relay-1", "kind": "relay_controller", "name": "Relay（模擬）", "driver": "mock"},
        ]}
    devices = {x.device_id: x for x in DevicesFile(**dev_raw).devices}

    circ_raw = _read(d / "circuits.yaml")
    circuits = CircuitsFile(**circ_raw).circuits if circ_raw else default_circuits()
    cam_raw = _read(d / "cameras.yaml")
    if cam_raw:
        cf = CamerasFile(**cam_raw)
        cameras, nvr_id = cf.cameras, cf.nvr_id
    else:
        cameras, nvr_id = default_cameras(), "nvr-1"

    policies = PoliciesConfig(**(_read(d / "policies.yaml") or {}))
    media = MediaConfig(**(_read(d / "media.yaml") or {}))
    hik = HikvisionConfig(**(_read(d / "hikvision.yaml") or {}))

    buses_raw = _read(d / "buses.yaml") or {}
    if settings.mode == "mock":
        seed = mock_deployment(circuits, cameras, nvr_id)
    else:
        seed = Deployment(
            buses=[BusDef(**b) for b in buses_raw.get("buses", [])],
            controllers=[ControllerDef(**c) for c in buses_raw.get("controllers", [])],
            circuits=unbound_circuit_bindings(circuits),
            nvrs=[NvrDef(nvr_id=nvr_id, driver="real")],
            cameras=unbound_camera_bindings(cameras, nvr_id))

    # structural sanity: exactly 18 unique circuits and six ordered cameras
    ids = [c.circuit_id for c in circuits]
    if len(ids) != 18 or len(set(ids)) != 18:
        raise ValueError(f"circuits.yaml must define exactly 18 unique circuits (got {len(ids)})")
    cam_ids = [c.camera_id for c in cameras]
    if cam_ids != [f"camera-0{i}" for i in range(1, 7)]:
        raise ValueError("cameras.yaml must define camera-01..camera-06 in this fixed order")
    return AppConfig(site=site, devices=devices, circuits=circuits, cameras=cameras, nvr_id=nvr_id,
                     policies=policies, media=media, hikvision=hik, seed_deployment=seed, warnings=warnings)
