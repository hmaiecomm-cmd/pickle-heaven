"""Durable command queue with DB-enforced de-duplication."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.exc import IntegrityError

from edge_control.errors import Conflict
from edge_control.storage.database import Database
from edge_control.util import payload_hash, to_iso, utcnow

TERMINAL = {"succeeded", "failed", "expired", "unknown"}
JSON_COLS = ("payload", "requested_state", "reported_state")


def _row(r: dict[str, Any] | None) -> dict[str, Any] | None:
    if r is None:
        return None
    r = dict(r)
    for k in JSON_COLS:
        if r.get(k) is not None:
            r[k] = json.loads(r[k])
    r["idempotent"] = bool(r.get("idempotent"))
    r["sent_to_device"] = bool(r.get("sent_to_device"))
    return r


class CommandRepository:
    def __init__(self, db: Database):
        self.db = db

    @staticmethod
    def content_hash(type_: str, target_id: str, payload: dict, expires_at: str) -> str:
        return payload_hash({"type": type_, "target": target_id, "payload": payload, "expires_at": expires_at})

    def create(self, *, command_id: str, type_: str, target_id: str, bus_id: str | None, payload: dict,
               expires_at: str, actor: str, source: str = "api", requested_state: dict | None = None,
               idempotent: bool = True, mapping_revision: int | None = None,
               driver_mode: str | None = None) -> tuple[dict, bool]:
        """Insert or return the existing identical command.  Same id + different content => Conflict(409)."""
        h = self.content_hash(type_, target_id, payload, expires_at)
        now = to_iso(utcnow())
        try:
            with self.db.tx() as c:
                c.execute(text("""INSERT INTO commands(command_id,payload_hash,type,target_id,bus_id,payload,status,
                    requested_state,verification,actor,source,mapping_revision,driver_mode,idempotent,expires_at,
                    created_at,updated_at)
                    VALUES (:id,:h,:t,:tg,:bus,:p,'accepted',:rs,'unverified',:actor,:src,:mr,:dm,:idem,:exp,:now,:now)"""),
                          dict(id=command_id, h=h, t=type_, tg=target_id, bus=bus_id, p=json.dumps(payload),
                               rs=json.dumps(requested_state) if requested_state is not None else None,
                               actor=actor, src=source, mr=mapping_revision, dm=driver_mode,
                               idem=1 if idempotent else 0, exp=expires_at, now=now))
            return self.get(command_id), True  # type: ignore[return-value]
        except IntegrityError:
            existing = self.get(command_id)
            if existing is None:  # pragma: no cover - race with delete
                raise
            if existing["payload_hash"] != h:
                raise Conflict("command_id already used with different content", code="command_id_conflict",
                               details={"command_id": command_id})
            return existing, False

    def get(self, command_id: str) -> dict | None:
        return _row(self.db.fetchone("SELECT * FROM commands WHERE command_id=:i", i=command_id))

    def list_recent(self, limit: int = 50, status: str | None = None) -> list[dict]:
        if status:
            rows = self.db.fetchall("SELECT * FROM commands WHERE status=:s ORDER BY created_at DESC LIMIT :n", s=status, n=limit)
        else:
            rows = self.db.fetchall("SELECT * FROM commands ORDER BY created_at DESC LIMIT :n", n=limit)
        return [_row(r) for r in rows]  # type: ignore[misc]

    def claim_next(self, skip_buses: set[str] | None = None) -> dict | None:
        """Claim the oldest accepted command, skipping buses that already have work in flight
        (keeps per-bus order and stops one slow bus from starving the thread pool)."""
        now = to_iso(utcnow())
        with self.db.tx() as c:
            if skip_buses:
                q = text("SELECT command_id FROM commands WHERE status='accepted' AND "
                         "(bus_id IS NULL OR bus_id NOT IN :skip) ORDER BY created_at, rowid LIMIT 1"
                         ).bindparams(bindparam("skip", expanding=True))
                r = c.execute(q, {"skip": list(skip_buses)}).first()
            else:
                r = c.execute(text("SELECT command_id FROM commands WHERE status='accepted' ORDER BY created_at, rowid LIMIT 1")).first()
            if not r:
                return None
            n = c.execute(text("UPDATE commands SET status='running', started_at=:now, updated_at=:now "
                               "WHERE command_id=:i AND status='accepted'"), dict(now=now, i=r[0])).rowcount
            if n != 1:
                return None
        return self.get(r[0])

    def mark_sent(self, command_id: str) -> None:
        self.db.execute("UPDATE commands SET sent_to_device=1, updated_at=:n WHERE command_id=:i",
                        n=to_iso(utcnow()), i=command_id)

    def finish(self, command_id: str, status: str, *, reported_state: dict | None = None,
               verification: str = "unverified", error_code: str | None = None,
               error_message: str | None = None) -> None:
        assert status in TERMINAL
        now = to_iso(utcnow())
        self.db.execute("""UPDATE commands SET status=:s, reported_state=:rs, verification=:v, error_code=:ec,
            error_message=:em, finished_at=:n, updated_at=:n WHERE command_id=:i""",
                        s=status, rs=json.dumps(reported_state) if reported_state is not None else None,
                        v=verification, ec=error_code, em=error_message, n=now, i=command_id)

    def has_active_on_bus(self, bus_id: str) -> bool:
        r = self.db.fetchone("SELECT 1 AS x FROM commands WHERE bus_id=:b AND status IN ('accepted','running') LIMIT 1", b=bus_id)
        return r is not None

    def has_active_for_target(self, target_id: str) -> bool:
        r = self.db.fetchone("SELECT 1 AS x FROM commands WHERE target_id=:t AND status IN ('accepted','running') LIMIT 1", t=target_id)
        return r is not None

    def active_count(self) -> int:
        r = self.db.fetchone("SELECT COUNT(*) AS n FROM commands WHERE status IN ('accepted','running')")
        return int(r["n"]) if r else 0

    def recover_after_restart(self) -> dict[str, int]:
        """Never blindly replay.  Non-idempotent (unlock) => unknown.  Idempotent and never sent => re-queue.
        Idempotent but already sent => unknown (reconciler/readback decides)."""
        now = to_iso(utcnow())
        out = {"requeued": 0, "unknown": 0}
        with self.db.tx() as c:
            rows = c.execute(text("SELECT command_id, idempotent, sent_to_device FROM commands WHERE status='running'")).all()
            for cid, idem, sent in rows:
                if idem and not sent:
                    c.execute(text("UPDATE commands SET status='accepted', started_at=NULL, updated_at=:n WHERE command_id=:i"),
                              dict(n=now, i=cid))
                    out["requeued"] += 1
                else:
                    c.execute(text("""UPDATE commands SET status='unknown', verification='unknown',
                        error_code='interrupted_by_restart',
                        error_message='Agent restarted while command was running; outcome not confirmed. Not replayed.',
                        finished_at=:n, updated_at=:n WHERE command_id=:i"""), dict(n=now, i=cid))
                    out["unknown"] += 1
        return out
