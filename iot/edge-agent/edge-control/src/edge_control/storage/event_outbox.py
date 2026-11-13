"""SQLite event outbox: unique event_id, retry with exponential backoff, bounded retention."""
from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

from edge_control.storage.database import Database
from edge_control.util import new_id, redact_obj, to_iso, utcnow

BACKOFF_BASE_S = 2.0
BACKOFF_MAX_S = 600.0


def backoff_seconds(attempts: int) -> float:
    return min(BACKOFF_MAX_S, BACKOFF_BASE_S * (2 ** max(0, attempts - 1)))


class EventOutbox:
    def __init__(self, db: Database, max_rows: int = 10000, retention_days: int = 7):
        self.db = db
        self.max_rows = max_rows
        self.retention_days = retention_days

    def add(self, kind: str, payload: dict[str, Any], event_id: str | None = None) -> str:
        eid = event_id or new_id("evt")
        now = to_iso(utcnow())
        self.db.execute("""INSERT OR IGNORE INTO event_outbox(event_id,kind,payload,created_at,next_attempt)
            VALUES (:i,:k,:p,:n,:n)""", i=eid, k=kind, p=json.dumps(redact_obj(payload), ensure_ascii=False), n=now)
        self._enforce_limit()
        return eid

    def due(self, limit: int = 50) -> list[dict]:
        rows = self.db.fetchall("""SELECT * FROM event_outbox WHERE acked_at IS NULL AND next_attempt<=:n
            ORDER BY created_at LIMIT :l""", n=to_iso(utcnow()), l=limit)
        for r in rows:
            r["payload"] = json.loads(r["payload"])
        return rows

    def ack(self, event_ids: list[str]) -> None:
        now = to_iso(utcnow())
        for i in event_ids:
            self.db.execute("UPDATE event_outbox SET acked_at=:n WHERE event_id=:i", n=now, i=i)

    def fail(self, event_id: str, error: str) -> None:
        row = self.db.fetchone("SELECT attempts FROM event_outbox WHERE event_id=:i", i=event_id)
        attempts = (row["attempts"] if row else 0) + 1
        nxt = utcnow() + timedelta(seconds=backoff_seconds(attempts))
        self.db.execute("UPDATE event_outbox SET attempts=:a, next_attempt=:nx, last_error=:e WHERE event_id=:i",
                        a=attempts, nx=to_iso(nxt), e=error[:300], i=event_id)

    def purge(self) -> int:
        """Acked rows are removed immediately after the retention grace; unacked rows are kept."""
        cutoff = to_iso(utcnow() - timedelta(days=self.retention_days))
        n = self.db.execute("DELETE FROM event_outbox WHERE acked_at IS NOT NULL AND acked_at<:c", c=cutoff)
        return n

    def delete_acked(self) -> int:
        return self.db.execute("DELETE FROM event_outbox WHERE acked_at IS NOT NULL")

    def stats(self) -> dict[str, int]:
        r = self.db.fetchone("""SELECT COUNT(*) AS total, SUM(acked_at IS NULL) AS pending FROM event_outbox""")
        return {"total": int(r["total"] or 0), "pending": int(r["pending"] or 0)}

    def _enforce_limit(self) -> None:
        r = self.db.fetchone("SELECT COUNT(*) AS n FROM event_outbox")
        if r and r["n"] > self.max_rows:
            excess = r["n"] - self.max_rows
            # drop oldest acked first, then oldest pending (bounded storage beats unbounded growth)
            self.db.execute("""DELETE FROM event_outbox WHERE event_id IN (
                SELECT event_id FROM event_outbox ORDER BY (acked_at IS NULL), created_at LIMIT :e)""", e=excess)
