import { useState, type ReactNode } from 'react';
import { get } from '../api/client';
import { useAuth } from '../auth';
import { Badge, Card, ErrorBox, KV, Loading, Notice, Tabs } from '../components/ui';
import { useLoad } from '../lib/useLoad';
import DeploymentMapping from './DeploymentMapping';

type Json = Record<string, unknown>;

function Val({ v }: { v: unknown }): ReactNode {
  if (v === null || v === undefined || v === '') return <span className="muted">—</span>;
  if (typeof v === 'boolean') return <Badge tone={v ? 'ok' : 'mute'}>{v ? 'true' : 'false'}</Badge>;
  if (v === 'set') return <Badge tone="ok">已設定 (set)</Badge>;
  if (v === 'unset') return <Badge tone="warn">未設定 (unset)</Badge>;
  if (Array.isArray(v)) return <span className="mono">{v.length ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ') : '[]'}</span>;
  if (typeof v === 'object') return <span className="mono">{JSON.stringify(v)}</span>;
  return <span className="mono">{String(v)}</span>;
}

function ObjectRows({ o }: { o: Json }) {
  return <KV rows={Object.entries(o).map(([k, v]) => [k, <Val key={k} v={v} />])} />;
}

function DeviceConfig() {
  const { data, error, loading, reload } = useLoad((s) => get<Json>('/v1/system/config', { signal: s }));
  const devices = (data?.devices as Json[] | undefined) ?? [];
  const hik = data?.hikvision as Json | undefined;
  const env = (hik?.env as Json | undefined) ?? {};
  const hikRest = hik ? Object.fromEntries(Object.entries(hik).filter(([k]) => k !== 'env')) : {};
  return (
    <>
      <Notice>此頁為唯讀。機敏欄位已由伺服器遮罩；環境變數只顯示「已設定／未設定」，不顯示內容。</Notice>
      <ErrorBox error={error} onRetry={() => void reload()} />
      {loading && !data && <Loading />}
      {data && (
        <>
          <Card title="站點"><ObjectRows o={{ ...(data.site as Json), mode: data.mode, cloud_url_configured: (data.cloud as Json)?.url_configured }} /></Card>
          <Card title="設備">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>device_id</th><th>類型</th><th>名稱</th><th>驅動</th><th>協定</th><th>bus</th><th>node</th><th>最低角色</th><th>其他</th></tr></thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={String(d.device_id)}>
                      <td>{String(d.device_id)}</td><td>{String(d.kind)}</td><td>{String(d.name ?? '—')}</td>
                      <td>{d.driver === 'mock' ? <Badge tone="sim">mock</Badge> : String(d.driver)}</td>
                      <td>{String(d.driver_profile ?? '—')}</td><td>{String(d.bus_id ?? '—')}</td><td>{String(d.node_id ?? '—')}</td>
                      <td>{String(d.min_role)}</td>
                      <td className="small mono">{[d.vendor, d.model, d.firmware].filter(Boolean).join(' ') || '—'}{Array.isArray(d.doors) && d.doors.length ? ` doors=${d.doors.join(',')}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="政策"><ObjectRows o={data.policies as Json} /></Card>
          <Card title="媒體"><ObjectRows o={data.media as Json} /></Card>
          <Card title="Hikvision"><ObjectRows o={hikRest} /></Card>
          <Card title="Hikvision 環境變數"><ObjectRows o={env} /></Card>
        </>
      )}
    </>
  );
}

export default function Settings() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'device' | 'mapping'>('device');
  return (
    <div className="page">
      <div className="page-head"><h1>系統設定</h1></div>
      <Tabs
        tabs={[
          { id: 'device' as const, label: '設備設定' },
          ...(can('admin') ? [{ id: 'mapping' as const, label: '部署與位址映射' }] : []),
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'device' && (can('operator') ? <DeviceConfig /> : <Notice tone="warn">設備設定僅提供操作員以上角色檢視。</Notice>)}
      {tab === 'mapping' && can('admin') && <DeploymentMapping />}
      {!can('admin') && <p className="small muted">「部署與位址映射」僅限管理員。</p>}
    </div>
  );
}
