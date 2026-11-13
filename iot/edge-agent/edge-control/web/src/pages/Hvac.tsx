import { useEffect, useState, type FormEvent } from 'react';
import { get, patch } from '../api/client';
import type { CommandAccepted, HvacStateResponse } from '../api/types';
import { useAuth } from '../auth';
import { CommandStatus, SimulatedBadge, VerificationBadge } from '../components/CommandStatus';
import { Card, ErrorBox, Field, KV, Loading, Notice } from '../components/ui';
import { HVAC_MODE_LABEL, fmtState, fmtTime } from '../lib/format';
import { useCommandRunner } from '../lib/useCommand';
import { useLoad } from '../lib/useLoad';

const DEVICE_ID = 'hvac-1';

type Tri = 'keep' | 'on' | 'off';

export default function Hvac() {
  const { can } = useAuth();
  const canControl = can('operator');
  const { data, error, loading, reload } = useLoad((s) => get<HvacStateResponse>(`/v1/hvac/${DEVICE_ID}/state`, { signal: s }));
  const [live, setLive] = useState<Record<string, unknown> | null>(null);
  const [power, setPower] = useState<Tri>('keep');
  const [setpoint, setSetpoint] = useState('');
  const [mode, setMode] = useState('');
  const [fan, setFan] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const runner = useCommandRunner();

  const caps = data?.capabilities;
  const modes = caps?.modes ?? [];
  const fans = caps?.fan ?? [];
  const sp = caps?.setpoint;

  useEffect(() => {
    // prefill from the last REPORTED state only (never from what we requested)
    const r = data?.state?.reported_state as Record<string, unknown> | null | undefined;
    if (r && typeof r === 'object' && setpoint === '' && r.setpoint_c !== undefined && r.setpoint_c !== null) setSetpoint(String(r.setpoint_c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const refreshLive = async () => {
    const r = await get<HvacStateResponse>(`/v1/hvac/${DEVICE_ID}/state`, { query: { refresh: true } });
    setLive(r.live_read);
    await reload(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormErr(null);
    const body: Record<string, unknown> = {};
    if (power !== 'keep') body.power = power === 'on';
    if (setpoint !== '') {
      const v = Number(setpoint);
      if (!Number.isFinite(v)) return setFormErr('設定溫度必須是數字');
      if (sp) {
        if (v < sp.min || v > sp.max) return setFormErr(`設定溫度需介於 ${sp.min} ~ ${sp.max} °C`);
        const steps = (v - sp.min) / sp.step;
        if (Math.abs(steps - Math.round(steps)) > 1e-6) return setFormErr(`設定溫度需以 ${sp.step} °C 為間隔`);
      }
      body.setpoint_c = v;
    }
    if (mode) body.mode = mode;
    if (fan && fans.length) body.fan = fan;
    if (Object.keys(body).length === 0) return setFormErr('請至少選擇一項要變更的設定');
    void runner.run(
      (command_id, expires_at) => patch<CommandAccepted>(`/v1/hvac/${DEVICE_ID}/settings`, { command_id, expires_at, ...body }),
      () => void reload(true),
    );
  };

  const reported = data?.state?.reported_state as Record<string, unknown> | null | undefined;

  return (
    <div className="page">
      <div className="page-head">
        <h1>冷氣</h1>
        <button type="button" className="btn" onClick={() => void reload()}>重新整理</button>
      </div>
      <ErrorBox error={error} onRetry={() => void reload()} />
      {loading && !data && <Loading />}
      {data && (
        <>
          <Card title={<>{data.name ?? data.device_id} {data.simulated && <SimulatedBadge />}</>}
            actions={<button type="button" className="btn btn-sm" onClick={() => void refreshLive().catch(() => undefined)}>即時讀取</button>}>
            <KV rows={[
              ['最後狀態更新', fmtTime(data.state?.updated_at)],
              ['驗證', data.state ? <VerificationBadge verification={data.state.verification} /> : '尚無狀態'],
              ['要求的設定', fmtState(data.state?.requested_state)],
              ['最後回報', reported && typeof reported === 'object' ? (
                <>
                  電源 {fmtState(reported.power)}／設定 {fmtState(reported.setpoint_c)} °C／模式 {HVAC_MODE_LABEL[String(reported.mode)] ?? fmtState(reported.mode)}
                  {reported.fan ? `／風速 ${String(reported.fan)}` : ''}／室溫 {fmtState(reported.room_temp_c)} °C
                </>
              ) : fmtState(data.state?.reported_state)],
            ]} />
            {live && <pre className="pre">即時讀取結果：{JSON.stringify(live, null, 2)}</pre>}
            <p className="small muted">「未驗證」代表命令已送出但沒有獨立回讀依據；通訊成功不等於冷氣實際動作已確認。</p>
          </Card>

          {canControl ? (
            <Card title="變更設定">
              <form onSubmit={submit} className="form-grid">
                <Field label="電源">
                  <select value={power} onChange={(e) => setPower(e.target.value as Tri)}>
                    <option value="keep">不變更</option>
                    <option value="on">開</option>
                    <option value="off">關</option>
                  </select>
                </Field>
                {sp && (
                  <Field label={`設定溫度 (°C)`} hint={`範圍 ${sp.min}–${sp.max}，間隔 ${sp.step}`}>
                    <input type="number" inputMode="decimal" min={sp.min} max={sp.max} step={sp.step} value={setpoint} onChange={(e) => setSetpoint(e.target.value)} />
                  </Field>
                )}
                <Field label="模式">
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="">不變更</option>
                    {modes.map((m) => <option key={m} value={m}>{HVAC_MODE_LABEL[m] ?? m}</option>)}
                  </select>
                </Field>
                {fans.length > 0 && (
                  <Field label="風速">
                    <select value={fan} onChange={(e) => setFan(e.target.value)}>
                      <option value="">不變更</option>
                      {fans.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>
                )}
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={runner.busy}>{runner.busy ? '執行中…' : '送出'}</button>
                </div>
              </form>
              {formErr && <Notice tone="bad">{formErr}</Notice>}
              <CommandStatus state={runner.state} />
              <p className="small muted">命令為非同步執行：畫面只顯示伺服器回報的結果，不會先假設已成功。</p>
            </Card>
          ) : (
            <Notice>目前角色為檢視者，只能檢視冷氣狀態。</Notice>
          )}
        </>
      )}
    </div>
  );
}
