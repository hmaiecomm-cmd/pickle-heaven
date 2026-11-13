"""Relay (power-circuit DO) driver interface.  Drivers are synchronous: they run in worker threads."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from edge_control.config.schema import BusDef, CircuitBinding, ControllerDef


@dataclass(frozen=True)
class OutputTarget:
    circuit_id: str
    controller: ControllerDef
    binding: CircuitBinding
    bus: BusDef | None = None


@dataclass
class OutputResult:
    reported_on: bool | None  # None => driver could not read the output back
    verification: str = "unverified"  # confirmed | unverified | unknown
    detail: dict[str, Any] = field(default_factory=dict)


class RelayDriver(ABC):
    mode = "unknown"  # "mock" | "real"

    @abstractmethod
    def write_output(self, target: OutputTarget, on: bool) -> OutputResult:
        """Drive ONE configured output. Communication success is NOT proof that the load is energised."""

    @abstractmethod
    def read_output(self, target: OutputTarget) -> OutputResult:
        """Side-effect-free read of the DO state. Raise Unsupported if the profile has no safe read."""
