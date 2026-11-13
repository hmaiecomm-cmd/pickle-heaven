from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from edge_control.errors import DeviceError, DeviceTimeout, EdgeError


@dataclass
class Outcome:
    status: str  # succeeded | failed | unknown
    reported_state: dict[str, Any] | None = None
    verification: str = "unverified"  # confirmed | unverified | unknown
    error_code: str | None = None
    error_message: str | None = None
    state_update: dict[str, Any] = field(default_factory=dict)


def outcome_from_exception(e: Exception, *, sent: bool) -> Outcome:
    """Timeout after bytes left the host => unknown (it may or may not have executed).
    Anything that failed before sending, or an explicit device/driver error => failed."""
    if isinstance(e, DeviceTimeout):
        if e.sent or sent:
            return Outcome("unknown", verification="unknown", error_code="device_timeout", error_message=str(e))
        return Outcome("failed", error_code="device_timeout", error_message=str(e))
    if isinstance(e, DeviceError):
        return Outcome("failed", error_code=e.code, error_message=str(e))
    if isinstance(e, EdgeError):
        return Outcome("failed", error_code=e.code, error_message=e.message)
    return Outcome("failed", error_code="internal_error", error_message=f"{type(e).__name__}")
