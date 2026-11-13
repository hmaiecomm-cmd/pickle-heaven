"""Supervisor for the SDK worker subprocess: timeouts, restart after crash, session invalidation, health."""
from __future__ import annotations

import itertools
import json
import os
import subprocess
import sys
import threading
from pathlib import Path
from typing import Any

from edge_control.errors import EdgeError, Unavailable
from edge_control.util import redact_text


class SdkWorkerError(EdgeError):
    status_code = 502
    code = "sdk_worker_error"

    def __init__(self, error_class: str, message: str):
        super().__init__(message, code=f"sdk_{error_class}")
        self.error_class = error_class


class SdkWorkerClient:
    def __init__(self, binding: str, sdk_dir: str = "", timeout_s: float = 15.0, queue_size: int = 256):
        self.binding, self.sdk_dir, self.timeout_s, self.queue_size = binding, sdk_dir, timeout_s, queue_size
        self._proc: subprocess.Popen | None = None
        self._lock = threading.Lock()
        self._ids = itertools.count(1)
        self.generation = 0  # increments on every (re)start; sessions of older generations are invalid
        self.restarts = 0
        self.last_error_class: str | None = None

    # ------------------------------------------------------------ process
    def _spawn(self) -> None:
        pkg_parent = str(Path(__file__).resolve().parents[4])  # directory that contains the edge_control package
        env = {**os.environ, "PYTHONPATH": pkg_parent + os.pathsep + os.environ.get("PYTHONPATH", "")}
        self._proc = subprocess.Popen(
            [sys.executable, "-m", "edge_control.drivers.nvr.hikvision.worker", "--binding", self.binding,
             "--sdk-dir", self.sdk_dir, "--queue-size", str(self.queue_size)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1, shell=False, env=env)
        self.generation += 1

    def _alive(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def _call(self, op: str, args: dict[str, Any] | None = None) -> dict:
        with self._lock:
            if not self._alive():
                if self._proc is not None:
                    self.restarts += 1
                self._spawn()
            assert self._proc and self._proc.stdin and self._proc.stdout
            rid = next(self._ids)
            try:
                self._proc.stdin.write(json.dumps({"id": rid, "op": op, "args": args or {}}) + "\n")
                self._proc.stdin.flush()
            except OSError as e:
                self._kill()
                raise Unavailable("sdk worker unavailable", code="sdk_worker_down") from e
            result: list[str] = []
            t = threading.Thread(target=lambda: result.append(self._proc.stdout.readline()), daemon=True)  # type: ignore[union-attr]
            t.start()
            t.join(self.timeout_s)
            if t.is_alive() or not result or not result[0]:
                self._kill()
                self.last_error_class = "worker_timeout_or_crash"
                raise Unavailable("sdk worker did not answer (restarted); previous sessions are invalid",
                                  code="sdk_worker_down")
            reply = json.loads(result[0])
        if not reply["ok"]:
            self.last_error_class = reply["error"]["class"]
            raise SdkWorkerError(reply["error"]["class"], redact_text(reply["error"]["message"]))
        return reply["result"]

    def _kill(self) -> None:
        if self._proc is not None:
            try:
                self._proc.kill()
                self._proc.wait(2)
            except Exception:  # noqa: BLE001
                pass
        self._proc = None

    # ------------------------------------------------------------ API
    def ping(self) -> dict:
        return self._call("ping")

    def check(self) -> dict:
        return self._call("check")

    def login(self, host: str, port: int, user: str, password: str) -> tuple[str, int]:
        r = self._call("login", {"host": host, "port": port, "user": user, "password": password})
        return r["session"], self.generation

    def logout(self, session: str) -> None:
        if self._alive():
            self._call("logout", {"session": session})

    def search(self, session: str, channel: str, start: str, end: str) -> list[dict]:
        return self._call("search", {"session": session, "channel": channel, "start": start, "end": end})["items"]

    def stream_start(self, session: str, channel: str, start: str, end: str, sink_path: str) -> str:
        return self._call("stream_start", {"session": session, "channel": channel, "start": start, "end": end,
                                           "sink_path": sink_path})["stream"]

    def stream_stats(self, stream: str) -> dict:
        return self._call("stream_stats", {"stream": stream})

    def stream_stop(self, stream: str) -> None:
        if self._alive():
            self._call("stream_stop", {"stream": stream})

    def health(self) -> dict:
        """No credentials, only categories."""
        base = {"binding": self.binding, "running": self._alive(), "generation": self.generation,
                "restarts": self.restarts, "last_error_class": self.last_error_class}
        if self._alive():
            try:
                base.update(self._call("health"))
            except EdgeError:
                base["running"] = False
        return base

    def close(self) -> None:
        if self._alive():
            try:
                self._call("shutdown")
            except EdgeError:
                pass
        self._kill()
