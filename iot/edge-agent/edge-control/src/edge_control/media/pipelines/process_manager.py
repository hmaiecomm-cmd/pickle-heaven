"""FFmpeg subprocess supervision: arg arrays only (no shell), bounded concurrency, redacted stderr, clean stop."""
from __future__ import annotations

import collections
import logging
import subprocess
import threading
import time
from dataclasses import dataclass, field
from typing import Callable

from edge_control.errors import EdgeError
from edge_control.util import redact_text

log = logging.getLogger("edge.ffmpeg")


class ResourceLimit(EdgeError):
    status_code = 503
    code = "resource_limit"


@dataclass
class Job:
    job_id: str
    args: list[str]
    secrets: list[str]
    proc: subprocess.Popen | None = None
    started: float = field(default_factory=time.monotonic)
    deadline: float | None = None
    stderr_tail: collections.deque = field(default_factory=lambda: collections.deque(maxlen=40))
    exit_code: int | None = None
    on_exit: Callable[["Job"], None] | None = None

    def tail(self) -> str:
        return redact_text("\n".join(self.stderr_tail), self.secrets)


class ProcessManager:
    def __init__(self, max_jobs: int = 4):
        self.max_jobs = max_jobs
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def count(self) -> int:
        with self._lock:
            return sum(1 for j in self._jobs.values() if j.proc and j.proc.poll() is None)

    def has(self, job_id: str) -> bool:
        j = self._jobs.get(job_id)
        return bool(j and j.proc and j.proc.poll() is None)

    def start(self, job_id: str, args: list[str], *, secrets: list[str] | None = None, max_seconds: float | None = None,
              on_exit: Callable[[Job], None] | None = None) -> Job:
        with self._lock:
            live = sum(1 for j in self._jobs.values() if j.proc and j.proc.poll() is None)
            if live >= self.max_jobs:
                raise ResourceLimit(f"ffmpeg job limit reached ({self.max_jobs})", code="resource_limit")
            if job_id in self._jobs and self._jobs[job_id].proc and self._jobs[job_id].proc.poll() is None:
                return self._jobs[job_id]
            assert isinstance(args, list) and all(isinstance(a, str) for a in args)
            try:
                proc = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                        stderr=subprocess.PIPE, text=True, errors="replace", shell=False)
            except FileNotFoundError as e:
                raise EdgeError("ffmpeg executable not found", code="media_tool_missing", status_code=503) from e
            job = Job(job_id, args, secrets or [], proc, deadline=(time.monotonic() + max_seconds) if max_seconds else None,
                      on_exit=on_exit)
            self._jobs[job_id] = job
        threading.Thread(target=self._pump, args=(job,), name=f"ffmpeg-{job_id}", daemon=True).start()
        if max_seconds:
            threading.Thread(target=self._watchdog, args=(job,), daemon=True).start()
        return job

    def _pump(self, job: Job) -> None:
        assert job.proc and job.proc.stderr
        for line in job.proc.stderr:
            job.stderr_tail.append(line.rstrip())
        job.exit_code = job.proc.wait()
        if job.on_exit:
            try:
                job.on_exit(job)
            except Exception:  # noqa: BLE001
                log.exception("on_exit failed")

    def _watchdog(self, job: Job) -> None:
        while job.proc and job.proc.poll() is None:
            if job.deadline and time.monotonic() > job.deadline:
                log.warning("ffmpeg job %s exceeded its time budget", job.job_id)
                self.stop(job.job_id)
                return
            time.sleep(0.5)

    def stop(self, job_id: str, grace: float = 3.0) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
        if not job or not job.proc:
            return
        if job.proc.poll() is None:
            job.proc.terminate()
            try:
                job.proc.wait(grace)
            except subprocess.TimeoutExpired:
                job.proc.kill()
                job.proc.wait(2)
        with self._lock:
            self._jobs.pop(job_id, None)

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def shutdown(self) -> None:
        for jid in list(self._jobs):
            self.stop(jid, grace=1.5)
