import type { CameraBinding, CatalogCamera, Deployment, Issue, NvrDef } from '../api/types';
import { LabeledCheck, MappingChip, RowIssues, TextInput, TriSelect, issuesFor, type UpdateFn } from '../components/mappingBits';
import { Card, Field, Notice } from '../components/ui';
import { fmtTime } from '../lib/format';
import type { ValidationResult } from '../api/types';

export function emptyCameraBinding(camera_id: string): CameraBinding {
  return {
    camera_id, nvr_id: null, nvr_channel: null, isapi_track_id: null, sdk_channel_id: null,
    rtsp_stream_ids: { main: null, sub: null }, codec: null, audio_capability: null,
    live_capable: false, search_capable: false, playback_capable: false,
    live_verified_at: null, history_verified_at: null, duplicate_intent_confirmed: false,
    mapping_status: 'unbound', hardware_verified_at: null, note: null,
  };
}

interface Props {
  dep: Deployment;
  catalog: CatalogCamera[];
  update: UpdateFn;
  validation: ValidationResult | null;
  /** status as it should be displayed (normalized after a fresh validation) */
  statusOf: (cameraId: string) => string;
  configRevision: number;
}

function NvrEditor({ nvr, update, idx, issues }: { nvr: NvrDef; idx: number; update: UpdateFn; issues: Issue[] }) {
  const set = (fn: (n: NvrDef) => void) => update((d) => fn(d.nvrs[idx]));
  return (
    <div className="mini-card">
      <div className="form-grid">
        <Field label="nvr_id">
          <input
            value={nvr.nvr_id}
            spellCheck={false}
            onChange={(e) => {
              const old = nvr.nvr_id;
              const v = e.target.value;
              update((d) => {
                d.nvrs[idx].nvr_id = v;
                for (const c of d.cameras) if (c.nvr_id === old) c.nvr_id = v;
              });
            }}
          />
        </Field>
        <Field label="廠牌"><TextInput label="vendor" value={nvr.vendor} onChange={(v) => set((n) => (n.vendor = v ?? ''))} /></Field>
        <Field label="型號"><TextInput label="model" value={nvr.model} onChange={(v) => set((n) => (n.model = v))} /></Field>
        <Field label="韌體"><TextInput label="firmware" value={nvr.firmware} onChange={(v) => set((n) => (n.firmware = v))} /></Field>
        <Field label="時區"><TextInput label="timezone" value={nvr.timezone} onChange={(v) => set((n) => (n.timezone = v ?? 'Asia/Taipei'))} /></Field>
        <Field label="驅動">
          <select value={nvr.driver} onChange={(e) => set((n) => (n.driver = e.target.value as 'mock' | 'real'))}>
            <option value="mock">mock（模擬）</option>
            <option value="real">real</option>
          </select>
        </Field>
        <Field label="備註"><TextInput label="note" value={nvr.note} onChange={(v) => set((n) => (n.note = v))} /></Field>
        <div className="form-actions">
          <button type="button" className="btn btn-sm" onClick={() => update((d) => { d.nvrs.splice(idx, 1); })}>移除此 NVR</button>
        </div>
      </div>
      <RowIssues issues={issues} />
    </div>
  );
}

