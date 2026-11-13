"""Stable, machine-readable API errors: {code, message, request_id, details}."""
from __future__ import annotations

from typing import Any


class EdgeError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str | None = None, *, code: str | None = None,
                 status_code: int | None = None, details: dict[str, Any] | None = None):
        super().__init__(message or self.code)
        self.message = message or self.code
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.details = details or {}


class NotFound(EdgeError):
    status_code = 404
    code = "not_found"


class Forbidden(EdgeError):
    status_code = 403
    code = "forbidden"


class Unauthorized(EdgeError):
    status_code = 401
    code = "unauthorized"


class Conflict(EdgeError):
    status_code = 409
    code = "conflict"


class Unprocessable(EdgeError):
    status_code = 422
    code = "invalid_request"


class PolicyError(EdgeError):
    """Control request refused by the policy engine (not a transport failure)."""
    status_code = 409
    code = "policy_denied"


class Unsupported(EdgeError):
    status_code = 501
    code = "unsupported"


class NotConfigured(EdgeError):
    status_code = 503
    code = "not_configured"


class Unavailable(EdgeError):
    status_code = 503
    code = "unavailable"


class DeviceTimeout(Exception):
    """Raised by drivers when no response arrived.  `sent` says whether bytes left the host."""

    def __init__(self, message: str = "device timeout", sent: bool = True):
        super().__init__(message)
        self.sent = sent


class DeviceError(Exception):
    """Device answered with an error / driver failed before anything was sent."""

    def __init__(self, message: str, code: str = "device_error"):
        super().__init__(message)
        self.code = code
