"""Logical device -> driver resolution.  Every device chooses mock or real individually (default mock)."""
from __future__ import annotations

from edge_control.config.loader import AppConfig
from edge_control.config.schema import ControllerDef, DeviceConfig
from edge_control.drivers.access.factory import create_access_driver
from edge_control.drivers.base.access_driver import AccessDriver
from edge_control.drivers.base.hvac_driver import HvacDriver
from edge_control.drivers.base.relay_driver import RelayDriver
from edge_control.drivers.hvac.factory import create_hvac_driver
from edge_control.drivers.relay.factory import create_relay_driver
from edge_control.drivers.transports.bus import BusManager
from edge_control.errors import NotFound
from edge_control.mapping.service import DeploymentService


class DeviceRegistry:
    def __init__(self, cfg: AppConfig, deployment: DeploymentService, buses: BusManager, runtime_mode: str):
        self.cfg, self.deployment, self.buses, self.runtime_mode = cfg, deployment, buses, runtime_mode
        self._hvac: dict[str, HvacDriver] = {}
        self._access: dict[str, AccessDriver] = {}
        self._relay_shared: dict[str, RelayDriver] = {}

    def device(self, device_id: str, kind: str) -> DeviceConfig:
        d = self.cfg.devices.get(device_id)
        if d is None or d.kind != kind:
            raise NotFound(f"{kind} device {device_id} not found", code="device_not_found")
        return d

    def hvac(self, device_id: str) -> tuple[DeviceConfig, HvacDriver]:
        d = self.device(device_id, "hvac")
        if device_id not in self._hvac:
            self._hvac[device_id] = create_hvac_driver(d)
        return d, self._hvac[device_id]

    def door_device(self, door_id: str) -> DeviceConfig:
        for d in self.cfg.devices.values():
            if d.kind == "access" and door_id in d.doors:
                return d
        raise NotFound(f"door {door_id} not found", code="door_not_found")

    def access_for_door(self, door_id: str) -> tuple[DeviceConfig, AccessDriver]:
        d = self.door_device(door_id)
        if d.device_id not in self._access:
            _, dep = self.deployment.active()
            bus = next((b for b in dep.buses if b.bus_id == d.bus_id), None)
            self._access[d.device_id] = create_access_driver(d, bus)
        return d, self._access[d.device_id]

    def relay_driver(self, ctrl: ControllerDef) -> RelayDriver:
        dev = self.cfg.devices.get(ctrl.controller_id)
        use_mock = (dev.driver == "mock") if dev else (self.runtime_mode == "mock")
        return create_relay_driver(ctrl, use_mock, self._relay_shared)

    def hvac_ids(self) -> list[str]:
        return [d.device_id for d in self.cfg.devices.values() if d.kind == "hvac"]

    def door_ids(self) -> list[str]:
        return [door for d in self.cfg.devices.values() if d.kind == "access" for door in d.doors]
