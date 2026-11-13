"""SDK binding contract + a fake binding for tests.

The OFFICIAL binding must be generated from the headers of the actual downloaded Linux device-network-SDK
package (struct layouts, constants, function signatures, callback types).  Nothing here is recalled from
memory; `load_official_binding` therefore refuses until such a binding module is supplied.
"""
from __future__ import annotations

import itertools
import threading
from datetime import datetime
from typing import Callable, Protocol


class SdkError(Exception):
    """error_class is a stable, credential-free label for health/metrics."""
    error_class = "sdk_error"

    def __init__(self, message: str, error_class: str | None = None):
        super().__init__(message)
        if error_class:
            self.error_class = error_class


class SdkUnavailable(SdkError):
    error_class = "sdk_unavailable"


class SdkLoginFailed(SdkError):
    error_class = "login_failed"


class SdkBinding(Protocol):
    name: str

    def init(self) -> None: ...
    def cleanup(self) -> None: ...
    def login(self, host: str, port: int, user: str, password: str) -> int: ...
    def logout(self, handle: int) -> None: ...
    def search(self, handle: int, channel: str, start: datetime, end: datetime) -> list[dict]: ...
    def start_stream(self, handle: int, channel: str, start: datetime, end: datetime,
                     on_data: Callable[[bytes], None]) -> int: ...
    def stop_stream(self, play_handle: int) -> None: ...


def load_official_binding(sdk_dir: str) -> SdkBinding:
    raise SdkUnavailable(
        "No official binding module is installed. Download the Linux device-network SDK from the official page "
        "(operator step), then generate/adapt a binding from ITS headers. See docs/hikvision-sdk-installation.md.",
        "binding_not_installed")


class FakeSdkBinding:
    """Deterministic fake: valid password is 'fake-ok'. Streams `chunks` payloads through the callback."""
    name = "fake"

    def __init__(self, chunks: int = 5, chunk_size: int = 1024, search_results: list[dict] | None = None):
        self.inited = False
        self.logins: dict[int, str] = {}
        self.streams: dict[int, threading.Event] = {}
        self._ids = itertools.count(1)
        self.chunks, self.chunk_size = chunks, chunk_size
        self.search_results = search_results or []
        self.calls: list[str] = []

    def init(self) -> None:
        self.inited = True
        self.calls.append("init")

    def cleanup(self) -> None:
        self.inited = False
        self.calls.append("cleanup")

    def login(self, host, port, user, password):
        if not self.inited:
            raise SdkError("not initialised", "not_initialised")
        if password != "fake-ok":
            raise SdkLoginFailed("login rejected")
        h = next(self._ids)
        self.logins[h] = host
        self.calls.append(f"login:{h}")
        return h

    def logout(self, handle):
        self.logins.pop(handle, None)
        self.calls.append(f"logout:{handle}")

    def search(self, handle, channel, start, end):
        if handle not in self.logins:
            raise SdkError("invalid handle", "invalid_handle")
        return list(self.search_results)

    def start_stream(self, handle, channel, start, end, on_data):
        if handle not in self.logins:
            raise SdkError("invalid handle", "invalid_handle")
        ph = next(self._ids)
        stop = threading.Event()
        self.streams[ph] = stop

        def run():
            for i in range(self.chunks):
                if stop.is_set():
                    return
                on_data(bytes([i % 256]) * self.chunk_size)

        threading.Thread(target=run, daemon=True).start()
        self.calls.append(f"stream:{ph}")
        return ph

    def stop_stream(self, play_handle):
        ev = self.streams.pop(play_handle, None)
        if ev:
            ev.set()
        self.calls.append(f"stop_stream:{play_handle}")
