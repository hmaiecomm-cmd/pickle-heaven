import { useEffect, useState } from 'react';
import { post } from '../api/client';
import type {
  AddressPreviewResult, CatalogCircuit, CircuitBinding, CommandAccepted, ControllerDef, Deployment, FunctionMenu, TableType, ValidationResult,
} from '../api/types';
import { CommandStatus } from '../components/CommandStatus';
import { MappingChip, NumInput, RowIssues, TextInput, issuesFor, type UpdateFn } from '../components/mappingBits';
import { Badge, ErrorBox, Field, Modal, Notice } from '../components/ui';
import { asApiError } from '../lib/errors';
import { CONTROL_MODE_LABEL, WIRING_LABEL, fmtTime, fmtWatt } from '../lib/format';
import { useCommandRunner } from '../lib/useCommand';
import type { ApiError } from '../api/client';

export function emptyBinding(circuit_id: string): CircuitBinding {
  return {
    circuit_id, wiring_mode: 'unconfirmed', controller_id: null, physical_output_channel: null, modbus: null, soyal: null,
    active_polarity: null, feedback_type: 'none', feedback_source: null, interlock_group: null, mapping_status: 'unbound',
    hardware_verified_at: null, verified_by: null, note: null,
  };
}

const TABLE_LABEL: Record<TableType, string> = {
  coil: 'coil（線圈 0xxxx）',
  discrete_input: 'discrete_input（1xxxx）',
  input_register: 'input_register（3xxxx）',
  holding_register: 'holding_register（4xxxx）',
};

const LOCK_REASON = '常供電／Bypass 或預留迴路不可綁定輸出（軟體永遠不會切換它）。';

interface Preview { offset?: number | null; error?: string; read?: number[]; write?: number[] }

function TestWriteDialog({ circuitId, onClose }: { circuitId: string; onClose: () => void }) {
  const [typed, setTyped] = useState('');
  const runner = useCommandRunner();
  const ok = typed === circuitId;
  const send = (state: 'on' | 'off') =>
    void runner.run((command_id, expires_at) =>
      post<CommandAccepted>(`/v1/mapping/circuits/${circuitId}/test-write`, { command_id, state, confirm_circuit_id: typed, expires_at }));
  return (
    <Modal title={`輸出測試：${circuitId}`} onClose={runner.busy ? () => undefined : onClose} danger>
      <div className="modal-body">
        <div className="alert alert-bad" role="alert">
          <strong>警告：此操作會驅動真實硬體輸出。</strong>請確認現場人員與負載安全（燈具、風扇、熱水器等將實際通斷電）。僅限維護模式下單一迴路測試，所有操作都會被稽核。
        </div>
        <Field label={`請輸入迴路編號「${circuitId}」以確認`}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
        </Field>
        <div className="row">
          <button type="button" className="btn btn-danger" disabled={!ok || runner.busy} onClick={() => send('on')}>測試 ON</button>
          <button type="button" className="btn btn-danger" disabled={!ok || runner.busy} onClick={() => send('off')}>測試 OFF</button>
        </div>
        <CommandStatus state={runner.state} />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose} disabled={runner.busy}>關閉</button>
      </div>
    </Modal>
  );
}

interface RowProps {
  cc: CatalogCircuit;
  dep: Deployment;
  update: UpdateFn;
  validation: ValidationResult | null;
  menu: FunctionMenu | null;
  status: string;
  activeStatus: string | null;
  maintenance: boolean;
}

