"""Versioned deployment mapping: draft -> validate -> diff -> apply, with rollback.

Applying or rolling back only changes configuration.  It never sends a DO write, never resets a hardware
address and never replays an old command.
"""
from __future__ import annotations

import json
import threading
from typing import Any, Callable

import yaml
from sqlalchemy import text

from edge_control.config.loader import AppConfig
from edge_control.config.schema import Deployment
from edge_control.errors import Conflict, NotFound, Unprocessable
from edge_control.mapping.validation import ValidationReport, validate_deployment
from edge_control.storage.database import Database
from edge_control.util import to_iso, utcnow


def _dump(dep: Deployment) -> str:
    return dep.model_dump_json()


class DeploymentService:
    def __init__(self, db: Database, cfg: AppConfig, runtime_mode: str,
                 bus_busy: Callable[[set[str]], list[str]] | None = None,
                 camera_busy: Callable[[set[str]], list[str]] | None = None):
        self.db, self.cfg, self.runtime_mode = db, cfg, runtime_mode
        self._bus_busy = bus_busy or (lambda ids: [])
        self._camera_busy = camera_busy or (lambda ids: [])
        self._lock = threading.RLock()
        self._cache: tuple[int, Deployment] | None = None
        self._seed()

    # ---------------------------------------------------------------- seed / read
    def _seed(self) -> None:
        with self.db.tx() as c:
            if c.execute(text("SELECT 1 FROM deployment_state WHERE id=1")).first():
                return
            c.execute(text("INSERT INTO deployment_revisions(revision,payload,created_by,created_at,comment,kind) "
                           "VALUES (1,:p,'system',:n,:cm,'seed')"),
                      dict(p=_dump(self.cfg.seed_deployment), n=to_iso(utcnow()),
                           cm="initial seed (simulation)" if self.cfg.seed_deployment.simulation_only else "initial seed (all unbound)"))
            c.execute(text("INSERT INTO deployment_state(id,active_revision) VALUES (1,1)"))

    def active(self) -> tuple[int, Deployment]:
        with self._lock:
            if self._cache is None:
                st = self.db.fetchone("SELECT active_revision FROM deployment_state WHERE id=1")
                row = self.db.fetchone("SELECT payload FROM deployment_revisions WHERE revision=:r", r=st["active_revision"])
                self._cache = (st["active_revision"], Deployment.model_validate_json(row["payload"]))
            return self._cache

    @property
    def revision(self) -> int:
        return self.active()[0]

    def versions(self) -> list[dict]:
        return self.db.fetchall("SELECT revision, created_by, created_at, comment, kind FROM deployment_revisions ORDER BY revision DESC")

    def get_version(self, revision: int) -> Deployment:
        row = self.db.fetchone("SELECT payload FROM deployment_revisions WHERE revision=:r", r=revision)
        if not row:
            raise NotFound(f"revision {revision} not found", code="revision_not_found")
        return Deployment.model_validate_json(row["payload"])

    # ---------------------------------------------------------------- draft
    def draft(self) -> dict[str, Any]:
        st = self.db.fetchone("SELECT * FROM deployment_state WHERE id=1")
        active_rev = st["active_revision"]
        if st["draft_payload"]:
            dep = Deployment.model_validate_json(st["draft_payload"])
            return {"exists": True, "active_revision": active_rev, "draft_revision": st["draft_revision"],
                    "base_revision": st["draft_base"], "updated_by": st["draft_by"], "updated_at": st["draft_at"],
                    "deployment": dep.model_dump(mode="json")}
        return {"exists": False, "active_revision": active_rev, "draft_revision": st["draft_revision"],
                "base_revision": active_rev, "deployment": self.active()[1].model_dump(mode="json")}

    def put_draft(self, payload: dict | Deployment, expected_revision: int, actor: str) -> dict[str, Any]:
        """expected_revision is the draft_revision the editor last saw (0 for a fresh draft)."""
        try:
            dep = payload if isinstance(payload, Deployment) else Deployment.model_validate(payload)
        except Exception as e:  # noqa: BLE001 - pydantic ValidationError
            raise Unprocessable("deployment payload invalid", code="invalid_deployment", details={"errors": str(e)[:1500]}) from e
        with self._lock, self.db.tx() as c:
            st = c.execute(text("SELECT draft_revision, active_revision FROM deployment_state WHERE id=1")).mappings().first()
            if st["draft_revision"] != expected_revision:
                raise Conflict("draft was modified by someone else", code="revision_conflict",
                               details={"current_draft_revision": st["draft_revision"]})
            c.execute(text("""UPDATE deployment_state SET draft_payload=:p, draft_revision=draft_revision+1,
                draft_base=:b, draft_by=:a, draft_at=:n WHERE id=1"""),
                      dict(p=_dump(dep), b=st["active_revision"], a=actor, n=to_iso(utcnow())))
        return self.draft()

    def discard_draft(self, expected_revision: int) -> None:
        with self._lock, self.db.tx() as c:
            st = c.execute(text("SELECT draft_revision FROM deployment_state WHERE id=1")).mappings().first()
            if st["draft_revision"] != expected_revision:
                raise Conflict("draft was modified by someone else", code="revision_conflict")
            c.execute(text("UPDATE deployment_state SET draft_payload=NULL, draft_revision=draft_revision+1 WHERE id=1"))

    # ---------------------------------------------------------------- validate / diff
    def validate(self, dep: Deployment | None = None) -> ValidationReport:
        if dep is None:
            d = self.draft()
            dep = Deployment.model_validate(d["deployment"])
        return validate_deployment(dep, self.cfg, runtime_mode=self.runtime_mode)

    @staticmethod
    def diff(before: Deployment, after: Deployment) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        b, a = before.model_dump(mode="json"), after.model_dump(mode="json")
        keys = {"buses": "bus_id", "controllers": "controller_id", "circuits": "circuit_id",
                "nvrs": "nvr_id", "cameras": "camera_id"}
        for section, key in keys.items():
            bm = {x[key]: x for x in b[section]}
            am = {x[key]: x for x in a[section]}
            for ident in sorted(set(bm) | set(am)):
                x, y = bm.get(ident), am.get(ident)
                if x == y:
                    continue
                if x is None or y is None:
                    out.append({"section": section, "id": ident, "change": "added" if x is None else "removed", "fields": []})
                    continue
                fields = [{"field": f, "before": x.get(f), "after": y.get(f)} for f in sorted(set(x) | set(y)) if x.get(f) != y.get(f)]
                out.append({"section": section, "id": ident, "change": "modified", "fields": fields})
        if b["simulation_only"] != a["simulation_only"]:
            out.append({"section": "deployment", "id": "simulation_only", "change": "modified",
                        "fields": [{"field": "simulation_only", "before": b["simulation_only"], "after": a["simulation_only"]}]})
        return out

    def draft_diff(self) -> dict[str, Any]:
        d = self.draft()
        dep = Deployment.model_validate(d["deployment"])
        changes = self.diff(self.active()[1], dep)
        rep = self.validate(dep)
        return {"active_revision": d["active_revision"], "changes": changes, "pending": rep.as_dict()["pending"]}

    # ---------------------------------------------------------------- apply / rollback
    def _touched(self, changes: list[dict]) -> tuple[set[str], set[str]]:
        """buses and cameras whose mapping would change (so in-flight work could hit a new target)."""
        before_dep = self.active()[1]
        buses: set[str] = set()
        cams: set[str] = set()
        ctrl_bus = {c.controller_id: c.bus_id for c in before_dep.controllers}
        for ch in changes:
            if ch["section"] == "buses":
                buses.add(ch["id"])
            elif ch["section"] == "controllers":
                if ctrl_bus.get(ch["id"]):
                    buses.add(ctrl_bus[ch["id"]])
                for f in ch["fields"]:
                    if f["field"] == "bus_id" and f["after"]:
                        buses.add(f["after"])
            elif ch["section"] == "circuits":
                cb = next((c for c in before_dep.circuits if c.circuit_id == ch["id"]), None)
                if cb and cb.controller_id and ctrl_bus.get(cb.controller_id):
                    buses.add(ctrl_bus[cb.controller_id])
            elif ch["section"] in ("cameras", "nvrs"):
                if ch["section"] == "cameras":
                    cams.add(ch["id"])
                else:
                    cams.update(c.camera_id for c in before_dep.cameras if c.nvr_id == ch["id"])
        return buses, cams

    def _install(self, dep: Deployment, actor: str, comment: str | None, kind: str) -> int:
        with self._lock, self.db.tx() as c:
            rev = (c.execute(text("SELECT MAX(revision) FROM deployment_revisions")).scalar() or 0) + 1
            c.execute(text("INSERT INTO deployment_revisions(revision,payload,created_by,created_at,comment,kind) "
                           "VALUES (:r,:p,:a,:n,:c,:k)"),
                      dict(r=rev, p=_dump(dep), a=actor, n=to_iso(utcnow()), c=comment, k=kind))
            c.execute(text("UPDATE deployment_state SET active_revision=:r, draft_payload=NULL, "
                           "draft_revision=draft_revision+1 WHERE id=1"), dict(r=rev))
            self._cache = None
        return rev

    def apply(self, expected_revision: int, actor: str, comment: str | None = None) -> dict[str, Any]:
        """expected_revision = the ACTIVE revision the editor based the draft on."""
        with self._lock:
            active_rev, active = self.active()
            if expected_revision != active_rev:
                raise Conflict("active mapping revision changed", code="revision_conflict",
                               details={"active_revision": active_rev})
            d = self.draft()
            if not d["exists"]:
                raise Unprocessable("no draft to apply", code="no_draft")
            rep = self.validate(Deployment.model_validate(d["deployment"]))
            if not rep.ok:
                raise Unprocessable("draft has validation errors", code="validation_failed", details=rep.as_dict())
            new = rep.normalized  # type: ignore[assignment]
            for b in new.circuits:
                if b.mapping_status == "validated":
                    b.mapping_status = "active"
            for cam in new.cameras:
                if cam.mapping_status == "validated":
                    cam.mapping_status = "active"
            changes = self.diff(active, new)
            buses, cams = self._touched(changes)
            busy_b, busy_c = self._bus_busy(buses), self._camera_busy(cams)
            if busy_b:
                raise Conflict("bus has in-flight commands; retry when idle", code="mapping_busy_bus", details={"buses": busy_b})
            if busy_c:
                raise Conflict("cameras have active sessions; stop them first", code="mapping_active_sessions", details={"cameras": busy_c})
            rev = self._install(new, actor, comment, "apply")
            return {"revision": rev, "changes": len(changes), "hardware_commands_sent": 0}

    def rollback(self, target_revision: int, expected_revision: int, actor: str) -> dict[str, Any]:
        with self._lock:
            active_rev, active = self.active()
            if expected_revision != active_rev:
                raise Conflict("active mapping revision changed", code="revision_conflict", details={"active_revision": active_rev})
            target = self.get_version(target_revision)
            rep = validate_deployment(target, self.cfg, runtime_mode=self.runtime_mode)
            if not rep.ok:
                raise Unprocessable("target revision no longer validates", code="validation_failed", details=rep.as_dict())
            changes = self.diff(active, target)
            buses, cams = self._touched(changes)
            if self._bus_busy(buses):
                raise Conflict("bus has in-flight commands", code="mapping_busy_bus", details={"buses": sorted(buses)})
            if self._camera_busy(cams):
                raise Conflict("cameras have active sessions", code="mapping_active_sessions")
            rev = self._install(target, actor, f"rollback to {target_revision}", "rollback")
            return {"revision": rev, "restored_from": target_revision, "hardware_commands_sent": 0}

    # ---------------------------------------------------------------- import / export
    def export(self, fmt: str = "json", revision: int | None = None) -> str:
        dep = self.get_version(revision) if revision else self.active()[1]
        data = dep.model_dump(mode="json")
        return json.dumps(data, indent=2, ensure_ascii=False) if fmt == "json" else yaml.safe_dump(data, allow_unicode=True, sort_keys=False)

    @staticmethod
    def parse_import(content: str, fmt: str) -> Deployment:
        try:
            data = json.loads(content) if fmt == "json" else yaml.safe_load(content)
            return Deployment.model_validate(data)
        except Exception as e:  # noqa: BLE001
            raise Unprocessable("import payload invalid", code="invalid_deployment", details={"errors": str(e)[:1500]}) from e
