import { get, put } from '../api/client';
import type { CircuitView, CircuitsResponse, CommandAccepted } from '../api/types';
import { useAuth } from '../auth';
import { CommandStatus, VerificationBadge } from '../components/CommandStatus';
import { Badge, ErrorBox, Loading, Notice } from '../components/ui';
import { CONTROL_MODE_LABEL, INOPERABLE_LABEL, fmtState, fmtTime, fmtWatt } from '../lib/format';
import { useCommandRunner } from '../lib/useCommand';
import { useLoad } from '../lib/useLoad';

function ModeChip({ c }: { c: CircuitView }) {
  const m = c.control_policy.mode;
  const tone = m === 'always_on_bypass' ? 'warn' : m === 'reserved' ? 'mute' : 'info';
  return (
    <Badge tone={tone} title={c.control_policy.policy_note ?? undefined}>
      {CONTROL_MODE_LABEL[m] ?? m}
      {c.control_policy.follows ? ` · ${c.control_policy.follows}` : ''}
    </Badge>
  );
}

function StateCell({ c }: { c: CircuitView }) {
  const bypass = c.supply.policy === 'always_on_by_design';
  if (bypass) {
    // Never claim the bypass circuit is powered: it is only "by design" always on.
    return <span>設計常供電 · 供電狀態：{c.supply.display ?? '未確認'}</span>;
  }
  if (c.control_policy.mode === 'reserved') return <span className="muted">預留</span>;
  return (
    <div>
      <div className="small">要求：<strong>{fmtState(c.state.requested)}</strong>　回報：<strong>{fmtState(c.state.reported)}</strong></div>
      <div className="row">
        <VerificationBadge verification={c.state.verification} />
        {c.state.driver_mode === 'mock' && <Badge tone="sim">模擬</Badge>}
      </div>
      {c.state.updated_at && <div className="small muted">{fmtTime(c.state.updated_at)}</div>}
      {c.desired_state && <div className="small muted">排程期望：{fmtState(c.desired_state)}</div>}
    </div>
  );
}

function RelayRow({ c, canControl, onDone }: { c: CircuitView; canControl: boolean; onDone: () => void }) {
  const runner = useCommandRunner();
  const send = (state: 'on' | 'off') =>
    void runner.run(
      (command_id, expires_at) => put<CommandAccepted>(`/v1/relay/circuits/${c.circuit_id}/state`, { command_id, expires_at, state }),
      onDone,
    );
  const reason = c.inoperable_code ? (INOPERABLE_LABEL[c.inoperable_code] ?? c.inoperable_reason ?? c.inoperable_code) : null;
  return (
    <tr>
      <td className="nowrap"><strong>{String(c.number).padStart(2, '0')}</strong><div className="small muted">{c.circuit_id}</div></td>
      <td>
        {c.name}
        <div className="small muted">{c.zone ?? '—'}</div>
        {c.issue && <div className="small text-warn">⚠ {c.issue}</div>}
        {c.source_note && <div className="small muted">{c.source_note}</div>}
      </td>
      <td>
        <div>{c.voltage ?? '待確認'}</div>
        <div className="small">{fmtWatt(c.load_w)}{c.load_w !== null && <span className="muted">（規劃值）</span>}</div>
        {c.load_note && <div className="small muted">{c.load_note}</div>}
      </td>
      <td><ModeChip c={c} /></td>
      <td><StateCell c={c} /></td>
      <td>
        {c.operable && canControl ? (
          <div className="row">
            <button type="button" className="btn btn-sm btn-primary" disabled={runner.busy} onClick={() => send('on')}>ON</button>
            <button type="button" className="btn btn-sm" disabled={runner.busy} onClick={() => send('off')}>OFF</button>
          </div>
        ) : c.operable ? (
          <span className="small muted">檢視者無法操作</span>
        ) : (
          <div className="small">
            <code className="code">{c.inoperable_code}</code>
            <div className="muted">{reason}</div>
          </div>
        )}
        <CommandStatus state={runner.state} />
      </td>
    </tr>
  );
}

export default function Relay() {
  const { can } = useAuth();
  const { data, error, loading, reload } = useLoad((s) => get<CircuitsResponse>('/v1/relay/circuits', { signal: s }), [], { intervalMs: 10000 });
  return (
    <div className="page">
      <div className="page-head">
        <h1>Relay 迴路</h1>
        <button type="button" className="btn" onClick={() => void reload()}>重新整理</button>
      </div>
      <ErrorBox error={error} onRetry={() => void reload()} />
      {loading && !data && <Loading />}
      {data && (
        <>
          {data.simulation_mapping && <Notice tone="warn">目前使用模擬位址映射：操作只影響模擬輸出。</Notice>}
          <Notice>
            電壓與負載為圖面「規劃值」，非實測；未確認者顯示「待確認」。ON/OFF 為非同步命令，「回報」與「驗證」才代表伺服器實際取得的結果。映射版本 rev {data.mapping_revision}。
          </Notice>
          <div className="table-wrap">
            <table className="table table-relay">
              <thead>
                <tr><th>編號</th><th>名稱／區域</th><th>電壓與負載<br /><span className="small muted">規劃值</span></th><th>控制模式</th><th>供電設計／狀態</th><th>操作</th></tr>
              </thead>
              <tbody>
                {data.circuits.map((c) => (
                  <RelayRow key={c.circuit_id} c={c} canControl={can('operator')} onDone={() => void reload(true)} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
