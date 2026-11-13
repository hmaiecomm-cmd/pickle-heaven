"""ONVIF slot: not implemented.  Profile G / recording-search support must be confirmed per NVR first."""
from __future__ import annotations

from edge_control.errors import Unsupported


def onvif_unsupported():
    raise Unsupported("ONVIF recording search/replay not verified for this NVR (see docs/integration-gaps.md)",
                      code="onvif_unverified")
