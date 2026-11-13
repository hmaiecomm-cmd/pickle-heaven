import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ApiError } from '../api/client';
import { del, get, post, put } from '../api/client';
import type {
  BusDef, ControllerDef, Deployment, DraftDiff, DraftResponse, FunctionMenu, MappingActive, MappingVersion, ValidationResult,
} from '../api/types';
import { LabeledCheck, MappingChip, NumInput, RowIssues, TextInput, issuesFor, type UpdateFn } from '../components/mappingBits';
import { Badge, Card, ConfirmDialog, ErrorBox, Field, Loading, Notice, Tabs } from '../components/ui';
import { asApiError } from '../lib/errors';
import { fmtTime } from '../lib/format';
import CameraMapping from './CameraMapping';
import CircuitBindings from './CircuitBindings';
import MappingHistory, { DiffView } from './MappingHistory';

type TabId = 'buses' | 'controllers' | 'circuits' | 'cameras' | 'history';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function BusesTab({ dep, update, validation }: { dep: Deployment; update: UpdateFn; validation: ValidationResult | null }) {
  const protoByBus = (id: string) => [...new Set(dep.controllers.filter((c) => c.bus_id === id && c.protocol !== 'unspecified').map((c) => c.protocol))];
  return (
    <div>
      <Notice tone="warn">
        一條匯流排只能使用<strong>一種協定</strong>：SOYAL（soyal_binary）與 Modbus（modbus_rtu）<strong>不可共用同一條 RS-485 匯流排</strong>。
        序列埠請填穩定路徑（/dev/serial/by-id/… 或 by-path），避免重開機後 ttyUSB 編號改變。
      </Notice>
      {dep.buses.length === 0 && <div className="empty">尚未定義匯流排。</div>}
      {dep.buses.map((b, i) => {
        const protos = protoByBus(b.bus_id);
        const mixed = protos.length > 1;
        const mut = (fn: (x: BusDef) => void) => update((d) => fn(d.buses[i]));
        const issues = issuesFor(validation, 'buses', b.bus_id);
        return (
          <Card key={i} title={<>{b.bus_id} <Badge>{b.protocol_profile}</Badge></>}
            actions={<button type="button" className="btn btn-sm" onClick={() => update((d) => { d.buses.splice(i, 1); })}>移除</button>}>
            <div className="form-grid">
              <Field label="bus_id">
                <input value={b.bus_id} spellCheck={false} onChange={(e) => {
                  const old = b.bus_id;
                  const v = e.target.value;
                  update((d) => {
                    d.buses[i].bus_id = v;
                    for (const c of d.controllers) if (c.bus_id === old) c.bus_id = v;
                  });
                }} />
              </Field>
              <Field label="serial_path（穩定路徑）"><TextInput mono label="serial_path" value={b.serial_path} placeholder="/dev/serial/by-id/usb-…" onChange={(v) => mut((x) => (x.serial_path = v))} /></Field>
              <Field label="baudrate"><NumInput label="baudrate" value={b.baudrate} min={1} onChange={(v) => mut((x) => (x.baudrate = v))} /></Field>
              <Field label="parity">
                <select value={b.parity ?? ''} onChange={(e) => mut((x) => (x.parity = (e.target.value || null) as BusDef['parity']))}>
                  <option value="">（未設定）</option><option value="N">N（無）</option><option value="E">E（偶）</option><option value="O">O（奇）</option>
                </select>
              </Field>
              <Field label="data_bits"><NumInput label="data_bits" value={b.data_bits} min={5} max={8} onChange={(v) => mut((x) => (x.data_bits = v))} /></Field>
              <Field label="stop_bits">
                <select value={b.stop_bits ?? ''} onChange={(e) => mut((x) => (x.stop_bits = e.target.value === '' ? null : Number(e.target.value)))}>
                  <option value="">（未設定）</option><option value="1">1</option><option value="1.5">1.5</option><option value="2">2</option>
                </select>
              </Field>
              <Field label="timeout_s"><NumInput label="timeout_s" value={b.timeout_s} min={0} step={0.1} onChange={(v) => mut((x) => (x.timeout_s = v))} /></Field>
              <Field label="protocol_profile">
                <select value={b.protocol_profile} onChange={(e) => mut((x) => (x.protocol_profile = e.target.value as BusDef['protocol_profile']))}>
                  <option value="unspecified">unspecified（未指定）</option>
                  <option value="modbus_rtu">modbus_rtu</option>
                  <option value="soyal_binary">soyal_binary</option>
                </select>
              </Field>
              <Field label="備註"><TextInput label="note" value={b.note} onChange={(v) => mut((x) => (x.note = v))} /></Field>
            </div>
            {mixed && <Notice tone="bad">此匯流排上的控制器混用多種協定（{protos.join('、')}）：SOYAL 與 Modbus 不可共用同一條匯流排。</Notice>}
            <RowIssues issues={issues} />
          </Card>
        );
      })}
      <button type="button" className="btn" onClick={() => update((d) => {
        d.buses.push({ bus_id: `bus-${d.buses.length + 1}`, serial_path: null, baudrate: null, parity: null, data_bits: null, stop_bits: null, timeout_s: 1.0, protocol_profile: 'unspecified', note: null });
      })}>新增匯流排</button>
    </div>
  );
}

