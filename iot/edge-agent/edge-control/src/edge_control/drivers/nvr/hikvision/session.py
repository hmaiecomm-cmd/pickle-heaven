"""Login/logout and handle lifecycle, plus bounded callback buffering (worker side)."""
from __future__ import annotations

import collections
import itertools
import threading
from datetime import datetime
from typing import Callable

from edge_control.drivers.nvr.hikvision.binding import SdkBinding, SdkError
from edge_control.drivers.nvr.hikvision.runtime import SdkRuntime


class ChunkQueue:
    """Bounded FIFO. The SDK callback only copies bytes in (never blocks, never does I/O); on overflow the
    OLDEST chunk is dropped and counted (live-style back-pressure policy)."""

    def __init__(self, maxsize: int = 256):
        self._q: collections.deque[bytes] = collections.deque()
        self.maxsize = maxsize
        self.dropped = 0
        self.total = 0
        self._cv = threading.Condition()
        self.closed = False

    def put(self, data: bytes) -> None:
        chunk = bytes(data)  # copy: the SDK buffer is only valid during the callback
        with self._cv:
            if len(self._q) >= self.maxsize:
                self._q.popleft()
                self.dropped += 1
            self._q.append(chunk)
            self.total += 1
            self._cv.notify()

    def get(self, timeout: float = 0.5) -> bytes | None:
        with self._cv:
            if not self._q and not self.closed:
                self._cv.wait(timeout)
            return self._q.popleft() if self._q else None

    def close(self) -> None:
        with self._cv:
            self.closed = True
            self._cv.notify_all()

    def __len__(self) -> int:
        return len(self._q)


class SdkSessions:
    def __init__(self, runtime: SdkRuntime, queue_size: int = 256):
        self.rt = runtime
        self.queue_size = queue_size
        self._ids = itertools.count(1)
        self._logins: dict[str, int] = {}
        self._streams: dict[str, tuple[int, ChunkQueue, Callable]] = {}  # strong refs to callbacks
        self._lock = threading.Lock()

    def login(self, host: str, port: int, user: str, password: str) -> str:
        self.rt.acquire()
        try:
            h = self.rt.binding.login(host, port, user, password)
        except Exception:
            self.rt.release()
            raise
        sid = f"L{next(self._ids)}"
        with self._lock:
            self._logins[sid] = h
        return sid

    def _handle(self, sid: str) -> int:
        with self._lock:
            if sid not in self._logins:
                raise SdkError("unknown or invalidated session", "invalid_session")
            return self._logins[sid]

    def logout(self, sid: str) -> None:
        with self._lock:
            h = self._logins.pop(sid, None)
            owned = [k for k, v in self._streams.items() if k.startswith(sid + ":")]
        for k in owned:
            self.stop_stream(k)
        if h is not None:
            try:
                self.rt.binding.logout(h)
            finally:
                self.rt.release()

    def search(self, sid: str, channel: str, start: datetime, end: datetime) -> list[dict]:
        return self.rt.binding.search(self._handle(sid), channel, start, end)

    def start_stream(self, sid: str, channel: str, start: datetime, end: datetime) -> tuple[str, ChunkQueue]:
        q = ChunkQueue(self.queue_size)

        def cb(data: bytes) -> None:  # keep tiny: copy into a bounded queue only
            q.put(data)

        ph = self.rt.binding.start_stream(self._handle(sid), channel, start, end, cb)
        key = f"{sid}:{ph}"
        with self._lock:
            self._streams[key] = (ph, q, cb)
        return key, q

    def stop_stream(self, key: str) -> None:
        with self._lock:
            ph, q, _cb = self._streams.pop(key, (None, None, None))
        if ph is not None:
            try:
                self.rt.binding.stop_stream(ph)
            finally:
                q.close()  # type: ignore[union-attr]

    def logout_all(self) -> None:
        for sid in list(self._logins):
            self.logout(sid)

    def counts(self) -> dict[str, int]:
        return {"logins": len(self._logins), "streams": len(self._streams)}
