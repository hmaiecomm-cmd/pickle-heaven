"""SOYAL binary frame codec (AR-721H/727H protocol doc 2019-11-05, pp.4-6, 21).

    7E | LEN | DEST | CMD | DATA... | XOR | SUM
    LEN = bytes from DEST through SUM inclusive
    XOR = 0xFF ^ every byte DEST..DATA
    SUM = (every byte DEST..XOR) & 0xFF
Node 0x00 is the bus master (replies to PC); 0xFF is broadcast and is never sent by this adapter.
"""
from __future__ import annotations

from dataclasses import dataclass

HEAD = 0x7E
CMD_RELAY_CONTROL = 0x21
CMD_POLL_STATUS = 0x18  # NOTE: polling can change networking/stand-alone mode: not a harmless health ping
ECHO_ACK, ECHO_NACK = 0x04, 0x05
RELAY_DOOR_ON, RELAY_DOOR_OFF, RELAY_DOOR_TIMED = 0x82, 0x83, 0x84  # timed length is set on the controller
RELAY_CHECK_IO = 0x00


class FrameError(ValueError):
    pass


def xor_byte(body: bytes) -> int:
    x = 0xFF
    for b in body:
        x ^= b
    return x


def sum_byte(body: bytes) -> int:
    return sum(body) & 0xFF


def build_frame(dest: int, cmd: int, data: bytes = b"") -> bytes:
    if not 0 <= dest <= 0xFF or not 0 <= cmd <= 0xFF:
        raise FrameError("dest/cmd must be one byte")
    body = bytes([dest, cmd]) + data
    x = xor_byte(body)
    s = sum_byte(body + bytes([x]))
    length = len(body) + 2  # + XOR + SUM
    if length > 0xFF:
        raise FrameError("frame too long")
    return bytes([HEAD, length]) + body + bytes([x, s])


@dataclass(frozen=True)
class Frame:
    dest: int
    cmd: int
    data: bytes


def parse_frame(raw: bytes) -> Frame:
    if len(raw) < 6:
        raise FrameError("frame too short")
    if raw[0] != HEAD:
        raise FrameError("bad head byte")
    length = raw[1]
    if len(raw) != length + 2:
        raise FrameError(f"length mismatch: LEN={length}, have {len(raw) - 2} bytes after LEN")
    body = raw[2:-2]
    x, s = raw[-2], raw[-1]
    if xor_byte(body) != x:
        raise FrameError("XOR mismatch")
    if sum_byte(body + bytes([x])) != s:
        raise FrameError("SUM mismatch")
    return Frame(dest=body[0], cmd=body[1], data=bytes(body[2:]))


def require_unicast(node_id: int | None) -> int:
    if node_id is None:
        raise FrameError("node_id not configured")
    if node_id in (0x00, 0xFF):
        raise FrameError("node 0x00 is the bus master and 0xFF is broadcast: not allowed for control")
    if not 1 <= node_id <= 0xFE:
        raise FrameError("node_id out of range")
    return node_id


def relay_control_frame(node_id: int, selector: int) -> bytes:
    """21H Relay Control with a 1-byte selector (0x00 check-I/O, 0x82..0x87 per doc p.21).
    0x88/0x89 (721W DO) are deliberately NOT supported: the doc's example length/text is inconsistent."""
    if selector in (0x88, 0x89):
        raise FrameError("721W DO selectors 0x88/0x89 are not supported (inconsistent in the document)")
    return build_frame(require_unicast(node_id), CMD_RELAY_CONTROL, bytes([selector]))