function ControllersTab({ dep, update, validation, menu }: { dep: Deployment; update: UpdateFn; validation: ValidationResult | null; menu: FunctionMenu | null }) {
  return (
    <div>
      {dep.controllers.length === 0 && <div className="empty">尚未定義控制器。</div>}
      {dep.controllers.map((c, i) => {
        const mut = (fn: (x: ControllerDef) => void) => update((d) => fn(d.controllers[i]));
        const issues = issuesFor(validation, 'controllers', c.controller_id);
        const bus = dep.buses.find((b) => b.bus_id === c.bus_id);
        return (
          <Card key={i} title={<>{c.controller_id} {c.simulation_only && <Badge tone="sim">模擬用</Badge>} {!c.model_confirmed && <Badge tone="warn">型號未確認</Badge>}</>}
            actions={<button type="button" className="btn btn-sm" onClick={() => update((d) => { d.controllers.splice(i, 1); })}>移除</button>}>
            <div className="form-grid">
              <Field label="controller_id">
                <input value={c.controller_id} spellCheck={false} onChange={(e) => {
                  const old = c.controller_id;
                  const v = e.target.value;
                  update((d) => {
                    d.controllers[i].controller_id = v;
                    for (const b of d.circuits) if (b.controller_id === old) b.controller_id = v;
                  });
                }} />
              </Field>
              <Field label="kind">
                <select value={c.kind} onChange={(e) => mut((x) => (x.kind = e.target.value as ControllerDef['kind']))}>
                  <option value="relay_controller">relay_controller</option><option value="access">access</option><option value="hvac">hvac</option>
                </select>
              </Field>
              <Field label="vendor"><TextInput label="vendor" value={c.vendor} onChange={(v) => mut((x) => (x.vendor = v))} /></Field>
              <Field label="model"><TextInput label="model" value={c.model} onChange={(v) => mut((x) => (x.model = v))} /></Field>
              <Field label="firmware"><TextInput label="firmware" value={c.firmware} onChange={(v) => mut((x) => (x.firmware = v))} /></Field>
              <Field label="protocol">
                <select value={c.protocol} onChange={(e) => mut((x) => (x.protocol = e.target.value as ControllerDef['protocol']))}>
                  <option value="unspecified">unspecified（未指定）</option>
                  <option value="modbus_m7000">modbus_m7000</option>
                  <option value="soyal_721_727">soyal_721_727</option>
                </select>
              </Field>
              <Field label="bus_id" hint={bus ? `匯流排協定：${bus.protocol_profile}` : undefined}>
                <select value={c.bus_id ?? ''} onChange={(e) => mut((x) => (x.bus_id = e.target.value || null))}>
                  <option value="">（未綁定）</option>
                  {dep.buses.map((b) => <option key={b.bus_id} value={b.bus_id}>{b.bus_id}</option>)}
                </select>
              </Field>
              <Field label={c.protocol === 'soyal_721_727' ? 'node_id（SOYAL node）' : 'node_id（Modbus slave 1–247）'}>
                <NumInput label="node_id" value={c.node_id} min={c.protocol === 'soyal_721_727' ? 1 : 1} max={c.protocol === 'soyal_721_727' ? 254 : 247} onChange={(v) => mut((x) => (x.node_id = v))} />
              </Field>
              <Field label="do_count"><NumInput label="do_count" value={c.do_count} min={0} onChange={(v) => mut((x) => (x.do_count = v))} /></Field>
              <Field label="capabilities（逗號分隔）">
                <input value={c.capabilities.join(', ')} onChange={(e) => mut((x) => (x.capabilities = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)))} />
              </Field>
              <Field label="profile_source"><TextInput label="profile_source" value={c.profile_source} onChange={(v) => mut((x) => (x.profile_source = v))} /></Field>
              <Field label="profile_pages"><TextInput label="profile_pages" value={c.profile_pages} onChange={(v) => mut((x) => (x.profile_pages = v))} /></Field>
            </div>
            <fieldset className="funcs">
              <legend>modbus_functions</legend>
              <div className="small muted">常用功能碼選單，實際支援需依型號手冊確認。</div>
              <div className="row wrap">
                {(menu?.menu ?? []).map((m) => (
                  <LabeledCheck key={m.code} checked={c.modbus_functions.includes(m.code)} onChange={(on) => mut((x) => {
                    const s = new Set(x.modbus_functions);
                    if (on) s.add(m.code); else s.delete(m.code);
                    x.modbus_functions = [...s].sort((a, b) => a - b);
                  })}>{m.code} {m.name}</LabeledCheck>
                ))}
                {!menu && <span className="small muted">（功能碼選單載入失敗）</span>}
              </div>
              {menu?.note && <div className="small muted">{menu.note}</div>}
            </fieldset>
            <LabeledCheck checked={c.model_confirmed} onChange={(v) => mut((x) => (x.model_confirmed = v))}>已在現場確認廠牌／型號／韌體 (model_confirmed)</LabeledCheck>
            <RowIssues issues={issues} />
          </Card>
        );
      })}
      <button type="button" className="btn" onClick={() => update((d) => {
        d.controllers.push({
          controller_id: `ctrl-${d.controllers.length + 1}`, kind: 'relay_controller', vendor: null, model: null, firmware: null, protocol: 'unspecified',
          bus_id: null, node_id: null, do_count: null, capabilities: [], modbus_functions: [], profile_source: null, profile_pages: null, model_confirmed: false, simulation_only: false,
        });
      })}>新增控制器</button>
    </div>
  );
}