export default function CameraMapping({ dep, catalog, update, validation, statusOf, configRevision }: Props) {
  return (
    <div>
      <Notice tone="warn">
        套用映射<strong>不會啟動任何串流</strong>；若受影響的攝影機仍有即時／回放工作階段，套用會被拒絕（mapping_active_sessions），請先停止。
        頻道、軌道與 RTSP 識別碼必須依 NVR 實際設定逐一填寫，<strong>系統不會自動帶入</strong>（例如不會把 camera-01 當成通道 1，也不套用 101/102 之類的規則）。
        「即時可看」不代表「歷史可搜尋」，兩者分別驗證。
      </Notice>

      <Card
        title="NVR 設備"
        actions={<button type="button" className="btn btn-sm" onClick={() => update((d) => { d.nvrs.push({ nvr_id: `nvr-${d.nvrs.length + 1}`, vendor: 'hikvision', model: null, firmware: null, timezone: 'Asia/Taipei', driver: 'mock', note: null }); })}>新增 NVR</button>}
      >
        {dep.nvrs.length === 0 && <div className="empty">尚未定義 NVR。攝影機綁定前請先新增。</div>}
        {dep.nvrs.map((n, i) => <NvrEditor key={i} nvr={n} idx={i} update={update} issues={issuesFor(validation, 'nvrs', n.nvr_id)} />)}
      </Card>

      <div className="cam-map-grid">
        {catalog.map((cc) => {
          const idx = dep.cameras.findIndex((c) => c.camera_id === cc.camera_id);
          const b = idx >= 0 ? dep.cameras[idx] : emptyCameraBinding(cc.camera_id);
          const issues = issuesFor(validation, 'cameras', cc.camera_id);
          const dup = issues.some((i) => i.code === 'duplicate_channel');
          const mut = (fn: (c: CameraBinding) => void) =>
            update((d) => {
              let c = d.cameras.find((x) => x.camera_id === cc.camera_id);
              if (!c) {
                c = emptyCameraBinding(cc.camera_id);
                d.cameras.push(c);
              }
              fn(c);
            });
          const status = statusOf(cc.camera_id);
          return (
            <Card key={cc.camera_id} className="cam-map" title={<>{cc.camera_id} · #{cc.number} {cc.name} <MappingChip status={status} /></>}>
              <div className="small muted">位置：{cc.location}　監看範圍：{cc.scope}　設定版本：rev {configRevision}</div>
              <div className="form-grid">
                <Field label="nvr_id">
                  <select value={b.nvr_id ?? ''} onChange={(e) => mut((c) => (c.nvr_id = e.target.value || null))}>
                    <option value="">（未綁定）</option>
                    {dep.nvrs.map((n) => <option key={n.nvr_id} value={n.nvr_id}>{n.nvr_id}</option>)}
                  </select>
                </Field>
                <Field label="NVR 通道 (nvr_channel)"><TextInput label="nvr_channel" value={b.nvr_channel} onChange={(v) => mut((c) => (c.nvr_channel = v))} /></Field>
                <Field label="ISAPI track id"><TextInput label="isapi_track_id" value={b.isapi_track_id} onChange={(v) => mut((c) => (c.isapi_track_id = v))} /></Field>
                <Field label="SDK channel id"><TextInput label="sdk_channel_id" value={b.sdk_channel_id} onChange={(v) => mut((c) => (c.sdk_channel_id = v))} /></Field>
                <Field label="RTSP stream id（主碼流 main）"><TextInput label="rtsp main" value={b.rtsp_stream_ids?.main} onChange={(v) => mut((c) => (c.rtsp_stream_ids = { ...(c.rtsp_stream_ids ?? {}), main: v }))} /></Field>
                <Field label="RTSP stream id（子碼流 sub）"><TextInput label="rtsp sub" value={b.rtsp_stream_ids?.sub} onChange={(v) => mut((c) => (c.rtsp_stream_ids = { ...(c.rtsp_stream_ids ?? {}), sub: v }))} /></Field>
                <Field label="編碼 (codec)"><TextInput label="codec" value={b.codec} onChange={(v) => mut((c) => (c.codec = v))} /></Field>
                <Field label="音訊能力"><TriSelect label="audio_capability" value={b.audio_capability} onChange={(v) => mut((c) => (c.audio_capability = v))} /></Field>
              </div>
              <div className="row caps">
                <LabeledCheck checked={b.live_capable} onChange={(v) => mut((c) => (c.live_capable = v))}>可即時 (live_capable)</LabeledCheck>
                <LabeledCheck checked={b.search_capable} onChange={(v) => mut((c) => (c.search_capable = v))}>可搜尋 (search_capable)</LabeledCheck>
                <LabeledCheck checked={b.playback_capable} onChange={(v) => mut((c) => (c.playback_capable = v))}>可回放 (playback_capable)</LabeledCheck>
              </div>
              <div className="small">
                <div>即時驗證時間：{b.live_verified_at ? fmtTime(b.live_verified_at) : <span className="muted">未實測</span>}</div>
                <div>歷史驗證時間：{b.history_verified_at ? fmtTime(b.history_verified_at) : <span className="muted">未實測</span>}</div>
                <div className="muted">即時可看不代表歷史可搜尋，兩者分開驗證；驗證時間由系統於實測後寫入，此處唯讀。</div>
              </div>
              {(dup || b.duplicate_intent_confirmed) && (
                <Notice tone="warn">
                  <LabeledCheck checked={b.duplicate_intent_confirmed} onChange={(v) => mut((c) => (c.duplicate_intent_confirmed = v))}>
                    我確認此通道與其他攝影機重複綁定是刻意的 (duplicate_intent_confirmed)
                  </LabeledCheck>
                </Notice>
              )}
              <Field label="備註"><TextInput label="note" value={b.note} onChange={(v) => mut((c) => (c.note = v))} /></Field>
              <RowIssues issues={issues} />
              {idx < 0 && <div className="small text-warn">草稿中缺少此攝影機的資料列，儲存時會新增。</div>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
