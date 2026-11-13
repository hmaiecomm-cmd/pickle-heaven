import logging

from edge_control.config.loader import default_cameras, default_circuits
from edge_control.drivers.nvr.hikvision import rtsp_source
from edge_control.config.schema import CameraBinding, HikvisionConfig
from edge_control.config.settings import HikvisionEnv
from edge_control.errors import NotConfigured
from edge_control.logging_setup import RedactingFilter
from edge_control.util import build_rtsp_url, redact_obj, redact_text, strip_url_credentials

import pytest


def test_exactly_18_unique_circuits_and_single_water_heater():
    cs = default_circuits()
    assert len(cs) == 18 and len({c.circuit_id for c in cs}) == 18
    assert [c.number for c in cs] == list(range(1, 19))
    heaters = [c for c in cs if "熱水器" in c.name]
    assert len(heaters) == 1 and heaters[0].circuit_id == "circuit-09"
    assert "儲熱型" in heaters[0].source_note and heaters[0].issue  # duplicate row preserved as a note + issue
    assert all(c.load_w != 0 for c in cs)  # unknown power is None, never 0
    assert cs[4].load_w is None and cs[10].load_w == 100 and cs[12].load_w == 6315


def test_control_modes_and_protection_flags():
    cs = {c.circuit_id: c for c in default_circuits()}
    for n in (1, 2): assert cs[f"circuit-0{n}"].follows == "court_a"
    for n in (3, 4): assert cs[f"circuit-0{n}"].follows == "court_b"
    for n in (5, 6, 7, 8, 9): assert cs[f"circuit-0{n}"].schedule.start == "08:00" and cs[f"circuit-0{n}"].schedule.end == "22:00"
    for n in (10, 11): assert (cs[f"circuit-{n}"].schedule.start, cs[f"circuit-{n}"].schedule.end) == ("18:00", "22:00")
    for n in range(12, 17): assert cs[f"circuit-{n}"].control_mode == "always_on_bypass" and cs[f"circuit-{n}"].wiring_mode == "hardware_bypass"
    assert cs["circuit-14"].critical_power
    for n in (17, 18): assert not cs[f"circuit-{n}"].enabled and cs[f"circuit-{n}"].control_mode == "reserved"
    assert all(c.offline_policy == "unconfigured" for c in cs.values())


def test_six_cameras_fixed_order_and_names():
    cams = default_cameras()
    assert [c.camera_id for c in cams] == [f"camera-0{i}" for i in range(1, 7)]
    assert [c.name for c in cams] == ["入口密碼鎖攝影機", "門內入口攝影機", "休息區攝影機", "球場 A 攝影機", "Pro Shop 室內攝影機", "球場 B 攝影機"]
    assert all(c.deployment_status == "unbound" for c in cams)


# ---------------------------------------------------------------- credentials & redaction
def test_rtsp_url_percent_encodes_special_characters():
    url = build_rtsp_url("10.0.0.5", 554, "/x/1", "admin", "p@ss:w/o#rd%?&")
    assert url.startswith("rtsp://admin:p%40ss%3Aw%2Fo%23rd%25%3F%26@10.0.0.5:554/x/1")
    assert strip_url_credentials(url) == "rtsp://10.0.0.5:554/x/1"


def test_redaction_masks_urls_headers_kv_and_known_secrets():
    secret = "p@ss:w/o#rd"
    url = build_rtsp_url("h", 554, "/s", "admin", secret)
    txt = f"error opening {url}: Authorization: Bearer abc.def-ghi password=hunter2 token: zzz1234"
    out = redact_text(txt, [secret])
    for leak in (secret, "p%40ss", "abc.def-ghi", "hunter2", "zzz1234"):
        assert leak not in out
    assert "10" not in redact_text("rtsp://u:pw@10.1.1.1/x").split("@")[0]
    d = redact_obj({"password": "x", "nested": {"api_key": "k", "url": url}, "ok": 1})
    assert d["password"] == "***" and d["nested"]["api_key"] == "***" and secret not in str(d) and d["ok"] == 1


def test_log_filter_masks_records(caplog):
    f = RedactingFilter()
    rec = logging.LogRecord("x", logging.INFO, __file__, 1, "pull rtsp://admin:topsecret@nvr/x failed", (), None)
    f.filter(rec)
    assert "topsecret" not in rec.getMessage()


# ---------------------------------------------------------------- Hikvision RTSP mapping
ENV = HikvisionEnv(host="192.0.2.10", rtsp_port=554, http_port=80, username="u", password="p@ss", _env_file=None)


def _binding(**kw):
    return CameraBinding(camera_id="camera-04", nvr_id="nvr-1", nvr_channel="CH-X", isapi_track_id="TRK-X",
                         rtsp_stream_ids={"main": "MAIN-ID", "sub": "SUB-ID"}, codec="h264", **kw)


def test_rtsp_path_comes_only_from_config_and_profile_selects_stream_id():
    cfg = HikvisionConfig(live_path_template="/stream/{rtsp_stream_id}/live")
    main = rtsp_source.build_live_source(ENV, "u", "p@ss", cfg, _binding(), "main")
    sub = rtsp_source.build_live_source(ENV, "u", "p@ss", cfg, _binding(), "sub")
    assert main.url.endswith("/stream/MAIN-ID/live") and sub.url.endswith("/stream/SUB-ID/live")
    assert "p%40ss" in main.url and main.transport == "tcp" and main.codec == "h264"


def test_rtsp_not_configured_cases():
    with pytest.raises(NotConfigured) as e:
        rtsp_source.build_live_source(ENV, "u", "p", HikvisionConfig(), _binding(), "sub")
    assert e.value.code == "rtsp_template_not_configured"
    cfg = HikvisionConfig(live_path_template="/s/{rtsp_stream_id}")
    b = CameraBinding(camera_id="camera-01")
    with pytest.raises(NotConfigured) as e:
        rtsp_source.build_live_source(ENV, "u", "p", cfg, b, "sub")
    assert e.value.code == "stream_id_not_configured"
    with pytest.raises(NotConfigured) as e:
        rtsp_source.build_live_source(HikvisionEnv(_env_file=None), "", "", cfg, _binding(), "sub")
    assert e.value.code == "nvr_not_configured" and "HIKVISION_HOST" in e.value.message
    with pytest.raises(NotConfigured):
        rtsp_source.build_live_source(ENV, "u", "p", HikvisionConfig(live_path_template="/{evil}"), _binding(), "sub")


def test_logical_ids_are_kept_separate():
    b = _binding()
    assert len({b.camera_id, b.nvr_channel, b.isapi_track_id, b.rtsp_stream_ids["main"]}) == 4
