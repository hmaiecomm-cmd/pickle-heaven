"""Isolated SDK worker process.  Reads JSON-lines requests on stdin, writes JSON-lines replies on stdout.

A native crash here kills only this process; the agent's SdkWorkerClient restarts it and treats every
previous session as invalid.  Credentials arrive only in `login` args and are never echoed or logged.
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import traceback
from datetime import datetime

from edge_control.drivers.nvr.hikvision.binding import FakeSdkBinding, SdkError, load_official_binding
from edge_control.drivers.nvr.hikvision.runtime import SdkRuntime
from edge_control.drivers.nvr.hikvision.sdk_loader import check_sdk
from edge_control.drivers.nvr.hikvision.session import SdkSessions


def _dt(v: str) -> datetime:
    return datetime.fromisoformat(v.replace("Z", "+00:00"))


class WorkerApp:
    def __init__(self, binding_name: str, sdk_dir: str, queue_size: int = 256):
        self.binding_name, self.sdk_dir = binding_name, sdk_dir
        self.sessions: SdkSessions | None = None
        self._pumps: dict[str, threading.Thread] = {}
        self._queues: dict[str, object] = {}
        self.queue_size = queue_size
        self.last_error_class: str | None = None

    def _sessions(self) -> SdkSessions:
        if self.sessions is None:
            if self.binding_name == "fake":
                binding = FakeSdkBinding(search_results=[{"start": "2026-01-01T00:00:00Z", "end": "2026-01-01T00:10:00Z"}])
            else:
                binding = load_official_binding(self.sdk_dir)
            self.sessions = SdkSessions(SdkRuntime(binding), self.queue_size)
        return self.sessions

    def handle(self, op: str, a: dict) -> dict:
        if op == "ping":
            return {"pong": True, "binding": self.binding_name}
        if op == "check":
            return check_sdk(self.sdk_dir, try_load=True)
        if op == "health":
            return {"binding": self.binding_name, "last_error_class": self.last_error_class,
                    **(self.sessions.counts() if self.sessions else {"logins": 0, "streams": 0})}
        s = self._sessions()
        if op == "login":
            return {"session": s.login(a["host"], int(a["port"]), a["user"], a["password"])}
        if op == "logout":
            s.logout(a["session"])
            return {}
        if op == "search":
            return {"items": s.search(a["session"], a["channel"], _dt(a["start"]), _dt(a["end"]))}
        if op == "stream_start":
            key, q = s.start_stream(a["session"], a["channel"], _dt(a["start"]), _dt(a["end"]))
            sink = a["sink_path"]

            def pump() -> None:
                with open(sink, "ab", buffering=0) as fh:
                    while True:
                        chunk = q.get(0.5)  # type: ignore[attr-defined]
                        if chunk is None:
                            if q.closed:  # type: ignore[attr-defined]
                                return
                            continue
                        fh.write(chunk)

            t = threading.Thread(target=pump, daemon=True)
            t.start()
            self._pumps[key], self._queues[key] = t, q
            return {"stream": key}
        if op == "stream_stats":
            q = self._queues.get(a["stream"])
            if q is None:
                return {}
            return {"queued": len(q), "dropped": q.dropped, "total": q.total}  # type: ignore[arg-type,attr-defined]
        if op == "stream_stop":
            s.stop_stream(a["stream"])
            t = self._pumps.pop(a["stream"], None)
            if t:
                t.join(2)
            self._queues.pop(a["stream"], None)
            return {}
        if op == "shutdown":
            s.logout_all()
            return {"bye": True}
        raise SdkError(f"unknown op {op}", "bad_request")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--binding", choices=["fake", "official"], default="official")
    ap.add_argument("--sdk-dir", default="")
    ap.add_argument("--queue-size", type=int, default=256)
    ns = ap.parse_args(argv)
    app = WorkerApp(ns.binding, ns.sdk_dir, ns.queue_size)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req = json.loads(line)
        try:
            res = {"id": req["id"], "ok": True, "result": app.handle(req["op"], req.get("args", {}))}
        except SdkError as e:
            app.last_error_class = e.error_class
            res = {"id": req["id"], "ok": False, "error": {"class": e.error_class, "message": str(e)[:300]}}
        except Exception as e:  # noqa: BLE001 - never include args (credentials) in the reply
            app.last_error_class = type(e).__name__
            traceback.print_exc(file=sys.stderr)
            res = {"id": req["id"], "ok": False, "error": {"class": type(e).__name__, "message": "worker error"}}
        sys.stdout.write(json.dumps(res) + "\n")
        sys.stdout.flush()
        if req["op"] == "shutdown":
            break
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
