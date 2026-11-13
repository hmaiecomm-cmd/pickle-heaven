"""Pydantic models for the YAML configuration files and the mutable deployment mapping."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class _M(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ------------------------------------------------------------------ site
class SiteConfig(_M):
    site_id: str
    edge_id: str
    timezone: str = "Asia/Taipei"
    display_name: str | None = None


# ------------------------------------------------------------------ static device config (devices.yaml)
DeviceKind = Literal["hvac", "access", "relay_controller"]


class DeviceConfig(_M):
    device_id: str
    kind: DeviceKind
    name: str | None = None
    driver: Literal["mock", "real"] = "mock"
    driver_profile: str | None = None  # e.g. modbus_m7000 | soyal_721_727 | vendor_x
    vendor: str | None = None
    model: str | None = None
    firmware: str | None = None
    bus_id: str | None = None
    node_id: int | None = None  # SOYAL node or Modbus slave/unit id
    do_count: int | None = None
    capabilities: list[str] = Field(default_factory=list)
    min_role: Literal["viewer", "operator", "admin"] = "operator"
    profile_source: str | None = None
    doors: list[str] = Field(default_factory=list)  # access controller: logical doors served
    mock: dict[str, Any] = Field(default_factory=dict)  # mock behaviour knobs (ignored by real drivers)


class DevicesFile(_M):
    devices: list[DeviceConfig]


# ------------------------------------------------------------------ circuits.yaml
class ScheduleWindow(_M):
    start: str = "08:00"
    end: str = "22:00"


class CircuitConfig(_M):
    circuit_id: str
    number: int
    name: str
    zone: str | None = None
    voltage: str | None = None
    load_w: float | None = None
    load_note: str | None = None
    power_confirmed: bool = False
    control_mode: Literal["reservation", "business_hours", "night_hours", "always_on_bypass", "reserved"]
    follows: str | None = None  # court_a / court_b for reservation circuits
    wiring_mode: Literal["relay_switched", "hardware_bypass", "reserved", "unconfirmed"] = "unconfirmed"
    enabled: bool = True
    critical_power: bool = False
    schedule: ScheduleWindow | None = None
    lead_minutes: int | None = None
    lag_minutes: int | None = None
    offline_policy: Literal["hold_last", "turn_off", "turn_on", "unconfigured"] = "unconfigured"
    source_note: str | None = None
    issue: str | None = None
    policy_note: str | None = None


class CircuitsFile(_M):
    circuits: list[CircuitConfig]


# ------------------------------------------------------------------ policies.yaml
class PoliciesConfig(_M):
    lead_minutes: int = 10  # switch on before booking start
    lag_minutes: int = 10  # switch off after booking end
    manual_override_max_minutes: int = 120
    offline_cache_max_minutes: int = 60  # cached bookings are not trusted past this age when cloud is silent
    command_default_ttl_seconds: int = 60
    command_max_ttl_seconds: int = 600
    reconcile_interval_seconds: int = 30
    outbox_max_rows: int = 10000
    outbox_retention_days: int = 7
    maintenance_mode: bool = False
    per_device_rate_limit_per_minute: int = 30


# ------------------------------------------------------------------ media.yaml
class MediaConfig(_M):
    live_ttl_min_seconds: int = 30
    live_ttl_max_seconds: int = 1800
    live_ttl_default_seconds: int = 300
    playback_ttl_min_seconds: int = 60
    playback_ttl_max_seconds: int = 3600
    playback_ttl_default_seconds: int = 900
    max_live_sessions: int = 12
    max_live_sessions_per_actor: int = 8
    max_playback_sessions: int = 4
    max_playback_sessions_per_actor: int = 2
    max_ffmpeg_jobs: int = 4
    prepare_timeout_seconds: int = 25
    temp_dir_max_mb: int = 2048
    stun_urls: list[str] = Field(default_factory=lambda: ["stun:stun.l.google.com:19302"])
    turn_enabled: bool = False
    turn_urls: list[str] = Field(default_factory=list)
    turn_secret_env: str = "EDGE_TURN_SHARED_SECRET"
    turn_credential_ttl_seconds: int = 300
    cloud_media: dict[str, Any] = Field(default_factory=dict)  # protocol+url configured => enabled
    synthetic_source_enabled: bool = False  # demo: ffmpeg lavfi test pattern for live view


# ------------------------------------------------------------------ hikvision.yaml
class HikvisionConfig(_M):
    nvr_id: str = "nvr-1"
    strategy: Literal["rtsp", "isapi", "sdk", "auto"] = "rtsp"
    rtsp_transport: Literal["tcp", "udp", "auto"] = "tcp"
    # Path templates come from the official doc / the actual device; None => not configured.
    # Placeholders: {rtsp_stream_id} {track_id} {start} {end}
    live_path_template: str | None = None
    playback_path_template: str | None = None
    playback_time_format: str | None = None  # strftime pattern required by the device doc
    capabilities: dict[str, bool] = Field(default_factory=lambda: {
        "live_rtsp": False, "isapi_search": False, "isapi_playback": False,
        "sdk_search": False, "sdk_playback": False, "sdk_download": False,
        "pause": False, "speed": False, "seek": False})
    capabilities_confirmed: bool = False
    sdk_binding: Literal["none", "fake", "official"] = "none"
    http_timeout_seconds: float = 8.0
    sdk_worker_timeout_seconds: float = 15.0
    sdk_callback_queue_size: int = 256


# ------------------------------------------------------------------ cameras.yaml (static)
class CameraConfig(_M):
    camera_id: str
    number: int
    name: str
    location: str
    scope: str
    expected_enabled: bool = True
    deployment_status: Literal["unbound", "draft", "validated", "active"] = "unbound"


class CamerasFile(_M):
    nvr_id: str = "nvr-1"
    cameras: list[CameraConfig]


# ------------------------------------------------------------------ deployment mapping (mutable, versioned in SQLite)
MappingStatus = Literal["unbound", "draft", "validated", "active"]


class BusDef(_M):
    bus_id: str
    serial_path: str | None = None  # stable path e.g. /dev/serial/by-id/...
    baudrate: int | None = None
    parity: Literal["N", "E", "O"] | None = None
    data_bits: int | None = None
    stop_bits: float | None = None
    timeout_s: float | None = 1.0
    protocol_profile: Literal["modbus_rtu", "soyal_binary", "unspecified"] = "unspecified"
    note: str | None = None


class ControllerDef(_M):
    controller_id: str
    kind: Literal["relay_controller", "access", "hvac"] = "relay_controller"
    vendor: str | None = None
    model: str | None = None
    firmware: str | None = None
    protocol: Literal["modbus_m7000", "soyal_721_727", "unspecified"] = "unspecified"
    bus_id: str | None = None
    node_id: int | None = None
    do_count: int | None = None
    capabilities: list[str] = Field(default_factory=list)
    modbus_functions: list[int] = Field(default_factory=list)  # operator-confirmed for the physical model
    profile_source: str | None = None
    profile_pages: str | None = None
    model_confirmed: bool = False
    simulation_only: bool = False


class ModbusBinding(_M):
    table_type: Literal["coil", "discrete_input", "input_register", "holding_register"] | None = None
    reference_address: str | None = None  # document string e.g. "00001" (Base 1)
    base: int = 1
    read_function: int | None = None
    write_function: int | None = None


class SoyalBinding(_M):
    command: str | None = None  # e.g. "0x21"
    selector: str | None = None  # document-defined output selector (e.g. "0x82")


class CircuitBinding(_M):
    circuit_id: str
    wiring_mode: Literal["relay_switched", "hardware_bypass", "reserved", "unconfirmed"] = "unconfirmed"
    controller_id: str | None = None
    physical_output_channel: int | None = None
    modbus: ModbusBinding | None = None
    soyal: SoyalBinding | None = None
    active_polarity: Literal["high", "low"] | None = None
    feedback_type: Literal["none", "do_readback", "auxiliary_contact", "current_sensor", "other"] = "none"
    feedback_source: str | None = None
    interlock_group: str | None = None
    mapping_status: MappingStatus = "unbound"
    hardware_verified_at: datetime | None = None
    verified_by: str | None = None
    note: str | None = None


class NvrDef(_M):
    nvr_id: str
    vendor: str = "hikvision"
    model: str | None = None
    firmware: str | None = None
    timezone: str = "Asia/Taipei"
    driver: Literal["mock", "real"] = "mock"
    note: str | None = None


class CameraBinding(_M):
    camera_id: str
    nvr_id: str | None = None
    nvr_channel: str | None = None
    isapi_track_id: str | None = None
    sdk_channel_id: str | None = None
    rtsp_stream_ids: dict[str, str | None] = Field(default_factory=lambda: {"main": None, "sub": None})
    codec: str | None = None
    audio_capability: bool | None = None
    live_capable: bool = False
    search_capable: bool = False
    playback_capable: bool = False
    live_verified_at: datetime | None = None
    history_verified_at: datetime | None = None
    duplicate_intent_confirmed: bool = False
    mapping_status: MappingStatus = "unbound"
    hardware_verified_at: datetime | None = None
    note: str | None = None


class Deployment(_M):
    simulation_only: bool = False
    buses: list[BusDef] = Field(default_factory=list)
    controllers: list[ControllerDef] = Field(default_factory=list)
    circuits: list[CircuitBinding] = Field(default_factory=list)
    nvrs: list[NvrDef] = Field(default_factory=list)
    cameras: list[CameraBinding] = Field(default_factory=list)
