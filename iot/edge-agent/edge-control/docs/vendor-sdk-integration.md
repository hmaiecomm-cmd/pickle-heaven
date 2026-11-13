# Adding a vendor driver / SDK

1. Put the vendor's legal documents in `vendor/<kind>/docs/`, SDKs in `vendor/<kind>/sdk/` (git-ignored). Record version, source, SHA-256, licence.
2. Implement the interface in `drivers/base/` (`HvacDriver`, `AccessDriver`, `RelayDriver`, `NvrDriver`) in `drivers/<kind>/<name>_driver.py` — synchronous, no event-loop use.
   Raise `DeviceTimeout(sent=…)`, `DeviceError(code)`, `NotConfigured`, `Unsupported`; never return success you did not observe; never guess addresses/commands.
3. Register it in `drivers/<kind>/factory.py` keyed by `driver_profile`; set `driver: real` + `driver_profile` for the device in `devices.yaml`.
4. Add tests with a fake transport (see `tests/integration/test_buses_and_drivers.py`); hardware tests stay opt-in.
5. Native SDKs must run in an isolated worker process (pattern: `drivers/nvr/hikvision/worker.py` + `client.py`); bindings come from the package's own headers.
6. Update `docs/integration-gaps.md`.
