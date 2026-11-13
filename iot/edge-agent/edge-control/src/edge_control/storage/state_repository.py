"""Per-entity requested/reported state and verification (kept separate on purpose)."""
from __future__ import annotations

import json
from typing import Any

from edge_control.storage.database import Database
from edge_control.util import to_iso, utcnow


class StateRepository:
    def __init__(self, db: Database):
        self.db = db

    def upsert(self, entity_id: str, kind: str, *, requested: Any = None, reported: Any = None,
               verification: str = "unknown", source: str | None = None, driver_mode: str | None = None,
               keep_requested: bool = False) -> None:
        cur = self.get(entity_id) if keep_requested else None
        req = cur["requested_state"] if cur and keep_requested else requested
        self.db.execute("""INSERT INTO device_state(entity_id,entity_kind,requested_state,reported_state,verification,
            source,driver_mode,updated_at) VALUES (:e,:k,:rq,:rp,:v,:s,:d,:n)
            ON CONFLICT(entity_id) DO UPDATE SET requested_state=:rq, reported_state=:rp, verification=:v,
            source=:s, driver_mode=:d, updated_at=:n""",
                        e=entity_id, k=kind, rq=json.dumps(req) if req is not None else None,
                        rp=json.dumps(reported) if reported is not None else None, v=verification,
                        s=source, d=driver_mode, n=to_iso(utcnow()))

    @staticmethod
    def _decode(r: dict | None) -> dict | None:
        if r is None:
            return None
        for k in ("requested_state", "reported_state"):
            if r.get(k) is not None:
                r[k] = json.loads(r[k])
        return r

    def get(self, entity_id: str) -> dict | None:
        return self._decode(self.db.fetchone("SELECT * FROM device_state WHERE entity_id=:e", e=entity_id))

    def list(self, kind: str | None = None) -> list[dict]:
        rows = (self.db.fetchall("SELECT * FROM device_state WHERE entity_kind=:k", k=kind) if kind
                else self.db.fetchall("SELECT * FROM device_state"))
        return [self._decode(r) for r in rows]  # type: ignore[misc]
