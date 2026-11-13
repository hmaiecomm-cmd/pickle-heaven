"""Door-lock controller driver interface."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AccessState:
    lock_output: str = "unknown"  # unlocked | locked | unknown
    door_contact: str = "unknown"  # open | closed | unknown | not_supported
    detail: dict[str, Any] = field(default_factory=dict)


@dataclass
class UnlockResult:
    accepted: bool
    door_contact: str = "unknown"  # a successful unlock command does NOT imply the door opened
    verification: str = "unverified"
    detail: dict[str, Any] = field(default_factory=dict)


class AccessDriver(ABC):
    mode = "unknown"

    @abstractmethod
    def unlock(self, door_id: str) -> UnlockResult:
        """Send ONE unlock. Must never be retried blindly (non-idempotent)."""

    @abstractmethod
    def read_state(self, door_id: str) -> AccessState: ...
