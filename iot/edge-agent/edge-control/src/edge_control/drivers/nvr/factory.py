from __future__ import annotations

from edge_control.config.schema import HikvisionConfig
from edge_control.config.settings import HikvisionEnv
from edge_control.drivers.base.nvr_driver import NvrDriver
from edge_control.drivers.nvr.hikvision.client import SdkWorkerClient
from edge_control.drivers.nvr.hikvision.driver import HikvisionNvrDriver
from edge_control.drivers.nvr.mock_driver import MockNvrDriver


def create_sdk_client(env: HikvisionEnv, cfg: HikvisionConfig) -> SdkWorkerClient | None:
    if cfg.sdk_binding == "none":
        return None
    return SdkWorkerClient(cfg.sdk_binding if cfg.sdk_binding != "official" else "official", env.sdk_dir,
                           cfg.sdk_worker_timeout_seconds, cfg.sdk_callback_queue_size)


def create_nvr_driver(use_mock: bool, env: HikvisionEnv, cfg: HikvisionConfig, tz: str) -> tuple[NvrDriver, SdkWorkerClient | None]:
    if use_mock:
        return MockNvrDriver(tz=tz), None
    sdk = create_sdk_client(env, cfg)
    return HikvisionNvrDriver(env, cfg, sdk), sdk
