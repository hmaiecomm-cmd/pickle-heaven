import { useEffect, useRef, useState } from 'react';
import type { Camera } from '../api/types';
import { hintFor } from '../lib/errors';
import { MAPPING_STATUS_LABEL, SESSION_PHASE_LABEL, fmtTime } from '../lib/format';
import { useMediaSession, type MediaError, type MediaPhase } from '../lib/useMediaSession';
import { VideoPane } from './VideoPane';
import { Badge, type Tone } from './ui';

const PHASE_TONE: Record<MediaPhase, Tone> = {
  idle: 'mute', creating: 'info', preparing: 'info', connecting: 'info', playing: 'ok', failed: 'bad', stopped: 'mute', expired: 'warn',
};

export function MediaErrorLine({ error }: { error: MediaError }) {
  const hint = hintFor(error.code);
  return (
    <div className="small text-bad" role="alert">
      {error.message} <code className="code">{error.code}</code>
      {hint && hint !== error.message && <div>{hint}</div>}
      {error.requestId && <div className="muted">request_id: {error.requestId}</div>}
    </div>
  );
}

export function PhaseBadge({ phase, connState }: { phase: MediaPhase; connState?: string }) {
  return (
    <Badge tone={PHASE_TONE[phase]}>
      {SESSION_PHASE_LABEL[phase]}
      {phase === 'playing' || phase === 'connecting' ? '' : connState ? ` (${connState})` : ''}
    </Badge>
  );
}

export type GridCommand = { type: 'start' | 'stop'; n: number } | null;

export function CameraCell({ camera, profile, large, command, onActiveChange }: { camera: Camera; profile: 'main' | 'sub'; large?: boolean; command?: GridCommand; onActiveChange?: (a: boolean) => void }) {
  const m = useMediaSession();
  const unbound = camera.mapping_status === 'unbound';
  const canPlay = camera.live_available;
  const lastN = useRef(0);
  useEffect(() => {
    onActiveChange?.(m.active);
    return () => onActiveChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.active]);

  const play = () => void m.start('live', camera.camera_id, { stream_profile: profile, delivery_target: 'browser', ttl_seconds: 300 });

  useEffect(() => {
    if (!command || command.n === lastN.current) return;
    lastN.current = command.n;
    if (command.type === 'start' && canPlay && !m.active) play();
    if (command.type === 'stop' && m.active) void m.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  return (
    <article className={`cam ${large ? 'cam-large' : ''}`} aria-label={camera.name}>
      <header className="cam-head">
        <div>
          <strong>{camera.name}</strong>
          <div className="small muted">{camera.camera_id} · 監看範圍：{camera.scope}</div>
        </div>
        <PhaseBadge phase={m.phase} connState={m.connState} />
      </header>
      <div className="cam-view">
        {m.stream ? (
          <VideoPane stream={m.stream} label={`${camera.name} 即時影像`} />
        ) : (
          <div className="cam-placeholder">
            {unbound ? (
              <span>未綁定 NVR 通道</span>
            ) : !canPlay ? (
              <span>即時影像不可用<br /><span className="small">映射狀態：{MAPPING_STATUS_LABEL[camera.mapping_status] ?? camera.mapping_status}</span></span>
            ) : m.phase === 'expired' ? (
              <span>已到期<br /><span className="small">請重新開始</span></span>
            ) : (
              <span>{SESSION_PHASE_LABEL[m.phase]}</span>
            )}
          </div>
        )}
      </div>
      {m.error && <MediaErrorLine error={m.error} />}
      <footer className="cam-foot">
        <span className="small muted">
          <Badge tone={camera.mapping_status === 'active' ? 'ok' : 'mute'}>{MAPPING_STATUS_LABEL[camera.mapping_status] ?? camera.mapping_status}</Badge>{' '}
          {profile === 'sub' ? '子碼流' : '主碼流'}
          {m.session && m.phase === 'playing' ? ` · 到期 ${fmtTime(m.session.expires_at)}` : ''}
        </span>
        <span className="row">
          {canPlay && !m.active && (
            <button type="button" className="btn btn-sm btn-primary" onClick={play}>
              {m.phase === 'expired' ? '重新開始' : '播放'}
            </button>
          )}
          {m.active && (
            <button type="button" className="btn btn-sm" onClick={() => void m.stop()}>
              停止
            </button>
          )}
        </span>
      </footer>
    </article>
  );
}

/** 2x3 multi-view (sub stream by default) + single-camera view with main/sub toggle. */
export function CameraGrid({ cameras }: { cameras: Camera[] }) {
  const [view, setView] = useState<'multi' | 'single'>('multi');
  const [selected, setSelected] = useState<string>(cameras[0]?.camera_id ?? '');
  const [profile, setProfile] = useState<'main' | 'sub'>('sub');
  const [cmd, setCmd] = useState<GridCommand>(null);
  const [singleActive, setSingleActive] = useState(false);
  const playable = cameras.filter((c) => c.live_available).length;
  const sel = cameras.find((c) => c.camera_id === selected) ?? cameras[0];

  return (
    <div>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="檢視模式">
          <button type="button" className={`seg-btn ${view === 'multi' ? 'active' : ''}`} onClick={() => setView('multi')}>多畫面 2×3</button>
          <button type="button" className={`seg-btn ${view === 'single' ? 'active' : ''}`} onClick={() => setView('single')}>單鏡頭</button>
        </div>
        {view === 'multi' ? (
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={playable === 0} onClick={() => setCmd({ type: 'start', n: (cmd?.n ?? 0) + 1 })}>
              全部播放（子碼流）
            </button>
            <button type="button" className="btn" onClick={() => setCmd({ type: 'stop', n: (cmd?.n ?? 0) + 1 })}>全部停止</button>
            <span className="small muted">可播放 {playable} / {cameras.length} 台；每台為獨立工作階段，伺服器有同時串流上限。</span>
          </div>
        ) : (
          <div className="row">
            <label className="inline">
              攝影機
              <select value={sel?.camera_id} onChange={(e) => setSelected(e.target.value)}>
                {cameras.map((c) => (
                  <option key={c.camera_id} value={c.camera_id}>{c.camera_id} {c.name}</option>
                ))}
              </select>
            </label>
            <div className="seg" role="group" aria-label="碼流">
              <button type="button" className={`seg-btn ${profile === 'sub' ? 'active' : ''}`} onClick={() => setProfile('sub')} disabled={singleActive}>子碼流</button>
              <button type="button" className={`seg-btn ${profile === 'main' ? 'active' : ''}`} onClick={() => setProfile('main')} disabled={singleActive}>主碼流</button>
            </div>
            {singleActive && <span className="small muted">切換碼流前請先停止播放</span>}
          </div>
        )}
      </div>

      {view === 'multi' ? (
        <div className="cam-grid">
          {cameras.map((c) => (
            <CameraCell key={c.camera_id} camera={c} profile="sub" command={cmd} />
          ))}
        </div>
      ) : (
        sel && <CameraCell key={sel.camera_id} camera={sel} profile={profile} large onActiveChange={setSingleActive} />
      )}
    </div>
  );
}
