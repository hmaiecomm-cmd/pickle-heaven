"""Logging with secret redaction applied to every record (Authorization, RTSP passwords, device credentials)."""
from __future__ import annotations

import logging

from edge_control.util import redact_text


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.msg = redact_text(record.getMessage())
            record.args = ()
        except Exception:  # noqa: BLE001
            pass
        return True


def setup_logging(level: int = logging.INFO) -> None:
    root = logging.getLogger()
    if not any(isinstance(f, RedactingFilter) for h in root.handlers for f in h.filters):
        if not root.handlers:
            logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
        for h in root.handlers:
            h.addFilter(RedactingFilter())
    root.setLevel(level)
    logging.getLogger("httpx").setLevel(logging.WARNING)  # httpx logs full URLs at INFO