function CircuitRow({ cc, dep, update, validation, menu, status, activeStatus, maintenance }: RowProps) {
  const locked = cc.control_mode === 'always_on_bypass' || cc.control_mode === 'reserved';
  const b = dep.circuits.find((x) => x.circuit_id === cc.circuit_id) ?? emptyBinding(cc.circuit_id);
  const ctrl: ControllerDef | undefined = dep.controllers.find((c) => c.controller_id === b.controller_id);
  const bus = dep.buses.find((x) => x.bus_id === ctrl?.bus_id);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview>({});
  const [reading, setReading] = useState(false);
  const [readRes, setReadRes] = useState<unknown>(null);
  const [readErr, setReadErr] = useState<ApiError | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const mut = (fn: (x: CircuitBinding) => void) =>
    update((d) => {
      let x = d.circuits.find((y) => y.circuit_id === cc.circuit_id);
      if (!x) {
        x = emptyBinding(cc.circuit_id);
        d.circuits.push(x);
      }
      fn(x);
    });

  const mb = b.modbus;
  const tt = mb?.table_type ?? null;
  const ref = mb?.reference_address ?? '';
  const base = mb?.base ?? 1;
  useEffect(() => {
    if (!tt || !ref) {
      setPreview({});
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await post<AddressPreviewResult>('/v1/mapping/address-preview', { table_type: tt, reference_address: ref, base }, { signal: ac.signal });
        setPreview({ offset: r.pdu_offset, read: r.read_functions, write: r.write_functions });
      } catch (e) {
        if (ac.signal.aborted) return;
        setPreview({ error: asApiError(e).message });
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [tt, ref, base]);

  const setModbus = (fn: (m: NonNullable<CircuitBinding['modbus']>) => void) =>
    mut((x) => {
      const m = x.modbus ?? { table_type: null, reference_address: null, base: 1, read_function: null, write_function: null };
      fn(m);
      const empty = !m.table_type && !m.reference_address && m.read_function === null && m.write_function === null && m.base === 1;
      x.modbus = empty ? null : m;
    });
  const setSoyal = (fn: (m: NonNullable<CircuitBinding['soyal']>) => void) =>
    mut((x) => {
      const m = x.soyal ?? { command: null, selector: null };
      fn(m);
      x.soyal = !m.command && !m.selector ? null : m;
    });

  const bound = !!b.controller_id;
  const canRead = !locked && bound && activeStatus === 'active';
  const canTest = canRead && maintenance;
  const testTip = locked ? LOCK_REASON : !bound ? '尚未綁定' : activeStatus !== 'active' ? '需先套用且狀態為 active' : !maintenance ? '伺服器未開啟維護模式 (maintenance_mode)' : '';

  const readState = async () => {
    setReading(true);
    setReadErr(null);
    setReadRes(null);
    try {
      setReadRes(await post(`/v1/mapping/circuits/${cc.circuit_id}/read-state`, {}));
    } catch (e) {
      setReadErr(asApiError(e));
    } finally {
      setReading(false);
    }
  };

  const issues = issuesFor(validation, 'circuits', cc.circuit_id);
  const readFns = preview.read ?? menu?.menu.map((m) => m.code) ?? [];
  const writeFns = preview.write ?? menu?.menu.map((m) => m.code) ?? [];
  const nameOf = (code: number) => menu?.menu.find((m) => m.code === code)?.name ?? '';
  const protocol = ctrl?.protocol ?? 'unspecified';

  const addrSummary = locked ? '—'
    : protocol === 'soyal_721_727' ? (b.soyal ? `${b.soyal.command ?? '?'} / ${b.soyal.selector ?? '?'}` : '—')
      : mb?.reference_address ? `${mb.reference_address} → PDU ${preview.error ? '?' : (preview.offset ?? '…')}` : '—';

  return (
    <>
      <tr className={locked ? 'row-locked' : ''}>
        <td className="nowrap"><strong>{String(cc.number).padStart(2, '0')}</strong><div className="small muted">{cc.circuit_id}</div></td>
        <td>{cc.name}<div className="small muted">{cc.zone ?? '—'}</div></td>
        <td><Badge tone={locked ? 'warn' : 'info'} title={cc.policy_note ?? undefined}>{CONTROL_MODE_LABEL[cc.control_mode]}</Badge></td>
        <td>
          {fmtWatt(cc.load_w)}
          <div className="small muted">{cc.power_confirmed ? '已確認' : '規劃值，未實測確認'}</div>
        </td>
        <td>
          {locked ? <span title={LOCK_REASON}>{WIRING_LABEL[b.wiring_mode] ?? b.wiring_mode} 🔒</span> : (
            <select aria-label={`${cc.circuit_id} wiring_mode`} value={b.wiring_mode} onChange={(e) => mut((x) => (x.wiring_mode = e.target.value as CircuitBinding['wiring_mode']))}>
              <option value="unconfirmed">未確認</option>
              <option value="relay_switched">繼電器切換 (relay_switched)</option>
            </select>
          )}
        </td>
        <td>
          {locked ? <span className="muted">不可綁定</span> : (
            <>
              <select aria-label={`${cc.circuit_id} controller`} value={b.controller_id ?? ''} onChange={(e) => mut((x) => {
                x.controller_id = e.target.value || null;
                if (x.controller_id && x.wiring_mode === 'unconfirmed') x.wiring_mode = 'relay_switched';
              })}>
                <option value="">（未綁定）</option>
                {dep.controllers.map((c) => <option key={c.controller_id} value={c.controller_id}>{c.controller_id}</option>)}
              </select>
              {ctrl && <div className="small muted">bus: {ctrl.bus_id ?? '—'}{bus ? `（${bus.protocol_profile}）` : ''}　node/slave: {ctrl.node_id ?? '—'}</div>}
            </>
          )}
        </td>
        <td>{locked ? '—' : <NumInput label={`${cc.circuit_id} channel`} value={b.physical_output_channel} min={1} width={64} onChange={(v) => mut((x) => (x.physical_output_channel = v))} />}</td>
        <td className="small mono">{addrSummary}</td>
        <td><MappingChip status={status} /></td>
        <td>
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? '收合' : '詳細'}</button>
            <button type="button" className="btn btn-sm" disabled={!canRead || reading} title={locked ? LOCK_REASON : !canRead ? '需先套用且狀態為 active 才能讀取狀態' : '唯讀：不寫入輸出'} onClick={() => void readState()}>
              {reading ? '讀取中…' : '讀取狀態'}
            </button>
            {!locked && (
              <button type="button" className="btn btn-sm btn-danger" disabled={!canTest} title={testTip} onClick={() => setTestOpen(true)}>測試 ON/OFF</button>
            )}
          </div>
        </td>
      </tr>
      {(open || issues.some((i) => i.level !== 'pending') || readRes !== null || readErr) && (
        <tr className="row-detail">
          <td colSpan={10}>
            {locked && <Notice tone="warn">{LOCK_REASON}{cc.policy_note ? ` ${cc.policy_note}` : ''}</Notice>}
            {cc.issue && <div className="small text-warn">⚠ {cc.issue}</div>}
            <RowIssues issues={issues} />
            {readErr && <ErrorBox error={readErr} />}
            {readRes !== null && <pre className="pre">讀取結果（唯讀，未寫入）：{JSON.stringify(readRes, null, 2)}</pre>}
            {open && !locked && (
              <div className="detail-grid">
                {protocol === 'soyal_721_727' ? (
                  <>
                    <Field label="SOYAL command" hint="例：0x21（依文件）"><TextInput mono label="soyal command" value={b.soyal?.command} onChange={(v) => setSoyal((m) => (m.command = v))} /></Field>
                    <Field label="SOYAL selector" hint="文件定義的輸出選擇碼"><TextInput mono label="soyal selector" value={b.soyal?.selector} onChange={(v) => setSoyal((m) => (m.selector = v))} /></Field>
                  </>
                ) : protocol === 'modbus_m7000' ? (
                  <>
                    <Field label="table_type">
                      <select value={tt ?? ''} onChange={(e) => setModbus((m) => (m.table_type = (e.target.value || null) as TableType | null))}>
                        <option value="">（未選）</option>
                        {(Object.keys(TABLE_LABEL) as TableType[]).map((t) => <option key={t} value={t}>{TABLE_LABEL[t]}</option>)}
                      </select>
                    </Field>
                    <Field label="reference_address（文件位址字串）" hint="例：00001（Base 1）、40485">
                      <TextInput mono label="reference_address" value={mb?.reference_address} onChange={(v) => setModbus((m) => (m.reference_address = v))} />
                    </Field>
                    <Field label="Base">
                      <select value={base} onChange={(e) => setModbus((m) => (m.base = Number(e.target.value)))}>
                        <option value={1}>1（文件位址從 1 起算）</option>
                        <option value={0}>0</option>
                      </select>
                    </Field>
                    <Field label="PDU offset（唯讀，由伺服器計算）">
                      <output className="mono pdu" aria-live="polite">
                        {preview.error ? <span className="text-bad">{preview.error}</span> : preview.offset !== undefined && preview.offset !== null ? `${mb?.reference_address} → ${preview.offset}` : '—'}
                      </output>
                    </Field>
                    <Field label="read_function">
                      <select value={mb?.read_function ?? ''} onChange={(e) => setModbus((m) => (m.read_function = e.target.value === '' ? null : Number(e.target.value)))}>
                        <option value="">（無）</option>
                        {readFns.map((f) => <option key={f} value={f}>{f} {nameOf(f)}</option>)}
                      </select>
                    </Field>
                    <Field label="write_function">
                      <select value={mb?.write_function ?? ''} onChange={(e) => setModbus((m) => (m.write_function = e.target.value === '' ? null : Number(e.target.value)))}>
                        <option value="">（無）</option>
                        {writeFns.map((f) => <option key={f} value={f}>{f} {nameOf(f)}</option>)}
                      </select>
                    </Field>
                  </>
                ) : (
                  <div className="small muted">請先在「控制器」分頁為此控制器選定協定（modbus_m7000 或 soyal_721_727），才會顯示對應的位址欄位。</div>
                )}
                <Field label="active_polarity">
                  <select value={b.active_polarity ?? ''} onChange={(e) => mut((x) => (x.active_polarity = (e.target.value || null) as 'high' | 'low' | null))}>
                    <option value="">（未設定）</option>
                    <option value="high">high</option>
                    <option value="low">low</option>
                  </select>
                </Field>
                <Field label="feedback_type">
                  <select value={b.feedback_type} onChange={(e) => mut((x) => (x.feedback_type = e.target.value as CircuitBinding['feedback_type']))}>
                    <option value="none">none（無回授）</option>
                    <option value="do_readback">do_readback</option>
                    <option value="auxiliary_contact">auxiliary_contact</option>
                    <option value="current_sensor">current_sensor</option>
                    <option value="other">other</option>
                  </select>
                </Field>
                <Field label="feedback_source"><TextInput label="feedback_source" value={b.feedback_source} onChange={(v) => mut((x) => (x.feedback_source = v))} /></Field>
                <Field label="interlock_group"><TextInput label="interlock_group" value={b.interlock_group} onChange={(v) => mut((x) => (x.interlock_group = v))} /></Field>
                <Field label="備註"><TextInput label="note" value={b.note} onChange={(v) => mut((x) => (x.note = v))} /></Field>
                <Field label="hardware_verified_at（唯讀）">
                  <output>{b.hardware_verified_at ? fmtTime(b.hardware_verified_at) : '未實測'}</output>
                </Field>
                <Field label="verified_by（唯讀）"><output>{b.verified_by ?? '未實測'}</output></Field>
              </div>
            )}
          </td>
        </tr>
      )}
      {testOpen && <TestWriteDialog circuitId={cc.circuit_id} onClose={() => setTestOpen(false)} />}
    </>
  );
}

export default function CircuitBindings({ dep, catalog, update, validation, menu, statusOf, activeStatusOf, maintenance }: {
  dep: Deployment;
  catalog: CatalogCircuit[];
  update: UpdateFn;
  validation: ValidationResult | null;
  menu: FunctionMenu | null;
  statusOf: (id: string) => string;
  activeStatusOf: (id: string) => string | null;
  maintenance: boolean;
}) {
  return (
    <div>
      <Notice>
        預設全部 18 路皆為「未綁定」。常供電／Bypass（12–16）與預留（17–18）迴路唯讀，不可綁定輸出。
        {menu && <> 「讀取狀態」只做唯讀讀取；「測試 ON/OFF」會驅動真實硬體，僅在伺服器維護模式、迴路 active 時開放。</>}
        {!maintenance && <> 目前伺服器<strong>未開啟維護模式</strong>，測試按鈕停用。</>}
      </Notice>
      <div className="table-wrap">
        <table className="table table-circuits">
          <thead>
            <tr>
              <th>編號</th><th>名稱／區域</th><th>控制模式</th><th>規劃功率</th><th>接線模式</th><th>控制器／bus／node</th><th>輸出通道</th><th>位址</th><th>映射狀態</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((cc) => (
              <CircuitRow key={cc.circuit_id} cc={cc} dep={dep} update={update} validation={validation} menu={menu}
                status={statusOf(cc.circuit_id)} activeStatus={activeStatusOf(cc.circuit_id)} maintenance={maintenance} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
