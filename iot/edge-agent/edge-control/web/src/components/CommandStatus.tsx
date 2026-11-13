import type { CommandView } from '../api/types';
import type { RunnerState } from '../lib/useCommand';
import { COMMAND_STATUS_LABEL, VERIFICATION_LABEL, VERIFICATION_TIP, fmtState } from '../lib/format';
import { Badge, ErrorBox, type Tone } from './ui';

const STATUS_TONE: Record<string, Tone> = { accepted: 'info', running: 'info', succeeded: 'ok', failed: 'bad', expired: 'warn', unknown: 'warn' };
const VERIF_TONE: Record<string, Tone> = { confirmed: 'ok', unverified: 'warn', unknown: 'mute' };

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'mute'}>{COMMAND_STATUS_LABEL[status] ?? status}</Badge>;
}

export function VerificationBadge({ verification, title }: { verification: string | null | undefined; title?: string }) {
  const v = verification ?? 'unknown';
  return (
    <Badge tone={VERIF_TONE[v] ?? 'mute'} title={title ?? VERIFICATION_TIP}>
      {VERIFICATION_LABEL[v] ?? v}
    </Badge>
  );
}

export function SimulatedBadge() {
  return <Badge tone="sim" title="此結果來自模擬驅動，不代表真實硬體">模擬</Badge>;
}

export function CommandLine({ c }: { c: CommandView }) {
  return (
    <div className="cmd">
      <div className="row">
        <StatusBadge status={c.status} />
        <VerificationBadge verification={c.verification} />
        {c.simulated && <SimulatedBadge />}
        <span className="small muted">要求：{fmtState(c.requested_state)}　回報：{fmtState(c.reported_state)}</span>
      </div>
      {c.error && (
        <div className="small text-bad">
          {c.error.message ?? '命令失敗'} <code className="code">{c.error.code}</code>
        </div>
      )}
      {c.status === 'succeeded' && c.verification !== 'confirmed' && (
        <div className="small muted">通訊成功不等於負載已確認（驗證狀態：{VERIFICATION_LABEL[c.verification] ?? c.verification}）。</div>
      )}
      <div className="small muted">command_id: {c.command_id}</div>
    </div>
  );
}

/** Progress of one command run: submitting -> polling -> terminal. */
export function CommandStatus({ state }: { state: RunnerState }) {
  if (state.phase === 'idle') return null;
  return (
    <div className="cmd-box" aria-live="polite">
      {state.phase === 'submitting' && <div className="small">送出命令中…</div>}
      {state.phase === 'error' && <ErrorBox error={state.error} />}
      {state.phase === 'polling' && !state.command && <div className="small"><span className="spinner" /> 已送出，等待執行（輪詢中）…</div>}
      {state.replay && <div className="small muted">此 command_id 已存在（重放），顯示既有結果。</div>}
      {state.command && <CommandLine c={state.command} />}
      {state.phase === 'polling' && state.command && <div className="small muted"><span className="spinner" /> 持續更新中…</div>}
      {state.pollIssue && (
        <div className="small text-warn">
          {state.pollIssue === 'timeout' ? '輪詢逾時，' : '無法取得命令狀態，'}命令可能仍在執行。系統不會自動重試；請稍後重新整理確認結果。
        </div>
      )}
    </div>
  );
}
