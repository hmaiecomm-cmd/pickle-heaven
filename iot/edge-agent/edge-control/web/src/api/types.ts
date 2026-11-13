// Types mirroring the backend payloads (see contracts/openapi.yaml, schemas.py, config/schema.py).

export type Role = 'viewer' | 'operator' | 'admin';

export interface Me {
  actor: string;
  role: Role;
  site_id: string;
  edge_id: string;
  mode: string; // 'mock' | 'real'
  timezone_default?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  request_id?: string | null;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------- commands
export type CommandStatusName = 'accepted' | 'running' | 'succeeded' | 'failed' | 'expired' | 'unknown';
export type VerificationName = 'confirmed' | 'unverified' | 'unknown';

export interface CommandAccepted {
  command_id: string;
  status: CommandStatusName;
  status_url: string;
  replay: boolean;
}

export interface CommandView {
  command_id: string;
  type: string;
  target_id: string;
  status: CommandStatusName;
  requested_state: unknown;
  reported_state: unknown;
  verification: VerificationName | string;
  error: { code: string; message: string | null } | null;
  expires_at: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  actor: string | null;
  source: string | null;
  mapping_revision: number | null;
  driver_mode: string | null;
  simulated: boolean;
  status_url: string;
}

export interface DeviceStateRow {
  entity_id?: string;
  requested_state?: unknown;
  reported_state?: unknown;
  verification?: string;
  source?: string | null;
  driver_mode?: string | null;
  updated_at?: string | null;
}

// ---------------------------------------------------------------- system status
export interface BusStatus {
  bus_id: string;
  serial_path: string | null;
  protocol_profile: string;
  state: 'present' | 'missing' | 'not_configured' | string;
  stable_path?: boolean;
  readable?: boolean;
}

export interface SystemStatus {
  status: string;
  mode: string;
  site_id: string;
  edge_id: string;
  time: string;
  database: string;
  mock: boolean;
  simulation_mapping: boolean;
  mapping_revision: number;
  commands: { active: number; recent_failed: number };
  buses: BusStatus[];
  network: { hostname: string; addresses: string[] };
  media: {
    gateway: { reachable: boolean; backend?: string; status_code?: number; error?: string };
    tools: { ffmpeg: { available: boolean; version: string | null }; ffprobe: { available: boolean } };
    ffmpeg_jobs: number;
    live_sessions: number;
    playback_sessions: number;
  };
  nvr: {
    driver: string;
    capabilities: Record<string, boolean>;
    hikvision_configured: unknown;
    sdk: { state: string; worker: Record<string, unknown> };
  };
  cloud: {
    enabled: boolean;
    client: string;
    last_event_success: string | null;
    last_error: string | null;
    heartbeat_last_success: string | null;
    outbox: { total: number; pending: number };
  };
  auth: { tokens_configured: number };
  warnings: string[];
  recent_commands: Array<{
    command_id: string;
    type: string;
    target_id: string;
    status: CommandStatusName;
    verification: string;
    error_code: string | null;
    created_at: string;
    driver_mode: string | null;
  }>;
}

// ---------------------------------------------------------------- hvac / access
export interface HvacCapabilities {
  power?: boolean;
  setpoint?: { min: number; max: number; step: number };
  modes?: string[];
  fan?: string[];
}
export interface HvacStateResponse {
  device_id: string;
  name: string | null;
  driver_mode: string;
  simulated: boolean;
  capabilities: HvacCapabilities;
  state: DeviceStateRow | null;
  live_read: Record<string, unknown> | null;
}
export interface DoorStateResponse {
  door_id: string;
  device_id: string;
  driver_mode: string;
  simulated: boolean;
  door_contact: string;
  last_unlock: DeviceStateRow | null;
  note: string;
}

// ---------------------------------------------------------------- relay
export interface CircuitView {
  circuit_id: string;
  number: number;
  name: string;
  zone: string | null;
  voltage: string | null;
  load_w: number | null;
  load_note: string | null;
  power_confirmed: boolean;
  wiring_mode: string;
  enabled: boolean;
  source_note: string | null;
  issue: string | null;
  operable: boolean;
  inoperable_code: string | null;
  inoperable_reason: string | null;
  control_policy: { mode: string; follows: string | null; critical_power: boolean; policy_note: string | null };
  schedule: { start: string; end: string } | null;
  desired_state: string | null;
  desired_reason: string | null;
  binding: CircuitBinding | null;
  state: { requested: unknown; reported: unknown; verification: string; driver_mode: string | null; updated_at: string | null };
  supply: { policy: string | null; confirmed: boolean | null; display: string | null };
}
export interface CircuitsResponse {
  count: number;
  mapping_revision: number;
  simulation_mapping: boolean;
  circuits: CircuitView[];
}

// ---------------------------------------------------------------- cameras / sessions
export interface Camera {
  camera_id: string;
  number: number;
  name: string;
  location: string;
  scope: string;
  expected_enabled: boolean;
  mapping_status: MappingStatus;
  live_available: boolean;
  search_available: boolean;
  playback_available: boolean;
  live_verified: boolean;
  history_verified: boolean;
  driver_mode: string;
}
export interface WhepPlayback {
  protocol: 'whep';
  url: string;
  token: string;
  token_expires_at: string;
  ice_servers: RTCIceServer[];
}
export interface SessionView {
  session_id: string;
  camera_id: string;
  kind: 'live' | 'playback';
  status: 'preparing' | 'ready' | 'failed' | 'stopped' | 'expired' | string;
  stream_profile: string;
  delivery_target: string;
  created_at: string;
  expires_at: string;
  status_url: string;
  params?: Record<string, unknown>;
  playback?: WhepPlayback;
  error?: { code: string; message: string };
}
export interface RecordingSegment {
  recording_id: string;
  camera_id: string;
  start_time: string;
  end_time: string;
  available: boolean;
}
export interface RecordingsResponse {
  camera_id: string;
  from: string;
  to: string;
  source: string;
  items: RecordingSegment[];
  next_cursor: string | null;
  retention_note?: string;
}

// ---------------------------------------------------------------- deployment mapping
export type MappingStatus = 'unbound' | 'draft' | 'validated' | 'active';
export type WiringMode = 'relay_switched' | 'hardware_bypass' | 'reserved' | 'unconfirmed';

export interface BusDef {
  bus_id: string;
  serial_path: string | null;
  baudrate: number | null;
  parity: 'N' | 'E' | 'O' | null;
  data_bits: number | null;
  stop_bits: number | null;
  timeout_s: number | null;
  protocol_profile: 'modbus_rtu' | 'soyal_binary' | 'unspecified';
  note: string | null;
}
export interface ControllerDef {
  controller_id: string;
  kind: 'relay_controller' | 'access' | 'hvac';
  vendor: string | null;
  model: string | null;
  firmware: string | null;
  protocol: 'modbus_m7000' | 'soyal_721_727' | 'unspecified';
  bus_id: string | null;
  node_id: number | null;
  do_count: number | null;
  capabilities: string[];
  modbus_functions: number[];
  profile_source: string | null;
  profile_pages: string | null;
  model_confirmed: boolean;
  simulation_only: boolean;
}
export type TableType = 'coil' | 'discrete_input' | 'input_register' | 'holding_register';
export interface ModbusBinding {
  table_type: TableType | null;
  reference_address: string | null;
  base: number;
  read_function: number | null;
  write_function: number | null;
  pdu_offset?: number | null; // only in /relay/circuits views
}
export interface SoyalBinding {
  command: string | null;
  selector: string | null;
}
export interface CircuitBinding {
  circuit_id: string;
  wiring_mode: WiringMode;
  controller_id: string | null;
  physical_output_channel: number | null;
  modbus: ModbusBinding | null;
  soyal: SoyalBinding | null;
  active_polarity: 'high' | 'low' | null;
  feedback_type: 'none' | 'do_readback' | 'auxiliary_contact' | 'current_sensor' | 'other';
  feedback_source: string | null;
  interlock_group: string | null;
  mapping_status: MappingStatus;
  hardware_verified_at: string | null;
  verified_by: string | null;
  note: string | null;
}
export interface NvrDef {
  nvr_id: string;
  vendor: string;
  model: string | null;
  firmware: string | null;
  timezone: string;
  driver: 'mock' | 'real';
  note: string | null;
}
export interface CameraBinding {
  camera_id: string;
  nvr_id: string | null;
  nvr_channel: string | null;
  isapi_track_id: string | null;
  sdk_channel_id: string | null;
  rtsp_stream_ids: Record<string, string | null>;
  codec: string | null;
  audio_capability: boolean | null;
  live_capable: boolean;
  search_capable: boolean;
  playback_capable: boolean;
  live_verified_at: string | null;
  history_verified_at: string | null;
  duplicate_intent_confirmed: boolean;
  mapping_status: MappingStatus;
  hardware_verified_at: string | null;
  note: string | null;
}
export interface Deployment {
  simulation_only: boolean;
  buses: BusDef[];
  controllers: ControllerDef[];
  circuits: CircuitBinding[];
  nvrs: NvrDef[];
  cameras: CameraBinding[];
}
export interface CatalogCircuit {
  circuit_id: string;
  number: number;
  name: string;
  zone: string | null;
  voltage: string | null;
  load_w: number | null;
  load_note: string | null;
  power_confirmed: boolean;
  control_mode: 'reservation' | 'business_hours' | 'night_hours' | 'always_on_bypass' | 'reserved';
  follows: string | null;
  wiring_mode: WiringMode;
  enabled: boolean;
  critical_power: boolean;
  policy_note: string | null;
  issue: string | null;
}
export interface CatalogCamera {
  camera_id: string;
  number: number;
  name: string;
  location: string;
  scope: string;
}
export interface MappingActive {
  revision: number;
  deployment: Deployment;
  catalog: { circuits: CatalogCircuit[]; cameras: CatalogCamera[] };
}
export interface DraftResponse {
  exists: boolean;
  active_revision: number;
  draft_revision: number;
  base_revision: number;
  updated_by?: string | null;
  updated_at?: string | null;
  deployment: Deployment;
}
export interface Issue {
  level: 'error' | 'warning' | 'pending';
  section: string;
  entity: string;
  code: string;
  message: string;
}
export interface ValidationResult {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
  pending: Issue[];
  normalized: Deployment | null;
  note?: string;
}
export interface DiffChange {
  section: string;
  id: string;
  change: 'added' | 'removed' | 'modified';
  fields: Array<{ field: string; before: unknown; after: unknown }>;
}
export interface DraftDiff {
  active_revision: number;
  changes: DiffChange[];
  pending: Issue[];
}
export interface MappingVersion {
  revision: number;
  created_by: string;
  created_at: string;
  comment: string | null;
  kind: string;
}
export interface AuditItem {
  [k: string]: unknown;
}
export interface AddressPreviewResult {
  table_type: TableType;
  reference_address: string;
  base: number;
  pdu_offset: number;
  read_functions: number[];
  write_functions: number[];
}
export interface FunctionMenu {
  menu: Array<{ code: number; name: string }>;
  note: string;
}
