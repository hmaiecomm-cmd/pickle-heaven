"""Door unlock: exactly one attempt, no blind retry, no claim that the door physically opened."""
from __future__ import annotations

from edge_control.controllers.outcome import Outcome, outcome_from_exception
from edge_control.devices.registry import DeviceRegistry
from edge_control.storage.command_repository import CommandRepository


class AccessController:
    def __init__(self, registry: DeviceRegistry, commands: CommandRepository):
        self.registry, self.commands = registry, commands

    def unlock(self, cmd: dict) -> Outcome:
        door_id = cmd["target_id"]
        sent = False
        try:
            _dev, drv = self.registry.access_for_door(door_id)
            self.commands.mark_sent(cmd["command_id"])
            sent = True
            r = drv.unlock(door_id)
            return Outcome("succeeded", verification=r.verification,
                           reported_state={"unlock_accepted": r.accepted, "door_contact": r.door_contact, **r.detail},
                           state_update={"mode": drv.mode})
        except Exception as e:  # noqa: BLE001
            return outcome_from_exception(e, sent=sent)
