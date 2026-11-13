from __future__ import annotations

import socket


def network_status() -> dict:
    host = socket.gethostname()
    addrs: list[str] = []
    try:
        for info in socket.getaddrinfo(host, None):
            a = info[4][0]
            if a not in addrs and not a.startswith("127.") and a != "::1":
                addrs.append(a)
    except OSError:
        pass
    return {"hostname": host, "addresses": addrs}
