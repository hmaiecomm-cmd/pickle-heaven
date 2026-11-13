import threading
import time
from datetime import datetime, timedelta, timezone

from edge_control.cloud.client import CloudClient
from edge_control.cloud.event_reporter import EventReporter
from edge_control.drivers.transports.bus import BusManager
from edge_control.errors import Unavailable
from edge_control.storage.database import Database
from edge_control.storage.event_outbox import EventOutbox, backoff_seconds


def test_same_bus_never_runs_concurrently():
    bm = BusManager()
    inside = []
    maxinside = [0]
    lock = threading.Lock()

    def work():
        with bm.exclusive("bus-A"):
            with lock:
                inside.append(1)
                maxinside[0] = max(maxinside[0], len(inside))
            time.sleep(0.03)
            with lock:
                inside.pop()
    ts = [threading.Thread(target=work) for _ in range(8)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert maxinside[0] == 1 and bm.peak["bus-A"] == 1


def test_different_buses_run_in_parallel():
    bm = BusManager()
    barrier = threading.Barrier(2, timeout=2)
    ok = []

    def work(bus):
        with bm.exclusive(bus):
            barrier.wait()   # only passes if BOTH buses are held at the same time
            ok.append(bus)
    ts = [threading.Thread(target=work, args=(b,)) for b in ("bus-A", "bus-B")]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert sorted(ok) == ["bus-A", "bus-B"]


class FlakyCloud(CloudClient):
    enabled = True
    name = "flaky"

    def __init__(self):
        self.fail = True
        self.received: dict[str, int] = {}

    def send_events(self, site_id, edge_id, events):
        if self.fail:
            raise Unavailable("down", code="cloud_unreachable")
        for e in events:
            self.received[e["event_id"]] = self.received.get(e["event_id"], 0) + 1
        return [e["event_id"] for e in events]

    def send_heartbeat(self, *a):
        return {}


def test_outbox_retry_backoff_ack_and_cleanup():
    db = Database(":memory:")
    ob = EventOutbox(db)
    ids = [ob.add("command.result", {"command_id": f"c{i}", "password": "leak-me"}) for i in range(3)]
    assert len(set(ids)) == 3
    assert "leak-me" not in str(db.fetchall("SELECT payload FROM event_outbox"))     # secrets never stored
    cloud = FlakyCloud()
    rep = EventReporter(ob, cloud, "s", "e")
    assert rep.flush_once() == 0 and rep.last_error == "cloud_unreachable"
    rows = db.fetchall("SELECT attempts, next_attempt, last_error FROM event_outbox")
    assert all(r["attempts"] == 1 and r["last_error"] == "cloud_unreachable" for r in rows)
    assert ob.due() == []                       # backed off: not due yet
    db.execute("UPDATE event_outbox SET next_attempt='2000-01-01T00:00:00Z'")
    cloud.fail = False
    assert rep.flush_once() == 3
    assert all(v == 1 for v in cloud.received.values())
    assert ob.stats() == {"total": 0, "pending": 0}   # acknowledged => removed
    assert rep.flush_once() == 0


def test_unacked_events_stay_and_backoff_grows():
    db = Database(":memory:")
    ob = EventOutbox(db)

    class HalfAck(FlakyCloud):
        def send_events(self, s, e, events):
            return [events[0]["event_id"]]
    ob.add("a", {}), ob.add("b", {})
    cloud = HalfAck(); cloud.fail = False
    EventReporter(ob, cloud, "s", "e").flush_once()
    assert ob.stats()["pending"] == 1
    assert [backoff_seconds(n) for n in (1, 2, 3)] == [2, 4, 8] and backoff_seconds(50) == 600


def test_outbox_is_bounded():
    db = Database(":memory:")
    ob = EventOutbox(db, max_rows=5)
    for i in range(12):
        ob.add("k", {"i": i})
    assert ob.stats()["total"] == 5
