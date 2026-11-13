"""SQLite engine (SQLAlchemy), forward-only SQL migrations and tiny helpers."""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from sqlalchemy import Connection, create_engine, event, text
from sqlalchemy.engine import Engine

from edge_control.util import to_iso, utcnow

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


class Database:
    def __init__(self, path: Path | str):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        url = "sqlite://" if self.path == ":memory:" else f"sqlite:///{self.path}"
        kwargs: dict[str, Any] = {"connect_args": {"check_same_thread": False, "timeout": 15}}
        if self.path == ":memory:":
            from sqlalchemy.pool import StaticPool
            kwargs["poolclass"] = StaticPool
        self.engine: Engine = create_engine(url, **kwargs)

        @event.listens_for(self.engine, "connect")
        def _pragmas(dbapi_conn, _rec):  # noqa: ANN001
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA busy_timeout=10000")
            if self.path != ":memory:":
                cur.execute("PRAGMA journal_mode=WAL")
                cur.execute("PRAGMA synchronous=NORMAL")
            cur.close()

        self.migrate()

    # ------------------------------------------------------------------
    def migrate(self) -> list[str]:
        applied: list[str] = []
        with self.engine.begin() as c:
            c.execute(text("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"))
            done = {r[0] for r in c.execute(text("SELECT name FROM schema_migrations"))}
        for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if f.name in done:
                continue
            raw = self.engine.raw_connection()
            try:
                raw.executescript(f.read_text(encoding="utf-8"))
                raw.execute("INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)", (f.name, to_iso(utcnow())))
                raw.commit()
            finally:
                raw.close()
            applied.append(f.name)
        return applied

    @contextmanager
    def tx(self) -> Iterator[Connection]:
        with self.engine.begin() as conn:
            yield conn

    def fetchone(self, sql: str, **params: Any) -> dict[str, Any] | None:
        with self.engine.connect() as c:
            row = c.execute(text(sql), params).mappings().first()
            return dict(row) if row else None

    def fetchall(self, sql: str, **params: Any) -> list[dict[str, Any]]:
        with self.engine.connect() as c:
            return [dict(r) for r in c.execute(text(sql), params).mappings().all()]

    def execute(self, sql: str, **params: Any) -> int:
        with self.engine.begin() as c:
            return c.execute(text(sql), params).rowcount

    def dispose(self) -> None:
        self.engine.dispose()

    # simple kv
    def kv_get(self, key: str, default: str | None = None) -> str | None:
        row = self.fetchone("SELECT value FROM kv WHERE key=:k", k=key)
        return row["value"] if row else default

    def kv_set(self, key: str, value: str) -> None:
        self.execute("INSERT INTO kv(key,value) VALUES (:k,:v) ON CONFLICT(key) DO UPDATE SET value=:v", k=key, v=value)
