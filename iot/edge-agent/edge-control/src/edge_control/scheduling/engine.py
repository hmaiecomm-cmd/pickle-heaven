"""Desired-state computation for schedulable circuits (pure functions, no I/O).

Only reservation / business_hours / night_hours circuits are ever scheduled.  Bypass (always-on) and
reserved circuits return desired=None: no schedule, no all-off, no batch can touch them.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from edge_control.config.schema import CircuitConfig, PoliciesConfig

SCHEDULABLE = {"reservation", "business_hours", "night_hours"}


@dataclass(frozen=True)
class Booking:
    booking_id: str
    court: str
    start: datetime  # UTC
    end: datetime  # UTC
    status: str = "active"
    revision: int = 1


@dataclass
class Desired:
    state: str | None  # "on" | "off" | None (no automatic action)
    reason: str
    stale: bool = False
    next_change: datetime | None = None


def merge_intervals(intervals: list[tuple[datetime, datetime]]) -> list[tuple[datetime, datetime]]:
    """Merge overlapping AND touching intervals, so one booking ending never switches off a neighbour."""
    out: list[tuple[datetime, datetime]] = []
    for s, e in sorted(intervals):
        if e <= s:
            continue
        if out and s <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], e))
        else:
            out.append((s, e))
    return out


def booking_windows(bookings: list[Booking], court: str, lead_min: int, lag_min: int) -> list[tuple[datetime, datetime]]:
    iv = [(b.start - timedelta(minutes=lead_min), b.end + timedelta(minutes=lag_min))
          for b in bookings if b.court == court and b.status == "active"]
    return merge_intervals(iv)


def _hm(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


def in_daily_window(now_utc: datetime, tz: ZoneInfo, start: str, end: str) -> bool:
    """Local-time window; start > end means it crosses midnight (e.g. 22:00-02:00)."""
    local = now_utc.astimezone(tz)
    t, s, e = local.time(), _hm(start), _hm(end)
    if s == e:
        return False
    if s < e:
        return s <= t < e
    return t >= s or t < e


def apply_latest_revision(existing: Booking | None, incoming: Booking) -> Booking | None:
    """Returns the booking to store, or None if `incoming` is an older/duplicate revision (ignored)."""
    if existing is not None and incoming.revision <= existing.revision:
        return None
    return incoming


def desired_for_circuit(circuit: CircuitConfig, now: datetime, tz: ZoneInfo, bookings: list[Booking],
                        policies: PoliciesConfig, *, override: tuple[str, datetime] | None = None,
                        last_cloud_sync: datetime | None = None) -> Desired:
    if circuit.control_mode not in SCHEDULABLE or not circuit.enabled:
        return Desired(None, "not_schedulable")
    if override is not None and override[1] > now:
        return Desired(override[0], "manual_override")
    if circuit.control_mode == "reservation":
        if last_cloud_sync is None or now - last_cloud_sync > timedelta(minutes=policies.offline_cache_max_minutes):
            pol = circuit.offline_policy
            if pol == "turn_off":
                return Desired("off", "cloud_stale_turn_off", stale=True)
            if pol == "turn_on":
                return Desired("on", "cloud_stale_turn_on", stale=True)
            if pol == "hold_last":
                return Desired(None, "cloud_stale_hold_last", stale=True)
            return Desired(None, "offline_policy_unconfigured", stale=True)
        lead = circuit.lead_minutes if circuit.lead_minutes is not None else policies.lead_minutes
        lag = circuit.lag_minutes if circuit.lag_minutes is not None else policies.lag_minutes
        wins = booking_windows(bookings, circuit.follows or "", lead, lag)
        for s, e in wins:
            if s <= now < e:
                return Desired("on", "booking_active", next_change=e)
        nxt = next((s for s, _ in wins if s > now), None)
        return Desired("off", "no_booking", next_change=nxt)
    sched = circuit.schedule
    if sched is None:
        return Desired(None, "no_schedule")
    return Desired("on" if in_daily_window(now, tz, sched.start, sched.end) else "off", f"{circuit.control_mode}_window")
