import pytest

from edge_control.drivers.access import soyal_frame as sf
from edge_control.drivers.relay.modbus_address import (
    AddressError, check_functions, is_m7000_do_value, parse_reference,
)


# ---- Modbus reference addresses (M-7000 table is Base 1) ------------------------------------------
def test_base1_pdu_offsets():
    a = parse_reference("00001", "coil")
    assert (a.table_type, a.offset) == ("coil", 0)
    assert parse_reference("00016", "coil").offset == 15
    h = parse_reference("40485", "holding_register")
    assert (h.table_type, h.offset) == ("holding_register", 484)
    assert parse_reference("40485*1").offset == 484  # footnote marker from the PDF table is tolerated


def test_tables_are_not_mixed():
    with pytest.raises(AddressError):
        parse_reference("40485", "coil")
    with pytest.raises(AddressError):
        parse_reference("00001", "holding_register")
    # same offset, different tables: different memory spaces
    assert parse_reference("00001", "coil").offset == parse_reference("40001", "holding_register").offset
    assert parse_reference("00001").table_type != parse_reference("40001").table_type


@pytest.mark.parametrize("bad", ["1", "000001", "abcde", "20001", "00000"])
def test_bad_references(bad):
    with pytest.raises(AddressError):
        parse_reference(bad)


def test_function_code_table_matching():
    assert check_functions("coil", 1, 5) == []
    assert check_functions("coil", 3, None)
    assert check_functions("holding_register", 3, 5)


def test_m7000_do_range_only_value_coils():
    assert is_m7000_do_value(parse_reference("00001"))
    assert is_m7000_do_value(parse_reference("00016"))
    for forbidden in ("00129", "00161", "00257", "00266", "00017"):
        assert not is_m7000_do_value(parse_reference(forbidden))


# ---- SOYAL frames ---------------------------------------------------------------------------------
def test_official_polling_vector_offline_only():
    frame = sf.build_frame(0x01, 0x18)
    assert frame.hex(" ").upper() == "7E 04 01 18 E6 FF"
    f = sf.parse_frame(bytes.fromhex("7E0401 18E6FF".replace(" ", "")))
    assert (f.dest, f.cmd, f.data) == (1, 0x18, b"")


def test_relay_control_example_page21():
    assert sf.relay_control_frame(1, 0x82).hex(" ").upper() == "7E 05 01 21 82 5D 01"


def test_length_xor_sum_rules():
    raw = sf.build_frame(0x01, 0x12, bytes([0x00, 0x80, 0x08]))
    assert raw.hex(" ").upper() == "7E 07 01 12 00 80 08 64 FF"  # doc p.20 example
    bad_xor = bytearray(raw)
    bad_xor[-2] ^= 1
    with pytest.raises(sf.FrameError):
        sf.parse_frame(bytes(bad_xor))
    bad_sum = bytearray(raw)
    bad_sum[-1] ^= 1
    with pytest.raises(sf.FrameError):
        sf.parse_frame(bytes(bad_sum))
    with pytest.raises(sf.FrameError):
        sf.parse_frame(raw + b"\x00")


def test_no_broadcast_no_master_and_no_ambiguous_do_selectors():
    for node in (0x00, 0xFF, None):
        with pytest.raises(sf.FrameError):
            sf.relay_control_frame(node, 0x82)
    for sel in (0x88, 0x89):
        with pytest.raises(sf.FrameError):
            sf.relay_control_frame(1, sel)
