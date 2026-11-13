"""Hikvision RTSP URL construction from configuration.

Nothing is hard-coded about channel numbering: the path template and the per-camera stream identifier come
from hikvision.yaml / the deployment mapping, which the operator fills from the official document and the
device's actual answers.  Credentials are percent-encoded and the full URL is never logged or returned.
"""
from __future__ import annotations

import string
from datetime import datetime

from edge_control.config.schema import CameraBinding, HikvisionConfig
from edge_control.config.settings import HikvisionEnv
from edge_control.drivers.base.nvr_driver import LiveSource
from edge_control.errors import NotConfigured
from edge_control.util import build_rtsp_url

_ALLOWED = {"rtsp_stream_id", "track_id", "start", "end"}


def _fill(template: str, **values: str) -> str:
    keys = {f for _, f, _, _ in string.Formatter().parse(template) if f}
    bad = keys - _ALLOWED
    if bad:
        raise NotConfigured(f"unknown placeholder(s) in path template: {sorted(bad)}", code="bad_path_template")
    return template.format(**values)


def missing_for_rtsp(env: HikvisionEnv, user: str, pw: str) -> list[str]:
    miss = []
    if not env.host:
        miss.append("HIKVISION_HOST")
    if not env.rtsp_port:
        miss.append("HIKVISION_RTSP_PORT")
    if not user:
        miss.append("HIKVISION_USERNAME")
    if not pw:
        miss.append("HIKVISION_PASSWORD")
    return miss


def build_live_source(env: HikvisionEnv, user: str, pw: str, cfg: HikvisionConfig, binding: CameraBinding,
                      profile: str) -> LiveSource:
    miss = missing_for_rtsp(env, user, pw)
    if miss:
        raise NotConfigured(f"NVR connection settings missing: {', '.join(miss)}", code="nvr_not_configured")
    if not cfg.live_path_template:
        raise NotConfigured("hikvision.yaml live_path_template not set (take it from the official RTSP document "
                            "and the actual device)", code="rtsp_template_not_configured")
    sid = (binding.rtsp_stream_ids or {}).get(profile)
    if not sid:
        raise NotConfigured(f"camera {binding.camera_id} has no RTSP stream identifier for profile '{profile}'",
                            code="stream_id_not_configured")
    path = _fill(cfg.live_path_template, rtsp_stream_id=sid, track_id=binding.isapi_track_id or "", start="", end="")
    url = build_rtsp_url(env.host, env.rtsp_port, path, user, pw)  # type: ignore[arg-type]
    return LiveSource(url=url, transport=cfg.rtsp_transport if cfg.rtsp_transport != "auto" else "tcp",
                      codec=binding.codec, kind="rtsp")


def build_playback_url(env: HikvisionEnv, user: str, pw: str, cfg: HikvisionConfig, binding: CameraBinding,
                       start: datetime, end: datetime) -> str:
    miss = missing_for_rtsp(env, user, pw)
    if miss:
        raise NotConfigured(f"NVR connection settings missing: {', '.join(miss)}", code="nvr_not_configured")
    if not (cfg.playback_path_template and cfg.playback_time_format):
        raise NotConfigured("playback_path_template / playback_time_format not set; the history URL format must come "
                            "from the official document", code="playback_template_not_configured")
    if not binding.isapi_track_id:
        raise NotConfigured(f"camera {binding.camera_id} has no track identifier", code="track_id_not_configured")
    # times are formatted in UTC; if the device document requires local time, set the format accordingly in config
    path = _fill(cfg.playback_path_template, rtsp_stream_id="", track_id=binding.isapi_track_id,
                 start=start.strftime(cfg.playback_time_format), end=end.strftime(cfg.playback_time_format))
    return build_rtsp_url(env.host, env.rtsp_port, path, user, pw)  # type: ignore[arg-type]
