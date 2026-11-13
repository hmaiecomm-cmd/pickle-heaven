"""Fixed six-camera logical list.  Order and ids are user-specified and must not change.

01..06 are logical numbers only: they do NOT imply NVR channel / ISAPI track / SDK channel / RTSP stream ids.
"""
from __future__ import annotations

CAMERA_CATALOG: list[dict] = [
    dict(camera_id="camera-01", number=1, name="入口密碼鎖攝影機", location="入口密碼鎖所在入口處", scope="監看入口處"),
    dict(camera_id="camera-02", number=2, name="門內入口攝影機", location="門口內側", scope="監看入口內側"),
    dict(camera_id="camera-03", number=3, name="休息區攝影機", location="休息區", scope="監看休息區全場及 Pro Shop 入口"),
    dict(camera_id="camera-04", number=4, name="球場 A 攝影機", location="球場 A", scope="監看球場 A"),
    dict(camera_id="camera-05", number=5, name="Pro Shop 室內攝影機", location="Pro Shop 內部", scope="監看 Pro Shop 內部，包含辦公室入口"),
    dict(camera_id="camera-06", number=6, name="球場 B 攝影機", location="球場 B", scope="監看球場 B"),
]
for _c in CAMERA_CATALOG:
    _c.setdefault("expected_enabled", True)
    _c.setdefault("deployment_status", "unbound")
assert [c["camera_id"] for c in CAMERA_CATALOG] == [f"camera-0{i}" for i in range(1, 7)]
