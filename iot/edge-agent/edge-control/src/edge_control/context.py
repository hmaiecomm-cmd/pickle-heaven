"""Composition root: wires every service together.  The API layer only talks to this object."""
from __future__ import annotations

import logging
import shutil
from pathlib import Path

from edge_control.cloud.client import CloudClient, DisabledCloudClient, HttpCloudClient
from edge_control.cloud.event_reporter import EventReporter
from edge_control.cloud.heartbeat import Heartbeat
from edge_control.cloud.state_reporter import StateReporter
from edge_control.commands.policy import PolicyEngine
from edge_control.commands.service import CommandExecutor, CommandService, CommandWorker
from edge_control.config.loader import AppConfig, load_app_config
from edge_control.config.settings import HikvisionEnv, Settings
from edge_control.controllers.access_controller import AccessController
from edge_control.controllers.hvac_controller import HvacController
from edge_control.controllers.relay_controller import RelayController
from edge_control.devices.registry import DeviceRegistry
from edge_control.drivers.nvr.factory import create_nvr_driver
from edge_control.drivers.transports.bus import BusManager
from edge_control.errors import NotConfigured
from edge_control.mapping.service import DeploymentService
from edge_control.media.gateway_client import FakeGateway, GatewayClient, MediaMtxClient
from edge_control.media.live.source_resolver import CameraResolver
from edge_control.media.live.stream_service import LiveService
from edge_control.media.pipelines.file_streamer import cleanup_orphans
from edge_control.media.pipelines.process_manager import ProcessManager
from edge_control.media.playback.playback_service import PlaybackService
from edge_control.media.playback.recording_service import RecordingService
from edge_control.media.security.session_authorization import MediaAuthorizer
from edge_control.media.session_manager import SessionManager
from edge_control.scheduling.reconciler import BookingStore, OverrideStore, Reconciler
from edge_control.security.audit_log import AuditLog
from edge_control.security.permissions import Principal
from edge_control.security.secret_provider import cloud_token, load_tokens
from edge_control.storage.command_repository import CommandRepository
from edge_control.storage.database import Database
from edge_control.storage.event_outbox import EventOutbox
from edge_control.storage.state_repository import StateRepository

log = logging.getLogger("edge.context")


