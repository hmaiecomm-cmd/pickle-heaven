import { get } from '../api/client';
import type { SystemStatus } from '../api/types';
import { StatusBadge, VerificationBadge } from '../components/CommandStatus';
import { BoolBadge, Badge, Card, ErrorBox, KV, Loading, Notice } from '../components/ui';
import { fmtTime } from '../lib/format';
import { useLoad } from '../lib/useLoad';

export function BusTable({ buses }: { buses: SystemStatus['buses'] }) {
  if (!buses.length) return <div className="empty">尚未設定匯流排（部署映射中沒有 bus）。</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>bus_id</th><th>序列埠路徑</th><th>協定</th><th>狀態</th><th>穩定路徑</th><th>可讀寫</th></tr>
        </thead>
        <tbody>
          {buses.map((b) => (
            <tr key={b.bus_id}>
              <td>{b.bus_id}</td>
              <td className="mono">{b.serial_path ?? '—'}</td>
              <td>{b.protocol_profile}</td>
              <td>
                <Badge tone={b.state === 'present' ? 'ok' : b.state === 'missing' ? 'bad' : 'mute'}>
                  {b.state === 'present' ? '存在' : b.state === 'missing' ? '找不到' : '未設定'}
                </Badge>
              </td>
              <td>{b.stable_path === undefined ? '—' : <BoolBadge value={b.stable_path} />}</td>
              <td>{b.readable === undefined ? '—' : <BoolBadge value={b.readable} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecentCommands({ items }: { items: SystemStatus['recent_commands'] }) {
  if (!items.length) return <div className="empty">尚無命令紀錄。</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>時間</th><th>類型</th><th>目標</th><th>狀態</th><th>驗證</th><th>錯誤碼</th><th>驅動</th></tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.command_id} title={c.command_id}>
              <td>{fmtTime(c.created_at)}</td>
              <td>{c.type}</td>
              <td>{c.target_id}</td>
              <td><StatusBadge status={c.status} /></td>
              <td><VerificationBadge verification={c.verification} /></td>
              <td>{c.error_code ? <code className="code">{c.error_code}</code> : '—'}</td>
              <td>{c.driver_mode === 'mock' ? <Badge tone="sim">模擬</Badge> : (c.driver_mode ?? '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Overview() {
  const { data: s, error, loading, reload } = useLoad((sig) => get<SystemStatus>('/v1/system/status', { signal: sig }), [], { intervalMs: 5000 });
  return (
    <div className="page">
      <div className="page-head">
        <h1>總覽</h1>
        <button type="button" className="btn" onClick={() => void reload()}>重新整理</button>
      </div>
      <ErrorBox error={error} onRetry={() => void reload()} />
      {loading && !s && <Loading />}
      {s && (
        <>
          {s.warnings.length > 0 && (
            <Notice tone="warn">
              <strong>設定警告</strong>
              <ul>{s.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </Notice>
          )}
          <div className="grid-cards">
            <Card title="Edge">
              <KV rows={[
                ['站點／Edge', `${s.site_id} / ${s.edge_id}`],
                ['模式', s.mode === 'mock' ? <Badge tone="sim">模擬 (mock)</Badge> : <Badge tone="ok">{s.mode}</Badge>],
                ['資料庫', <Badge tone={s.database === 'ok' ? 'ok' : 'bad'}>{s.database}</Badge>],
                ['伺服器時間', fmtTime(s.time)],
                ['映射版本', `rev ${s.mapping_revision}${s.simulation_mapping ? '（模擬映射）' : ''}`],
                ['網路', `${s.network.hostname} ${s.network.addresses.join(', ')}`],
              ]} />
            </Card>
            <Card title="命令">
              <KV rows={[
                ['執行中', s.commands.active],
                ['近期失敗／未知', <span className={s.commands.recent_failed ? 'text-bad' : ''}>{s.commands.recent_failed}</span>],
              ]} />
            </Card>
            <Card title="媒體閘道">
              <KV rows={[
                ['MediaMTX', <Badge tone={s.media.gateway.reachable ? 'ok' : 'bad'}>{s.media.gateway.reachable ? '可連線' : '無法連線'}</Badge>],
                ['ffmpeg', s.media.tools.ffmpeg.available ? <Badge tone="ok">可用</Badge> : <Badge tone="bad">缺少</Badge>],
                ['ffmpeg 版本', s.media.tools.ffmpeg.version],
                ['ffmpeg 工作', s.media.ffmpeg_jobs],
                ['即時／回放工作階段', `${s.media.live_sessions} / ${s.media.playback_sessions}`],
              ]} />
            </Card>
            <Card title="NVR／SDK">
              <KV rows={[
                ['NVR 驅動', s.nvr.driver === 'mock' ? <Badge tone="sim">模擬 (mock)</Badge> : s.nvr.driver],
                ['SDK 狀態', s.nvr.sdk.state],
                ['SDK worker', String((s.nvr.sdk.worker as Record<string, unknown>).binding ?? '—')],
                ['能力', Object.entries(s.nvr.capabilities).filter(([, v]) => v).map(([k]) => k).join(', ') || '未確認任何能力'],
              ]} />
            </Card>
            <Card title="雲端">
              <KV rows={[
                ['啟用', <BoolBadge value={s.cloud.enabled} yes="已啟用" no="未啟用" />],
                ['用戶端', s.cloud.client],
                ['最近事件成功', fmtTime(s.cloud.last_event_success)],
                ['最近心跳成功', fmtTime(s.cloud.heartbeat_last_success)],
                ['最近錯誤', s.cloud.last_error ?? '—'],
                ['Outbox（待送／總數）', `${s.cloud.outbox.pending} / ${s.cloud.outbox.total}`],
              ]} />
            </Card>
          </div>
          <Card title="通訊匯流排"><BusTable buses={s.buses} /></Card>
          <Card title="最近命令"><RecentCommands items={s.recent_commands} /></Card>
        </>
      )}
    </div>
  );
}
