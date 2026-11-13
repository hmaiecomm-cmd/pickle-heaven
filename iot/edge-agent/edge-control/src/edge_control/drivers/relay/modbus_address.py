"""Modbus reference-address handling for the M-7000 mapping table (Base 1).

A document address such as ``00001`` or ``40485`` is a *reference* number, not a wire address:

    table_type        leading digit   PDU offset (Base 1)
    coil              0               number - 1            00001 -> 0,  00016 -> 15
    discrete_input    1               number - 1            10001 -> 0
    input_register    3               number - 1            30001 -> 0
    holding_register  4               number - 1            40485 -> 484

Tables are separate memory spaces: coil offset 0 and holding offset 0 are different things.
"""
from __future__ import annotations

from dataclasses import dataclass

TABLE_BY_DIGIT = {"0": "coil", "1": "discrete_input", "3": "input_register", "4": "holding_register"}
DIGIT_BY_TABLE = {v: k for k, v in TABLE_BY_DIGIT.items()}

READ_FUNCTIONS = {"coil": (1,), "discrete_input": (2,), "holding_register": (3,), "input_register": (4,)}
WRITE_FUNCTIONS = {"coil": (5, 15), "holding_register": (6, 16), "discrete_input": (), "input_register": ()}
# Menu offered by the UI: a common-function list, NOT a claim that a physical model supports each code.
FUNCTION_MENU = {1: "Read Coils", 2: "Read Discrete Inputs", 3: "Read Holding Registers",
                 4: "Read Input Registers", 5: "Write Single Coil", 6: "Write Single Register",
                 15: "Write Multiple Coils", 16: "Write Multiple Registers"}


class AddressError(ValueError):
    pass


@dataclass(frozen=True)
class ModbusAddress:
    table_type: str
    reference: str
    base: int
    offset: int

    @property
    def number(self) -> int:
        return int(self.reference[1:])


def parse_reference(reference: str, table_type: str | None = None, base: int = 1) -> ModbusAddress:
    ref = (reference or "").strip()
    # strip footnote markers like "40485*1" but keep the digits that belong to the address
    if "*" in ref:
        ref = ref.split("*", 1)[0]
    if not (len(ref) == 5 and ref.isdigit()):
        raise AddressError(f"reference address must be 5 digits like 00001/40485, got {reference!r}")
    if base not in (0, 1):
        raise AddressError("base must be 0 or 1")
    tbl = TABLE_BY_DIGIT.get(ref[0])
    if tbl is None:
        raise AddressError(f"unknown table prefix {ref[0]!r} (expected 0,1,3 or 4)")
    if table_type is not None and table_type != tbl:
        raise AddressError(f"reference {ref} belongs to {tbl}, not {table_type} (tables must not be mixed)")
    num = int(ref[1:])
    offset = num - 1 if base == 1 else num
    if offset < 0:
        raise AddressError(f"address {ref} is below the Base-{base} range")
    return ModbusAddress(table_type=tbl, reference=ref, base=base, offset=offset)


def check_functions(table_type: str, read_function: int | None, write_function: int | None) -> list[str]:
    errs = []
    if read_function is not None and read_function not in READ_FUNCTIONS[table_type]:
        errs.append(f"read function {read_function} is not valid for {table_type}")
    if write_function is not None and write_function not in WRITE_FUNCTIONS[table_type]:
        errs.append(f"write function {write_function} is not valid for {table_type}")
    return errs


# M-7000 DIO (document pages 70-71, V1.18).  The DO range is a *generic table range*: a physical model may
# have fewer outputs, so the controller's confirmed do_count always limits it further.
M7000_DO_VALUE = (1, 16)  # 00001..00016, R/W, 0=off 1=on
M7000_READONLY_OR_CONFIG_RANGES = [
    (129, 144, "DO safe value (00129-00144)"),
    (161, 176, "DO power-on value (00161-00176)"),
    (257, 257, "00257: meaning differs by firmware (clear latch <=199 / protocol >=200)"),
    (258, 270, "configuration bits (protocol/watchdog/active state)"),
]


def is_m7000_do_value(addr: ModbusAddress) -> bool:
    return addr.table_type == "coil" and M7000_DO_VALUE[0] <= addr.number <= M7000_DO_VALUE[1]
