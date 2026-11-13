"""Roles (viewer < operator < admin) and per-device / per-camera scoping."""
from __future__ import annotations

from dataclasses import dataclass, field

from edge_control.errors import Forbidden

ROLE_RANK = {"viewer": 1, "operator": 2, "admin": 3}


@dataclass(frozen=True)
class Principal:
    actor: str
    role: str
    devices: tuple[str, ...] = ("*",)
    cameras: tuple[str, ...] = ("*",)
    site_id: str | None = None
    via: str = "bearer"  # bearer | session | internal
    extra: dict = field(default_factory=dict, compare=False, hash=False)

    def has_role(self, minimum: str) -> bool:
        return ROLE_RANK.get(self.role, 0) >= ROLE_RANK[minimum]

    def can_device(self, device_id: str) -> bool:
        return "*" in self.devices or device_id in self.devices

    def can_camera(self, camera_id: str) -> bool:
        return "*" in self.cameras or camera_id in self.cameras


def require_role(p: Principal, minimum: str) -> None:
    if not p.has_role(minimum):
        raise Forbidden(f"requires role {minimum}", code="insufficient_role", details={"required": minimum, "role": p.role})


def require_device(p: Principal, device_id: str, min_role: str = "operator") -> None:
    require_role(p, min_role)
    if not p.can_device(device_id):
        raise Forbidden("token is not allowed to control this device", code="device_not_permitted",
                        details={"device_id": device_id})


def require_camera(p: Principal, camera_id: str) -> None:
    require_role(p, "viewer")
    if not p.can_camera(camera_id):
        raise Forbidden("token is not allowed to view this camera", code="camera_not_permitted",
                        details={"camera_id": camera_id})
