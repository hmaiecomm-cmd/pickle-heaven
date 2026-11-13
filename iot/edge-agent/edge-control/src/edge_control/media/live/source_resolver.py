"""camera_id -> mapped NVR binding.  Callers can never supply a source URL; only mapped cameras can stream."""
from __future__ import annotations

from edge_control.config.loader import AppConfig
from edge_control.config.schema import CameraBinding, CameraConfig
from edge_control.drivers.base.nvr_driver import NvrDriver
from edge_control.errors import Conflict, NotFound
from edge_control.mapping.service import DeploymentService


class CameraResolver:
    def __init__(self, cfg: AppConfig, deployment: DeploymentService, nvr: NvrDriver):
        self.cfg, self.deployment, self.nvr = cfg, deployment, nvr

    def lookup(self, camera_id: str) -> tuple[int, CameraBinding | None]:
        rev, dep = self.deployment.active()
        return rev, next((c for c in dep.cameras if c.camera_id == camera_id), None)

    def require(self, camera_id: str, need: str) -> tuple[int, CameraConfig, CameraBinding]:
        cam = self.cfg.camera(camera_id)
        if cam is None:
            raise NotFound("camera not found", code="camera_not_found")
        rev, b = self.lookup(camera_id)
        if b is None or b.mapping_status != "active" or not b.nvr_channel:
            raise Conflict("camera has no active NVR channel mapping", code="camera_unbound",
                           details={"camera_id": camera_id, "mapping_status": b.mapping_status if b else "unbound"})
        flag = {"live": b.live_capable, "search": b.search_capable, "playback": b.playback_capable}[need]
        if not flag:
            raise Conflict(f"camera mapping does not declare {need} capability", code="camera_capability_unavailable",
                           details={"camera_id": camera_id, "capability": need})
        return rev, cam, b

    def describe(self, camera_id: str) -> dict:
        cam = self.cfg.camera(camera_id)
        _rev, b = self.lookup(camera_id)
        mapped = bool(b and b.mapping_status == "active")
        return {"camera_id": cam.camera_id, "number": cam.number, "name": cam.name, "location": cam.location,
                "scope": cam.scope, "expected_enabled": cam.expected_enabled,
                "mapping_status": b.mapping_status if b else "unbound",
                "live_available": bool(mapped and b.live_capable), "search_available": bool(mapped and b.search_capable),
                "playback_available": bool(mapped and b.playback_capable),
                "live_verified": bool(b and b.live_verified_at), "history_verified": bool(b and b.history_verified_at),
                "driver_mode": self.nvr.mode}
