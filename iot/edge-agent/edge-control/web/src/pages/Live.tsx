import { get } from '../api/client';
import type { Camera } from '../api/types';
import { CameraGrid } from '../components/CameraGrid';
import { BoolBadge, Badge, ErrorBox, Loading, Notice } from '../components/ui';
import { MAPPING_STATUS_LABEL } from '../lib/format';
import { useLoad } from '../lib/useLoad';

export default function Live() {
  const { data, error, loading, reload } = useLoad((s) => get<{ cameras: Camera[] }>('/v1/cameras', { signal: s }));
  return (
    <div className="page">
      <div className="page-head">
        <h1>即時影像</h1>
        <button type="button" className="btn" onClick={() => void reload()}>重新整理清單</button>
      </div>
      <ErrorBox error={error} onRetry={() => void reload()} />
      {loading && !data && <Loading />}
      {data && (
        <>
          <Notice>
            固定六台攝影機，預設使用子碼流。離開本頁、停止或工作階段到期時會釋放伺服器資源；伺服器有同時串流上限（超過會顯示 resource_limit / session_limit_per_actor）。
          </Notice>
          <CameraGrid cameras={data.cameras} />
          <h2 className="h2">攝影機清單</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>編號</th><th>名稱</th><th>位置</th><th>監看範圍</th><th>映射狀態</th><th>即時可用</th></tr></thead>
              <tbody>
                {data.cameras.map((c) => (
                  <tr key={c.camera_id}>
                    <td>{c.camera_id}</td>
                    <td>{c.name}</td>
                    <td>{c.location}</td>
                    <td>{c.scope}</td>
                    <td><Badge tone={c.mapping_status === 'active' ? 'ok' : 'mute'}>{MAPPING_STATUS_LABEL[c.mapping_status] ?? c.mapping_status}</Badge></td>
                    <td>{c.mapping_status === 'unbound' ? <span className="muted">未綁定 NVR 通道</span> : <BoolBadge value={c.live_available} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
