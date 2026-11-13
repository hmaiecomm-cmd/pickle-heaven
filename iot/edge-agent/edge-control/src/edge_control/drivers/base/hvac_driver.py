"""HVAC (air-conditioner controller) driver interface.

Communication control (on/off, setpoint, mode) is NOT the same as cutting mains power; drivers must never
emulate one with the other.  Features a device lacks must raise Unsupported.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class HvacState:
    power: bool | None = None
    setpoint_c: float | None = None
    mode: str | None = None
    fan: str | None = None
    room_temp_c: float | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {"power": self.power, "setpoint_c": self.setpoint_c, "mode": self.mode, "fan": self.fan,
                "room_temp_c": self.room_temp_c, **self.extra}


class HvacDriver(ABC):
    mode = "unknown"

    @abstractmethod
    def capabilities(self) -> dict[str, Any]:
        """e.g. {"power": True, "setpoint": {"min":16,"max":30,"step":1}, "modes": ["cool","fan"], "fan": []}"""

    @abstractmethod
    def read_state(self) -> HvacState: ...

    @abstractmethod
    def apply_settings(self, *, power: bool | None, setpoint_c: float | None, mode: str | None,
                       fan: str | None) -> HvacState:
        """Apply the requested settings; return the state read back (or best known)."""
