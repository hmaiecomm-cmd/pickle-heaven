import { get } from '../api/client';
import type { AuditItem, SystemStatus } from '../api/types';
import { useAuth } from '../auth';
import { Badge, BoolBadge, Card, ErrorBox, KV, Loading, Notice } from '../components/ui';
import { fmtTime } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { BusTable, RecentCommands } from './Overview';

export function AuditTable({ items }: { items: AuditItem[] }) {
  if (!items.length) return <div className="empty">尚無稽核紀錄。</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>時間</th><th>操作者</th><th>角色</th><th>動作</th><th>目標</th><th>結果</th><th>內容</th></tr></thead>
        <tbody>
          {items.map((a, i) => {
            const ts = (a.created_at ?? a.ts ?? a.time) as string | undefined;
            return (
              <tr key={String(a.id ?? i)}>
                <td className="nowrap">{fmtTime(ts)}</td>
                <td>{String(a.actor ?? '—')}</td>
                <td>{String(a.role ?? '—')}</td>
                <td>{String(a.action ?? '—')}</td>
                <td>{String(a.target ?? '—')}</td>
                <td>{String(a.result ?? '—')}</td>
                <td className="small mono">{a.detail ? (typeof a.detail === 'string' ? a.detail : JSON.stringify(a.detail)) : (a.command_id ? String(a.command_id) : '—')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Diagnostics() {
  const { can } = useAuth();
  const st = useLoad((s) => get<SystemStatus>('/v1/system/status', { signal: s }), [], { intervalMs: 5000 });
  const audit = useLoad(async (s) => (can('admin') ? get<{ items: AuditItem[] }>('/v1/audit', { signal: s, query: { limit: 100 } }) : { items: [] }), [can('admin')]);
  const s = st.data;
  const worker = (s?.nvr.sdk.worker ?? {}) as Record<string, unknown>;
  return (
    <div className="page">
      <div className="page-head">
        <h1>系統診斷</h1>
        <button type="button" className="btn" onClick={() => { void st.reload(); void audit.reload(); }}>重新整理</button>
      </div>
      <Notice>診斷資訊不含任何憑證；僅顯示狀態類別與布林值。</Notice>
      <ErrorBox error={st.error} onRetry={() => void st.reload()} />
      {st.loading && !s && <Loading />}
      {s && (
        <>
          <Card title="序列埠／匯流排（只檢查路徑是否存在，不開啟埠）"><BusTable buses={s.buses} /></Card>
          <div className="grid-cards">
            <Card title="NVR 與 SDK worker">
              <KV rows={[
                ['NVR 驅動', s.nvr.driver],
                ['Hikvision 環境已設定', <BoolBadge value={Boolean(s.nvr.hikvision_configured)} yes="是" no="否" />],
                ['SDK 載入狀態', s.nvr.sdk.state],
                ['綁定 (binding)', String(worker.binding ?? '—')],
                ['執行中', worker.running === undefined ? '—' : <BoolBadge value={Boolean(worker.running)} yes="執行中" no="未執行" />],
                ['世代 (generation)', String(worker.generation ?? '—')],
                ['重啟次數', String(worker.restarts ?? '—')],
                ['最近錯誤類別', String(worker.last_error_class ?? '—')],
                ['能力', Object.entries(s.nvr.capabilities).map(([k, v]) => <Badge key={k} tone={v ? 'ok' : 'mute'}>{k}</Badge>)],
              ]} />
            </Card>
            <Card title="媒體閘道與工具">
              <KV rows={[
                ['MediaMTX', <Badge tone={s.media.gateway.reachable ? 'ok' : 'bad'}>{s.media.gateway.reachable ? '可連線' : '無法連線'}</Badge>],
                ['後端', s.media.gateway.backend],
                ['錯誤類別', s.media.gateway.error],
                ['ffmpeg', <BoolBadge value={s.media.tools.ffmpeg.available} yes="可用" no="缺少" />],
                ['版本', s.media.tools.ffmpeg.version],
                ['ffprobe', <BoolBadge value={s.media.tools.ffprobe.available} yes="可用" no="缺少" />],
                ['ffmpeg 工作數', s.media.ffmpeg_jobs],
                ['即時／回放', `${s.media.live_sessions} / ${s.media.playback_sessions}`],
              ]} />
            </Card>
            <Card title="雲端／Outbox">
              <KV rows={[
                ['啟用', <BoolBadge value={s.cloud.enabled} yes="已啟用" no="未啟用" />],
                ['用戶端', s.cloud.client],
                ['最近事件成功', fmtTime(s.cloud.last_event_success)],
                ['最近心跳成功', fmtTime(s.cloud.heartbeat_last_success)],
                ['最近錯誤', s.cloud.last_error],
                ['Outbox 待送／總數', `${s.cloud.outbox.pending} / ${s.cloud.outbox.total}`],
              ]} />
            </Card>
          </div>
          <Card title={`命令佇列（執行中 ${s.commands.active}，近期失敗/未知 ${s.commands.recent_failed}）`}>
            <RecentCommands items={s.recent_commands} />
          </Card>
        </>
      )}
      <Card title="稽核紀錄（管理員）">
        {!can('admin') ? <div className="empty">僅管理員可檢視稽核紀錄。</div> : (
          <>
            <ErrorBox error={audit.error} onRetry={() => void audit.reload()} />
            {audit.loading && !audit.data ? <Loading /> : <AuditTable items={audit.data?.items ?? []} />}
          </>
        )}
      </Card>
    </div>
  );
}
