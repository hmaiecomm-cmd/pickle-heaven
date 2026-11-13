from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from edge_control.config.loader import default_circuits
from edge_control.config.schema import PoliciesConfig
from edge_control.scheduling.engine import (
    Booking, apply_latest_revision, desired_for_circuit, in_daily_window, merge_intervals,
)

UTC = timezone.utc
TZ = ZoneInfo("Asia/Taipei")
POL = PoliciesConfig(lead_minutes=10, lag_minutes=10)
CIRCUITS = {c.circuit_id: c for c in default_circuits()}


def t(h, m=0, day=1):  # UTC helper
    return datetime(2026, 11, day, h, m, tzinfo=UTC)


def bk(i, court, s, e, status="active", rev=1):
    return Booking(i, court, s, e, status, rev)


def test_adjacent_and_overlapping_bookings_merge_so_one_end_does_not_switch_off_the_other():
    c = CIRCUITS["circuit-01"]
    bookings = [bk("a", "court_a", t(2), t(3)), bk("b", "court_a", t(3), t(4)), bk("c", "court_a", t(3, 30), t(5))]
    sync = t(3)
    # 03:05 UTC: booking a has ended (+lag 10min => 03:10) and b/c are running
    d = desired_for_circuit(c, t(3, 15), TZ, bookings, POL, last_cloud_sync=sync)
    assert d.state == "on"
    assert merge_intervals([(t(1), t(2)), (t(2), t(3)), (t(5), t(6))]) == [(t(1), t(3)), (t(5), t(6))]
    # after everything ended + lag => off
    assert desired_for_circuit(c, t(5, 30), TZ, bookings, POL, last_cloud_sync=t(5)).state == "off"


def test_lead_and_lag():
    c = CIRCUITS["circuit-01"]
    b = [bk("a", "court_a", t(10), t(11))]
    assert desired_for_circuit(c, t(9, 45), TZ, b, POL, last_cloud_sync=t(9, 40)).state == "off"
    assert desired_for_circuit(c, t(9, 55), TZ, b, POL, last_cloud_sync=t(9, 40)).state == "on"   # lead
    assert desired_for_circuit(c, t(11, 5), TZ, b, POL, last_cloud_sync=t(11)).state == "on"    # lag
    assert desired_for_circuit(c, t(11, 15), TZ, b, POL, last_cloud_sync=t(11)).state == "off"


def test_cancelled_booking_ignored_and_courts_are_independent():
    a, b_ = CIRCUITS["circuit-01"], CIRCUITS["circuit-03"]
    bookings = [bk("a", "court_a", t(10), t(11), status="cancelled"), bk("b", "court_b", t(10), t(11))]
    now = t(10, 30)
    assert desired_for_circuit(a, now, TZ, bookings, POL, last_cloud_sync=t(10)).state == "off"
    assert desired_for_circuit(b_, now, TZ, bookings, POL, last_cloud_sync=t(10)).state == "on"


def test_older_revision_never_overwrites_newer():
    cur = bk("a", "court_a", t(10), t(11), rev=3)
    assert apply_latest_revision(cur, bk("a", "court_a", t(8), t(9), rev=2)) is None   # stale
    assert apply_latest_revision(cur, bk("a", "court_a", t(10), t(11), rev=3)) is None  # replay
    assert apply_latest_revision(cur, bk("a", "court_a", t(12), t(13), rev=4)).start == t(12)
    assert apply_latest_revision(None, cur) is cur


def test_cross_midnight_window():
    # 22:00-02:00 local (Asia/Taipei = UTC+8)
    assert in_daily_window(datetime(2026, 11, 1, 15, 0, tzinfo=UTC), TZ, "22:00", "02:00")   # 23:00 local
    assert in_daily_window(datetime(2026, 11, 1, 17, 0, tzinfo=UTC), TZ, "22:00", "02:00")   # 01:00 local
    assert not in_daily_window(datetime(2026, 11, 1, 6, 0, tzinfo=UTC), TZ, "22:00", "02:00")  # 14:00 local


def test_business_and_night_hours_use_local_time():
    biz, night = CIRCUITS["circuit-05"], CIRCUITS["circuit-10"]
    noon_local = datetime(2026, 11, 1, 4, 0, tzinfo=UTC)  # 12:00 +08
    late_local = datetime(2026, 11, 1, 15, 0, tzinfo=UTC)  # 23:00 +08
    assert desired_for_circuit(biz, noon_local, TZ, [], POL).state == "on"
    assert desired_for_circuit(biz, late_local, TZ, [], POL).state == "off"
    assert desired_for_circuit(night, noon_local, TZ, [], POL).state == "off"   # 12:00 not in 18-22
    assert desired_for_circuit(night, datetime(2026, 11, 1, 11, 0, tzinfo=UTC), TZ, [], POL).state == "on"  # 19:00 local


def test_bypass_and_reserved_are_never_scheduled():
    for cid in ["circuit-12", "circuit-13", "circuit-14", "circuit-15", "circuit-16", "circuit-17", "circuit-18"]:
        d = desired_for_circuit(CIRCUITS[cid], t(12), TZ, [], POL, override=("off", t(23)), last_cloud_sync=t(12))
        assert d.state is None, cid


def test_stale_cloud_data_is_not_trusted_forever():
    c = CIRCUITS["circuit-01"]
    b = [bk("a", "court_a", t(10), t(20))]
    now = t(12)
    fresh = desired_for_circuit(c, now, TZ, b, POL, last_cloud_sync=t(11, 30))
    assert fresh.state == "on" and not fresh.stale
    stale = desired_for_circuit(c, now, TZ, b, POL, last_cloud_sync=t(9))   # older than 60 min
    assert stale.stale and stale.state is None and stale.reason == "offline_policy_unconfigured"
    never = desired_for_circuit(c, now, TZ, b, POL, last_cloud_sync=None)
    assert never.stale and never.state is None
    c2 = c.model_copy(update={"offline_policy": "turn_off"})
    assert desired_for_circuit(c2, now, TZ, b, POL, last_cloud_sync=t(9)).state == "off"
    c3 = c.model_copy(update={"offline_policy": "hold_last"})
    assert desired_for_circuit(c3, now, TZ, b, POL, last_cloud_sync=t(9)).state is None


def test_manual_override_expires():
    c = CIRCUITS["circuit-05"]
    now = datetime(2026, 11, 1, 4, 0, tzinfo=UTC)  # business hours -> on
    assert desired_for_circuit(c, now, TZ, [], POL, override=("off", now + timedelta(minutes=5))).state == "off"
    assert desired_for_circuit(c, now, TZ, [], POL, override=("off", now - timedelta(minutes=1))).state == "on"
