import { useEffect, useMemo, useState } from 'react';
import { get } from '../api/client';
import type { Camera, RecordingSegment, RecordingsResponse } from '../api/types';
import { MediaErrorLine, PhaseBadge } from '../components/CameraGrid';
import { VideoPane } from '../components/VideoPane';
import { Badge, Card, ErrorBox, Field, Loading, Notice } from '../components/ui';
import type { ApiError } from '../api/client';
import { asApiError } from '../lib/errors';
import { dateToTaipeiIso, fmtDuration, fmtTime, isoToTaipeiLocal, taipeiLocalToDate } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { useMediaSession } from '../lib/useMediaSession';

const DAY = 86_400_000;
const DEFAULT_LEN_MIN = 10;
const DISABLED_TIP = '此設備尚未確認支援';

function Timeline({ from, to, items, selected, onPick }: { from: string; to: string; items: RecordingSegment[]; selected: string | null; onPick: (s: RecordingSegment) => void }) {
  const a = Date.parse(from);
  const b = Date.parse(to);
  const span = Math.max(1, b - a);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="timeline-wrap">
      <div className="timeline" role="img" aria-label="錄影時間軸（空白處為無錄影）">
        {items.map((s) => {
          const l = ((Date.parse(s.start_time) - a) / span) * 100;
          const w = ((Date.parse(s.end_time) - Date.parse(s.start_time)) / span) * 100;
          return (
            <button
              key={s.recording_id}
              type="button"
              className={`tl-seg ${selected === s.recording_id ? 'sel' : ''} ${s.available ? '' : 'na'}`}
              style={{ left: `${Math.max(0, l)}%`, width: `${Math.max(0.4, w)}%` }}
              title={`${fmtTime(s.start_time)} ~ ${fmtTime(s.end_time)}`}
              onClick={() => onPick(s)}
              aria-label={`錄影片段 ${fmtTime(s.start_time)} 到 ${fmtTime(s.end_time)}`}
            />
          );
        })}
      </div>
      <div className="tl-axis">
        {ticks.map((t) => (
          <span key={t} style={{ left: `${t * 100}%` }}>{fmtTime(new Date(a + span * t).toISOString()).slice(5, 16)}</span>
        ))}
      </div>
    </div>
  );
}

