"""Append-only audit log: who did what to which device, when, with what result."""
from __future__ import annotations

import json
from typing import Any

from edge_control.storage.database import Database
from edge_control.util import redact_obj, to_iso, utcnow


class AuditLog:
    def __init__(self, db: Database):
        self.db = db

    def write(self, *, actor: str, role: str | None, action: str, target: str | None = None,
              command_id: str | None = None, result: str = "ok", detail: Any = None) -> None:
        self.db.execute("""INSERT INTO audit_log(ts,actor,role,action,target,command_id,result,detail)
            VALUES (:ts,:a,:r,:ac,:t,:c,:res,:d)""",
                        ts=to_iso(utcnow()), a=actor, r=role, ac=action, t=target, c=command_id, res=result,
                        d=json.dumps(redact_obj(detail), ensure_ascii=False, default=str) if detail is not None else None)

    def recent(self, limit: int = 100) -> list[dict]:
        rows = self.db.fetchall("SELECT * FROM audit_log ORDER BY id DESC LIMIT :n", n=limit)
        for r in rows:
            if r.get("detail"):
                r["detail"] = json.loads(r["detail"])
        return rows
