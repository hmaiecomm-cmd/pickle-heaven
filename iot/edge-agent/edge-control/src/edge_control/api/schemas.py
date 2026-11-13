"""Request/response bodies.  Unknown fields are rejected so typos never silently drop a safety parameter."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class CommandBase(Body):
    command_id: str = Field(min_length=8, max_length=80, pattern=r"^[A-Za-z0-9._:\-]+$")
    expires_at: AwareDatetime
    site_id: str | None = None  # optional echo; must match the local identity if present
    edge_id: str | None = None


class HvacSettingsBody(CommandBase):
    power: bool | None = None
    setpoint_c: float | None = None
    mode: str | None = None
    fan: str | None = None


class UnlockBody(CommandBase):
    pass


class RelayStateBody(CommandBase):
    state: Literal["on", "off"]


class BatchBody(CommandBase):
    circuit_ids: list[str] | Literal["all"]
    state: Literal["on", "off"]


class CommandAccepted(BaseModel):
    command_id: str
    status: str
    status_url: str
    replay: bool = False


class OverrideBody(Body):
    state: Literal["on", "off"]
    minutes: int = Field(ge=1, le=1440)


class BookingEvent(Body):
    booking_id: str
    court: Literal["court_a", "court_b"]
    start: AwareDatetime
    end: AwareDatetime
    status: Literal["active", "cancelled"] = "active"
    revision: int = Field(ge=1)


class BookingEvents(Body):
    events: list[BookingEvent] = Field(max_length=500)
    full_snapshot: bool = False


class LiveSessionBody(Body):
    stream_profile: Literal["main", "sub"] = "sub"
    delivery_target: str = "browser"
    ttl_seconds: int | None = None


class PlaybackSessionBody(Body):
    start_time: AwareDatetime
    end_time: AwareDatetime
    delivery_target: str = "browser"
    ttl_seconds: int | None = None
    recording_id: str | None = None


class LoginBody(Body):
    token: str = Field(min_length=8, max_length=512)


class DraftPut(Body):
    expected_revision: int = Field(ge=0, description="draft_revision last seen by the editor (0 = no draft yet)")
    deployment: dict[str, Any]


class ApplyBody(Body):
    expected_revision: int = Field(ge=1, description="active revision the draft was based on")
    comment: str | None = Field(default=None, max_length=200)


class RollbackBody(Body):
    revision: int = Field(ge=1)
    expected_revision: int = Field(ge=1)


class ImportBody(Body):
    format: Literal["json", "yaml"] = "json"
    content: str = Field(max_length=2_000_000)
    expected_revision: int = Field(ge=0)


class AddressPreview(Body):
    table_type: Literal["coil", "discrete_input", "input_register", "holding_register"]
    reference_address: str
    base: int = 1


class TestWriteBody(Body):
    command_id: str = Field(min_length=8, max_length=80)
    state: Literal["on", "off"]
    confirm_circuit_id: str
    expires_at: AwareDatetime