export default function Playback() {
  const cams = useLoad((s) => get<{ cameras: Camera[] }>('/v1/cameras', { signal: s }));
  const cameras = cams.data?.cameras ?? [];
  const [cameraId, setCameraId] = useState('');
  const [custom, setCustom] = useState(false);
  const [fromLocal, setFromLocal] = useState('');
  const [toLocal, setToLocal] = useState('');

  const [items, setItems] = useState<RecordingSegment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchErr, setSearchErr] = useState<ApiError | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [seg, setSeg] = useState<RecordingSegment | null>(null);
  const [startLocal, setStartLocal] = useState('');
  const [lenMin, setLenMin] = useState(DEFAULT_LEN_MIN);
  const [jumpLocal, setJumpLocal] = useState('');
  const m = useMediaSession();

  useEffect(() => {
    if (!cameraId && cameras.length) setCameraId(cameras[0].camera_id);
  }, [cameras, cameraId]);

  const cam = cameras.find((c) => c.camera_id === cameraId);

  const resetResults = () => {
    setItems([]);
    setCursor(null);
    setRange(null);
    setSearched(false);
    setSearchErr(null);
    setSeg(null);
  };

  const onCamera = (id: string) => {
    if (m.active) void m.stop();
    setCameraId(id);
    resetResults();
  };

  const queryRange = (): { from: string; to: string } | null => {
    if (!custom) {
      const now = Date.now();
      return { from: dateToTaipeiIso(new Date(now - 14 * DAY)), to: dateToTaipeiIso(new Date(now)) };
    }
    if (!fromLocal || !toLocal) {
      setFormErr('請選擇開始與結束時間');
      return null;
    }
    const a = taipeiLocalToDate(fromLocal);
    const b = taipeiLocalToDate(toLocal);
    if (!(b > a)) {
      setFormErr('結束時間必須晚於開始時間');
      return null;
    }
    if (b.getTime() - a.getTime() > 15 * DAY) {
      setFormErr('單次查詢區間最多 15 天');
      return null;
    }
    return { from: dateToTaipeiIso(a), to: dateToTaipeiIso(b) };
  };

  const fetchPage = async (r: { from: string; to: string }, cur: string | null, append: boolean) => {
    setSearching(true);
    setSearchErr(null);
    try {
      const res = await get<RecordingsResponse>(`/v1/cameras/${cameraId}/recordings`, { query: { from: r.from, to: r.to, cursor: cur } });
      setRange({ from: res.from, to: res.to });
      setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      setCursor(res.next_cursor);
      setSearched(true);
    } catch (e) {
      setSearchErr(asApiError(e));
      if (!append) setSearched(false);
    } finally {
      setSearching(false);
    }
  };

  const search = () => {
    setFormErr(null);
    const r = queryRange();
    if (!r) return;
    resetResults();
    void fetchPage(r, null, false);
  };

  const sorted = useMemo(() => [...items].sort((x, y) => Date.parse(x.start_time) - Date.parse(y.start_time)), [items]);

  const pick = (s: RecordingSegment) => {
    setSeg(s);
    setStartLocal(isoToTaipeiLocal(s.start_time));
    setJumpLocal(isoToTaipeiLocal(s.start_time));
    setLenMin(DEFAULT_LEN_MIN);
    setFormErr(null);
  };

  const createAt = (local: string) => {
    if (!seg) return;
    setFormErr(null);
    const st = taipeiLocalToDate(local);
    const segA = Date.parse(seg.start_time);
    const segB = Date.parse(seg.end_time);
    if (Number.isNaN(st.getTime())) return setFormErr('起始時間格式不正確');
    if (st.getTime() < segA - 59_000 || st.getTime() >= segB) return setFormErr('起始時間必須落在所選錄影片段內');
    const startMs = Math.max(st.getTime(), segA);
    const endMs = Math.min(startMs + Math.max(1, lenMin) * 60_000, segB);
    if (endMs <= startMs) return setFormErr('播放長度必須大於 0');
    void m.start('playback', cameraId, {
      start_time: dateToTaipeiIso(new Date(startMs)),
      end_time: dateToTaipeiIso(new Date(endMs)),
      delivery_target: 'browser',
      ttl_seconds: 900,
      recording_id: seg.recording_id,
    });
  };

  const canSearch = !!cam && (cam.mapping_status !== 'unbound') && cam.search_available;

  return (
    <div className="page">
      <div className="page-head"><h1>歷史回放</h1></div>
      <ErrorBox error={cams.error} onRetry={() => void cams.reload()} />
      {cams.loading && !cams.data && <Loading />}
      {cams.data && (
        <>
          <Notice>
            顯示的是 NVR 實際回傳的錄影片段，空白處就是沒有錄影，不會補假資料。實際可回放的天數取決於 NVR 的保留設定。即時可看不代表歷史可搜尋。
          </Notice>
          <Card title="查詢">
            <div className="form-grid">
              <Field label="攝影機">
                <select value={cameraId} onChange={(e) => onCamera(e.target.value)}>
                  {cameras.map((c) => <option key={c.camera_id} value={c.camera_id}>{c.camera_id} {c.name}{c.mapping_status === 'unbound' ? '（未綁定）' : ''}</option>)}
                </select>
              </Field>
              <Field label="區間">
                <div className="row">
                  <Badge tone="info">{custom ? '自訂區間' : '最近 14 天'}</Badge>
                  <label className="inline"><input type="checkbox" checked={custom} onChange={(e) => {
                    setCustom(e.target.checked);
                    if (e.target.checked && !fromLocal) {
                      setFromLocal(isoToTaipeiLocal(new Date(Date.now() - DAY)));
                      setToLocal(isoToTaipeiLocal(new Date()));
                    }
                  }} /> 自訂（台北時間，最長 15 天）</label>
                </div>
              </Field>
              {custom && (
                <>
                  <Field label="開始（Asia/Taipei）"><input type="datetime-local" value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} /></Field>
                  <Field label="結束（Asia/Taipei）"><input type="datetime-local" value={toLocal} onChange={(e) => setToLocal(e.target.value)} /></Field>
                </>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn-primary" disabled={!canSearch || searching} onClick={search}>{searching ? '查詢中…' : '查詢錄影'}</button>
              </div>
            </div>
            {cam && !canSearch && (
              <div className="small text-warn">
                {cam.mapping_status === 'unbound' ? '未綁定 NVR 通道，無法查詢錄影。' : '此攝影機尚未啟用「歷史搜尋」能力（需在映射中分別確認）。'}
              </div>
            )}
            {formErr && <Notice tone="bad">{formErr}</Notice>}
            <ErrorBox error={searchErr} />
          </Card>

          {searched && range && (
            <Card title={`錄影片段（${sorted.length}${cursor ? '+' : ''}）`}>
              {sorted.length === 0 ? (
                <div className="empty">此區間查無錄影</div>
              ) : (
                <>
                  <Timeline from={range.from} to={range.to} items={sorted} selected={seg?.recording_id ?? null} onPick={pick} />
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>開始</th><th>結束</th><th>長度</th><th>狀態</th><th /></tr></thead>
                      <tbody>
                        {sorted.map((s) => (
                          <tr key={s.recording_id} className={seg?.recording_id === s.recording_id ? 'row-sel' : ''}>
                            <td>{fmtTime(s.start_time)}</td>
                            <td>{fmtTime(s.end_time)}</td>
                            <td>{fmtDuration(Date.parse(s.end_time) - Date.parse(s.start_time))}</td>
                            <td>{s.available ? <Badge tone="ok">可用</Badge> : <Badge tone="warn">不可用</Badge>}</td>
                            <td><button type="button" className="btn btn-sm" onClick={() => pick(s)} disabled={!s.available}>選取</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {cursor && (
                <button type="button" className="btn" disabled={searching} onClick={() => range && void fetchPage(range, cursor, true)}>
                  {searching ? '載入中…' : '載入更多'}
                </button>
              )}
            </Card>
          )}

          {seg && (
            <Card title="播放設定">
              <div className="form-grid">
                <Field label="起始時間（Asia/Taipei）" hint={`片段：${fmtTime(seg.start_time)} ~ ${fmtTime(seg.end_time)}`}>
                  <input type="datetime-local" step={1} value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
                </Field>
                <Field label="播放長度（分鐘）" hint="預設 10 分鐘，不會超過片段結尾">
                  <input type="number" min={1} max={60} value={lenMin} onChange={(e) => setLenMin(Number(e.target.value))} />
                </Field>
                <div className="form-actions">
                  <button type="button" className="btn btn-primary" disabled={m.active} onClick={() => createAt(startLocal)}>開始回放</button>
                </div>
              </div>
            </Card>
          )}

          {(m.phase !== 'idle') && (
            <Card title={<>回放播放器 <PhaseBadge phase={m.phase} connState={m.connState} /></>}
              actions={m.active && <button type="button" className="btn btn-sm" onClick={() => void m.stop()}>停止</button>}>
              <div className="player">
                {m.stream ? <VideoPane stream={m.stream} label="歷史回放" /> : (
                  <div className="cam-placeholder">{m.phase === 'expired' ? '已到期' : m.phase === 'failed' ? '回放失敗' : m.phase === 'stopped' ? '已停止' : '準備中…'}</div>
                )}
              </div>
              {m.error && <MediaErrorLine error={m.error} />}
              {m.session && <div className="small muted">到期時間：{fmtTime(m.session.expires_at)}</div>}
              {m.phase === 'expired' && seg && (
                <button type="button" className="btn btn-primary" onClick={() => createAt(startLocal)}>重新開始</button>
              )}
              <div className="player-controls">
                <button type="button" className="btn btn-sm" disabled title={DISABLED_TIP}>暫停</button>
                <button type="button" className="btn btn-sm" disabled title={DISABLED_TIP}>倍速</button>
                <button type="button" className="btn btn-sm" disabled title={DISABLED_TIP}>拖曳進度</button>
                <span className="small muted">暫停／倍速／拖曳進度：{DISABLED_TIP}</span>
              </div>
              {seg && (
                <div className="row jump">
                  <Field label="跳轉到（Asia/Taipei）">
                    <input type="datetime-local" step={1} value={jumpLocal} onChange={(e) => setJumpLocal(e.target.value)} />
                  </Field>
                  <button type="button" className="btn" onClick={() => createAt(jumpLocal)} disabled={!m.active && m.phase !== 'playing'}>跳轉</button>
                </div>
              )}
              <p className="small muted">「跳轉」會先結束目前的回放工作階段（DELETE），再於新的起始時間重新建立一個新的工作階段，並非串流內拖曳。</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
