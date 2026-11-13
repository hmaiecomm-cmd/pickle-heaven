"""Real-hardware tests. SKIPPED unless an operator explicitly enables them AND names the devices.

    EDGE_HARDWARE_TESTS=1 EDGE_HW_RELAY_CIRCUIT=circuit-xx EDGE_HW_CONFIRM=I-ACCEPT-REAL-OUTPUT pytest tests/hardware

Nothing in this repository runs these by default, and they were NOT executed during development.
They only perform read-only status reads unless EDGE_HW_ALLOW_WRITE=1 is also set.
"""
import os

import pytest

ENABLED = os.environ.get("EDGE_HARDWARE_TESTS") == "1" and os.environ.get("EDGE_HW_CONFIRM") == "I-ACCEPT-REAL-OUTPUT"
pytestmark = [pytest.mark.hardware, pytest.mark.skipif(not ENABLED, reason="hardware tests need EDGE_HARDWARE_TESTS=1 and EDGE_HW_CONFIRM")]


def test_named_circuit_status_read():
    circuit = os.environ.get("EDGE_HW_RELAY_CIRCUIT")
    if not circuit:
        pytest.skip("EDGE_HW_RELAY_CIRCUIT not set: no device named")
    pytest.skip("wire this to the site's confirmed mapping via POST /v1/mapping/circuits/{id}/read-state")


def test_named_circuit_write_requires_explicit_allow():
    if os.environ.get("EDGE_HW_ALLOW_WRITE") != "1":
        pytest.skip("EDGE_HW_ALLOW_WRITE not set: writes disabled")
    pytest.skip("intentionally unimplemented: use the guarded maintenance test-write endpoint on site")
