import { useState } from 'react';
import { get, post } from '../api/client';
import type { CommandAccepted, DoorStateResponse } from '../api/types';
import { useAuth } from '../auth';
import { CommandStatus, SimulatedBadge, VerificationBadge } from '../components/CommandStatus';
import { Badge, Card, ConfirmDialog, ErrorBox, KV, Loading, Notice } from '../components/ui';
import { fmtState, fmtTime } from '../lib/format';
import { useCommandRunner } from '../lib/useCommand';
import { useLoad } from '../lib/useLoad';

const DOOR_ID = 'door-1';

const CONTACT_LABEL: Record<string, string> = {
  unknown: '未知（控制器未回報門磁）',
  not_supported: '不支援（此控制器沒有門磁）',
  open: '開啟',
  closed: '關閉',
};

export default function Access() {
  const { can } = useAuth();
  const { data, error, loading, reload } = useLoad((s) => get<DoorStateResponse>(`/v1/access/${DOOR_ID}/state`, { signal: s }));
  const runner = useCommandRunner();
  const [confirm, setConfirm] = useState(false);

  const unlock = () => {
    setConfirm(false);
    void runner.run(
      (command_id, expires_at) => post<CommandAccepted>(`/v1/access/${DOOR_ID}/unlock`, { command_id, expires_at }),
      () => void reload(true),
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>門禁</h1>
        <button type="button" className="btn" onClick={() => void reload()}>重新整理</button>
      </div>
      <ErrorBox error={error} onRetry={() => void reload()} />
      {loading && !data && <Loading />}
      {data && (
        <>
          <Card title={<>{DOOR_ID} {data.simulated && <SimulatedBadge />}</>}>
            <KV rows={[
              ['門磁狀態', <Badge tone={data.door_contact === 'open' || data.door_contact === 'closed' ? 'ok' : 'warn'}>{CONTACT_LABEL[data.door_contact] ?? data.door_contact}</Badge>],
              ['最近一次開門命令', data.last_unlock ? <>
                {fmtTime(data.last_unlock.updated_at)} <VerificationBadge verification={data.last_unlock.verification} /> 要求：{fmtState(data.last_unlock.requested_state)}
              </> : '尚無紀錄'],
            ]} />
            <Notice tone="info">
              命令「已接受」或「成功」只代表控制器收到並回應，<strong>不等於門已經打開</strong>。門磁僅在控制器提供時才會回報；「未知」或「不支援」會如實顯示。
            </Notice>
          </Card>
          {can('operator') ? (
            <Card title="遠端開門">
              <button type="button" className="btn btn-danger" disabled={runner.busy} onClick={() => setConfirm(true)}>
                {runner.busy ? '開門命令執行中…' : '開門'}
              </button>
              <span className="small muted"> 前一個開門命令完成前，按鈕會停用；系統不會自動重試。</span>
              <CommandStatus state={runner.state} />
            </Card>
          ) : (
            <Notice>目前角色為檢視者，無法遠端開門。</Notice>
          )}
        </>
      )}
      {confirm && (
        <ConfirmDialog title="確認開門" confirmLabel="確認開門" danger onConfirm={unlock} onCancel={() => setConfirm(false)}>
          <p>即將對 <strong>{DOOR_ID}</strong> 送出開門命令，操作會被記錄。確定要開門嗎？</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