class AppContext:
    def __init__(self, settings: Settings, *, gateway: GatewayClient | None = None, cloud: CloudClient | None = None,
                 hik_env: HikvisionEnv | None = None):
        self.settings = settings
        self.tokens: dict[str, Principal] = load_tokens(settings)
        if not self.tokens:
            raise NotConfigured("no API credentials configured: set EDGE_AUTH_TOKENS or EDGE_AUTH_TOKENS_FILE. "
                                "The control API refuses to start without authentication.", code="auth_not_configured")
        self.cfg: AppConfig = load_app_config(settings)
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        settings.cache_dir.mkdir(parents=True, exist_ok=True)
        self.db = Database(settings.db_path)
        self.audit = AuditLog(self.db)
        self.commands = CommandRepository(self.db)
        self.states = StateRepository(self.db)
        self.outbox = EventOutbox(self.db, self.cfg.policies.outbox_max_rows, self.cfg.policies.outbox_retention_days)
        self.buses = BusManager()
        self.procs = ProcessManager(self.cfg.media.max_ffmpeg_jobs)

        self.camera_sessions_ref: SessionManager | None = None
        self.deployment = DeploymentService(
            self.db, self.cfg, settings.mode,
            bus_busy=lambda ids: sorted(b for b in ids if self.commands.has_active_on_bus(b)),
            camera_busy=lambda ids: self.sessions.cameras_with_active_sessions(ids) if self.camera_sessions_ref else [])
        self.policy = PolicyEngine(self.cfg, self.deployment, settings.mode)
        self.registry = DeviceRegistry(self.cfg, self.deployment, self.buses, settings.mode)

        relay = RelayController(self.policy, self.registry, self.commands)
        hvac = HvacController(self.registry, self.commands)
        access = AccessController(self.registry, self.commands)
        self.relay_controller = relay
        self.executor = CommandExecutor(repo=self.commands, states=self.states, outbox=self.outbox, audit=self.audit,
                                        buses=self.buses, relay=relay, hvac=hvac, access=access)
        self.worker = CommandWorker(self.commands, self.executor, settings.worker_threads)
        self.command_service = CommandService(cfg=self.cfg, repo=self.commands, policy=self.policy, registry=self.registry,
                                              deployment=self.deployment, audit=self.audit, runtime_mode=settings.mode,
                                              wake=self.worker.wake)
        self.bookings = BookingStore(self.db)
        self.overrides = OverrideStore(self.db, self.cfg.policies.manual_override_max_minutes)
        self.reconciler = Reconciler(self.cfg, self.policy, self.command_service, self.bookings, self.overrides, self.states)

        # ---- media
        self.hik_env = hik_env or HikvisionEnv()
        _rev, dep = self.deployment.active()
        nvr_def = next((n for n in dep.nvrs if n.nvr_id == self.cfg.nvr_id), None)
        use_mock_nvr = settings.mode == "mock" or (nvr_def is not None and nvr_def.driver == "mock")
        self.nvr, self.sdk = create_nvr_driver(use_mock_nvr, self.hik_env, self.cfg.hikvision,
                                               nvr_def.timezone if nvr_def else self.hik_env.device_timezone)
        if gateway is not None:
            self.gateway = gateway
        elif settings.media_backend == "mock":
            self.gateway = FakeGateway()
        else:
            self.gateway = MediaMtxClient(settings.mediamtx_api_url, auth=(settings.media_internal_user, settings.media_internal_secret)
                                         if settings.media_internal_secret else None)
        self.resolver = CameraResolver(self.cfg, self.deployment, self.nvr)
        self.sessions = SessionManager(db=self.db, cfg=self.cfg, gateway=self.gateway, procs=self.procs,
                                       public_whep_base=settings.mediamtx_public_whep_base, binding_lookup=self.resolver.lookup)
        self.camera_sessions_ref = self.sessions
        ffprobe = str(Path(shutil.which("ffprobe") or "ffprobe"))
        self.live = LiveService(cfg=self.cfg, sessions=self.sessions, resolver=self.resolver, nvr=self.nvr, procs=self.procs,
                                ffmpeg=settings.ffmpeg_path, rtsp_publish_base=settings.mediamtx_rtsp_publish_url,
                                internal_user=settings.media_internal_user, internal_secret=settings.media_internal_secret)
        self.recordings = RecordingService(self.resolver, self.nvr)
        self.playback = PlaybackService(cfg=self.cfg, sessions=self.sessions, resolver=self.resolver, nvr=self.nvr,
                                        recordings=self.recordings, procs=self.procs, ffmpeg=settings.ffmpeg_path,
                                        ffprobe=ffprobe, cache_dir=settings.cache_dir,
                                        rtsp_publish_base=settings.mediamtx_rtsp_publish_url,
                                        internal_user=settings.media_internal_user, internal_secret=settings.media_internal_secret)
        self.media_auth = MediaAuthorizer(self.db, settings.media_internal_user, settings.media_internal_secret)

        # ---- cloud
        if cloud is not None:
            self.cloud: CloudClient = cloud
        elif settings.cloud_url:
            self.cloud = HttpCloudClient(settings.cloud_url, cloud_token(settings))
        else:
            self.cloud = DisabledCloudClient()
        self.reporter = EventReporter(self.outbox, self.cloud, self.cfg.site.site_id, self.cfg.site.edge_id)
        self.heartbeat = Heartbeat(self.cloud, self.cfg.site.site_id, self.cfg.site.edge_id, self._heartbeat_snapshot)
        self.state_reporter = StateReporter(self.states, self.outbox)
        self.started = False

    def _heartbeat_snapshot(self) -> dict:
        return {"mode": self.settings.mode, "mapping_revision": self.deployment.revision,
                "active_commands": self.commands.active_count(), "outbox": self.outbox.stats()}

    # ------------------------------------------------------------ lifecycle
    def recover(self) -> dict:
        r = {"commands": self.commands.recover_after_restart(), "media_sessions_ended": self.sessions.recover_after_restart()}
        cleanup_orphans(self.settings.cache_dir / "playback", set())
        return r

    def start(self) -> None:
        self.recovery = self.recover()
        if self.settings.background_workers:
            self.worker.start()
            self.sessions.start_janitor()
            self.reconciler.start()
            if self.cloud.enabled:
                self.reporter.start()
                self.heartbeat.start()
        self.started = True

    def stop(self) -> None:
        self.reporter.stop()
        self.heartbeat.stop()
        self.reconciler.stop()
        self.worker.stop()
        self.sessions.shutdown()
        if self.sdk:
            self.sdk.close()
        self.db.dispose()