export default function DeploymentMapping() {
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<ApiError | null>(null);
  const [active, setActive] = useState<MappingActive | null>(null);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [dep, setDep] = useState<Deployment | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editSeq, setEditSeq] = useState(0);
  const [validation, setValidation] = useState<{ res: ValidationResult; seq: number } | null>(null);
  const [diff, setDiff] = useState<DraftDiff | null>(null);
  const [versions, setVersions] = useState<MappingVersion[]>([]);
  const [menu, setMenu] = useState<FunctionMenu | null>(null);
  const [maintenance, setMaintenance] = useState(false);
  const [tab, setTab] = useState<TabId>('circuits');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'ok' | 'bad'>('ok');
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyDiff, setApplyDiff] = useState<DraftDiff | null>(null);
  const [comment, setComment] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [reloadOpen, setReloadOpen] = useState(false);
  const depRef = useRef<Deployment | null>(null);
  depRef.current = dep;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const [a, d, v] = await Promise.all([
        get<MappingActive>('/v1/mapping'),
        get<DraftResponse>('/v1/mapping/draft'),
        get<{ versions: MappingVersion[] }>('/v1/mapping/versions'),
      ]);
      setActive(a);
      setDraft(d);
      setDep(clone(d.deployment));
      setVersions(v.versions);
      setDirty(false);
      setValidation(null);
      setDiff(null);
      get<FunctionMenu>('/v1/mapping/function-menu').then(setMenu).catch(() => setMenu(null));
      get<{ policies?: { maintenance_mode?: boolean } }>('/v1/system/config').then((c) => setMaintenance(!!c.policies?.maintenance_mode)).catch(() => setMaintenance(false));
    } catch (e) {
      setLoadErr(asApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const update: UpdateFn = useCallback((fn) => {
    setDep((prev) => {
      if (!prev) return prev;
      const next = clone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
    setEditSeq((n) => n + 1);
  }, []);

  const fresh = !!validation && validation.seq === editSeq && !dirty;
  const v = validation?.res ?? null;
  const shown = fresh && v?.normalized ? v.normalized : dep;
  const statusOfCircuit = (id: string) => shown?.circuits.find((c) => c.circuit_id === id)?.mapping_status ?? 'unbound';
  const statusOfCamera = (id: string) => shown?.cameras.find((c) => c.camera_id === id)?.mapping_status ?? 'unbound';
  const activeStatusOfCircuit = (id: string) => active?.deployment.circuits.find((c) => c.circuit_id === id)?.mapping_status ?? null;

  const guard = async <T,>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(label);
    setActionErr(null);
    setNotice(null);
    setNoticeTone('ok');
    setNoticeTone('ok');
    try {
      return await fn();
    } catch (e) {
      setActionErr(asApiError(e));
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const save = async (): Promise<boolean> => {
    if (!dep || !draft) return false;
    const r = await guard('save', () => put<DraftResponse>('/v1/mapping/draft', { expected_revision: draft.draft_revision, deployment: dep }));
    if (!r) return false;
    setDraft(r);
    setDep(clone(r.deployment));
    setDirty(false);
    setNotice(`草稿已儲存（draft rev ${r.draft_revision}）。`);
    return true;
  };

  const runValidate = async () => {
    if (dirty && !(await save())) return;
    const res = await guard('validate', () => post<ValidationResult>('/v1/mapping/draft/validate'));
    if (res) {
      setValidation({ res, seq: editSeq });
      setTab('history');
      setNoticeTone(res.ok ? 'ok' : 'bad');
      setNoticeTone(res.ok ? 'ok' : 'bad');
      setNotice(res.ok ? '設定驗證通過（不代表硬體已測試）。' : `驗證發現 ${res.errors.length} 個錯誤。`);
    }
  };

  const runDiff = async () => {
    if (dirty && !(await save())) return;
    const d = await guard('diff', () => get<DraftDiff>('/v1/mapping/draft/diff'));
    if (d) {
      setDiff(d);
      setTab('history');
    }
  };

  const openApply = async () => {
    setApplyOpen(true);
    setApplyDiff(null);
    const d = await guard('diff', () => get<DraftDiff>('/v1/mapping/draft/diff'));
    if (d) setApplyDiff(d);
  };

  const doApply = async () => {
    if (!draft) return;
    setBusy('apply');
    setActionErr(null);
    try {
      const r = await post<{ revision: number; changes: number; hardware_commands_sent: number }>('/v1/mapping/apply', { expected_revision: draft.active_revision, comment: comment.trim() || null });
      setApplyOpen(false);
      setComment('');
      await loadAll();
      setNotice(`已套用為 rev ${r.revision}（${r.changes} 項變更，送出硬體命令 ${r.hardware_commands_sent} 筆）。`);
    } catch (e) {
      const err = asApiError(e);
      setActionErr(err);
      setApplyOpen(false);
      if (err.code === 'validation_failed') {
        const d = err.details as unknown as ValidationResult;
        if (d && Array.isArray(d.errors)) {
          setValidation({ res: { ...d, normalized: null }, seq: editSeq });
          setTab('history');
        }
      }
    } finally {
      setBusy(null);
    }
  };

  const doDiscard = async () => {
    if (!draft) return;
    setDiscardOpen(false);
    const r = await guard('discard', () => del<DraftResponse>('/v1/mapping/draft', { query: { expected_revision: draft.draft_revision } }));
    if (r) {
      await loadAll();
      setNotice('草稿已捨棄。');
    }
  };

  const downloadLocal = () => {
    if (!dep) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(dep, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-local-mapping-edits.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const counts = useMemo(() => ({ e: v?.errors.length ?? 0, w: v?.warnings.length ?? 0, p: v?.pending.length ?? 0 }), [v]);

  if (loading && !dep) return <Loading />;
  if (loadErr) return <ErrorBox error={loadErr} onRetry={() => void loadAll()} />;
  if (!dep || !draft || !active) return null;

  const conflict = actionErr?.code === 'revision_conflict';
  const explain: Record<string, ReactNode> = {
    mapping_busy_bus: '匯流排上仍有執行中的命令（in-flight）。請等命令結束、匯流排閒置後再套用。',
    mapping_active_sessions: '受影響的攝影機仍有即時／回放工作階段。請先到「即時影像」停止它們，再套用。',
  };

  return (
    <div>
      <Notice tone="info">
        <strong>套用位址映射不會送出任何 DO 寫入或地址重設</strong>，只會切換設定版本。目前啟用版本：<strong>rev {active.revision}</strong>
        {draft.exists ? <>；伺服器草稿 draft rev {draft.draft_revision}（基於 rev {draft.base_revision}，{draft.updated_by ?? '—'} {fmtTime(draft.updated_at)}）</> : '；目前沒有草稿（顯示的是啟用版本的複本）'}。
        {active.deployment.simulation_only && <> 啟用版本為<strong>模擬映射</strong>。</>}
      </Notice>

      <div className="toolbar sticky">
        <div className="row wrap">
          <button type="button" className="btn btn-primary" disabled={!dirty || !!busy} onClick={() => void save()}>{busy === 'save' ? '儲存中…' : '儲存草稿'}</button>
          <button type="button" className="btn" disabled={!!busy} onClick={() => void runValidate()}>{busy === 'validate' ? '驗證中…' : '驗證'}</button>
          <button type="button" className="btn" disabled={!!busy} onClick={() => void runDiff()}>檢視差異</button>
          <button type="button" className="btn btn-primary" disabled={!!busy || dirty || !draft.exists || (!!v && fresh && !v.ok)} title={dirty ? '請先儲存草稿' : !draft.exists ? '沒有草稿可套用' : ''} onClick={() => void openApply()}>套用…</button>
          <button type="button" className="btn" disabled={!!busy || !draft.exists} onClick={() => setDiscardOpen(true)}>捨棄草稿</button>
          <button type="button" className="btn" disabled={!!busy} onClick={() => (dirty ? setReloadOpen(true) : void loadAll())}>重新載入</button>
        </div>
        <div className="row">
          {dirty ? <Badge tone="warn">有未儲存的修改</Badge> : <Badge tone="ok">已與草稿同步</Badge>}
          {validation && (
            <Badge tone={v?.ok ? (fresh ? 'ok' : 'warn') : 'bad'} title={fresh ? '' : '草稿已變更，需重新驗證'}>
              驗證{fresh ? '' : '（過期）'}：錯誤 {counts.e}／警告 {counts.w}／待確認 {counts.p}
            </Badge>
          )}
        </div>
      </div>

      {notice && <Notice tone={noticeTone}>{notice}</Notice>}
      {actionErr && (
        <ErrorBox error={actionErr}>
          {explain[actionErr.code] && <div>{explain[actionErr.code]}</div>}
          {conflict && (
            <div className="row">
              <span>有其他人已編輯過；你的本地修改尚未覆蓋任何資料。</span>
              <button type="button" className="btn btn-sm" onClick={() => void loadAll()}>重新載入（會放棄本地修改）</button>
              <button type="button" className="btn btn-sm" onClick={downloadLocal}>先下載我的修改 (JSON)</button>
            </div>
          )}
        </ErrorBox>
      )}

      <Tabs<TabId>
        tabs={[
          { id: 'buses', label: '通訊匯流排' },
          { id: 'controllers', label: '控制器' },
          { id: 'circuits', label: '18 路迴路綁定' },
          { id: 'cameras', label: '攝影機／NVR 通道' },
          { id: 'history', label: '驗證與套用紀錄', badge: validation ? <Badge tone={counts.e ? 'bad' : 'ok'}>{counts.e ? `${counts.e} 錯誤` : 'OK'}</Badge> : undefined },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'buses' && <BusesTab dep={dep} update={update} validation={v} />}
      {tab === 'controllers' && <ControllersTab dep={dep} update={update} validation={v} menu={menu} />}
      {tab === 'circuits' && (
        <CircuitBindings dep={dep} catalog={active.catalog.circuits} update={update} validation={v} menu={menu}
          statusOf={statusOfCircuit} activeStatusOf={activeStatusOfCircuit} maintenance={maintenance} />
      )}
      {tab === 'cameras' && (
        <CameraMapping dep={dep} catalog={active.catalog.cameras} update={update} validation={v} statusOf={statusOfCamera} configRevision={active.revision} />
      )}
      {tab === 'history' && (
        <MappingHistory activeRevision={active.revision} draftRevision={draft.draft_revision} dirty={dirty} validation={v} validationFresh={fresh}
          diff={diff} versions={versions} onChanged={loadAll} />
      )}

      {applyOpen && (
        <ConfirmDialog title="套用位址映射" confirmLabel="確認套用" busy={busy === 'apply'} onConfirm={() => void doApply()} onCancel={() => setApplyOpen(false)}>
          <p>將草稿（基於 rev {draft.active_revision}）套用為新的啟用版本。<strong>不會送出任何 DO 寫入或地址重設，也不會啟動任何串流。</strong></p>
          <ul className="small">
            <li>設定驗證通過 ≠ 硬體已測試；各輸出仍需現場實測。</li>
            <li>若匯流排有執行中命令 → 被拒絕（mapping_busy_bus）。</li>
            <li>若受影響攝影機仍有串流 → 被拒絕（mapping_active_sessions）。</li>
            <li>若其他人已改動啟用版本 → 被拒絕（revision_conflict）。</li>
          </ul>
          {applyDiff ? <DiffView diff={applyDiff} /> : <Loading text="取得差異…" />}
          <Field label="備註（選填，最多 200 字）">
            <input value={comment} maxLength={200} onChange={(e) => setComment(e.target.value)} />
          </Field>
        </ConfirmDialog>
      )}
      {discardOpen && (
        <ConfirmDialog title="捨棄草稿" confirmLabel="捨棄" danger onConfirm={() => void doDiscard()} onCancel={() => setDiscardOpen(false)}>
          <p>將刪除伺服器上的草稿，編輯器回到啟用版本。確定嗎？</p>
        </ConfirmDialog>
      )}
      {reloadOpen && (
        <ConfirmDialog title="放棄本地修改並重新載入" confirmLabel="重新載入" danger onConfirm={() => { setReloadOpen(false); void loadAll(); }} onCancel={() => setReloadOpen(false)}>
          <p>你有尚未儲存的修改，重新載入會捨棄它們。</p>
        </ConfirmDialog>
      )}
      <MappingChipLegend />
    </div>
  );
}

function MappingChipLegend() {
  return (
    <p className="small muted">
      映射狀態：<MappingChip status="unbound" /> <MappingChip status="draft" /> <MappingChip status="validated" /> <MappingChip status="active" />
      「已驗證」= 設定驗證通過，不表示硬體已測試。
    </p>
  );
}

