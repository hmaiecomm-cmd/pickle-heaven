# RS-485 wiring and bus rules

No wiring is specified by this repository (controller models are unconfirmed). Rules the software enforces:
- One physical port = one bus = one protocol profile (`modbus_rtu` or `soyal_binary`); SOYAL and Modbus must not share a bus; different serial settings cannot share a port.
- All transactions of one bus are serialised (per-bus lock); different buses run in parallel; I/O runs in worker threads, never on the event loop.
- Use stable paths (`/dev/serial/by-id/…`), never `/dev/ttyUSB0`. `scripts/diagnose_rs485.py` is read-only.
- Address/baud/parity/watchdog/safe-value/power-on settings of devices are **never written** by this software.
- Typical hardware checklist (site task): A/B polarity, 120 Ω termination at both ends, common reference, one master, unique slave IDs, matching baud/parity (a document default such as 9600 N81 must still be verified).
- A relay DO is a control output; it does not by itself prove a load is energised. What it drives (contactor/driver) and the feedback must be recorded on site.
