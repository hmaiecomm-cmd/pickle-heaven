import { useState } from 'react';
import { apiText, get, post } from '../api/client';
import type { ApiError } from '../api/client';
import type { AuditItem, DraftDiff, MappingVersion, ValidationResult } from '../api/types';
import { IssueGroups } from '../components/mappingBits';
import { Badge, Card, ConfirmDialog, ErrorBox, Field, Loading, Notice } from '../components/ui';
import { asApiError } from '../lib/errors';
import { fmtTime } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { AuditTable } from './Diagnostics';

export function DiffView({ diff }: { diff: DraftDiff }) {
  if (!diff.changes.length) return <div className="empty">草稿與目前啟用版本（rev {diff.active_revision}）沒有差異。</div>;
  return (
    <div>
      {diff.changes.map((c) => (
        <details key={`${c.section}:${c.id}`} className="diff-item" open={c.fields.length <= 6}>
          <summary>
            <Badge tone={c.change === 'added' ? 'ok' : c.change === 'removed' ? 'bad' : 'info'}>{c.change === 'added' ? '新增' : c.change === 'removed' ? '移除' : '修改'}</Badge>{' '}
            <span className="mono">{c.section}/{c.id}</span>
          </summary>
          {c.fields.length > 0 && (
            <table className="table table-sm">
              <thead><tr><th>欄位</th><th>原值</th><th>新值</th></tr></thead>
              <tbody>
                {c.fields.map((f) => (
                  <tr key={f.field}>
                    <td>{f.field}</td>
                    <td className="mono small">{JSON.stringify(f.before)}</td>
                    <td className="mono small">{JSON.stringify(f.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
      ))}
    </div>
  );
}

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Props {
  activeRevision: number;
  draftRevision: number;
  dirty: boolean;
  validation: ValidationResult | null;
  validationFresh: boolean;
  diff: DraftDiff | null;
  versions: MappingVersion[];
  onChanged: () => Promise<void>;
}

export default function MappingHistory({ activeRevision, draftRevision, dirty, validation, validationFresh, diff, versions, onChanged }: Props) {
  const audit = useLoad((s) => get<{ items: AuditItem[] }>('/v1/audit', { signal: s, query: { limit: 200 } }));
  const [rollbackTo, setRollbackTo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [fmt, setFmt] = useState<'json' | 'yaml'>('json');
  const [content, setContent] = useState('');
  const [confirmImport, setConfirmImport] = useState(false);

  const doExport = async () => {
    setErr(null);
    try {
      const text = await apiText('/v1/mapping/export', { query: { format: fmt } });
      download(`deployment-rev${activeRevision}.${fmt}`, text, fmt === 'json' ? 'application/json' : 'application/yaml');
    } catch (e) {
      setErr(asApiError(e));
    }
  };

  const doImport = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await post('/v1/mapping/import', { format: fmt, content, expected_revision: draftRevision });
      setMsg('已匯入為草稿（尚未套用）。請檢視差異並驗證。');
      setConfirmImport(false);
      setContent('');
      await onChanged();
    } catch (e) {
      setErr(asApiError(e));
      setConfirmImport(false);
    } finally {
      setBusy(false);
    }
  };

  const doRollback = async () => {
    if (rollbackTo === null) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await post<{ revision: number; restored_from: number }>('/v1/mapping/rollback', { revision: rollbackTo, expected_revision: activeRevision });
      setMsg(`已回滾：從 rev ${r.restored_from} 建立新版本 rev ${r.revision}。`);
      setRollbackTo(null);
      await onChanged();
    } catch (e) {
      setErr(asApiError(e));
      setRollbackTo(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Notice tone="info">
        <strong>套用與回滾只會修改設定</strong>：不會送出任何 DO 寫入或地址重設，也不會重新播放舊命令；回滾後各迴路是否真的通電，仍以實際回讀為準。
      </Notice>
      {msg && <Notice tone="ok">{msg}</Notice>}
      <ErrorBox error={err} />

      <Card title={`最近一次驗證結果${validation ? (validationFresh ? '' : '（草稿已變更，需重新驗證）') : ''}`}>
        {validation ? (
          <>
            <div className="row"><Badge tone={validation.ok ? 'ok' : 'bad'}>{validation.ok ? '設定驗證通過' : '有錯誤，無法套用'}</Badge>
              <span className="small muted">validated = 設定一致，不表示硬體已測試。</span></div>
            <IssueGroups v={validation} />
          </>
        ) : <div className="empty">尚未驗證。請按上方「驗證」。</div>}
      </Card>

      <Card title="草稿 vs. 啟用版本差異">
        {diff ? <DiffView diff={diff} /> : <div className="empty">尚未取得差異。請按上方「檢視差異」。</div>}
      </Card>

      <Card title="版本紀錄與回滾">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>版本</th><th>類型</th><th>建立者</th><th>時間</th><th>備註</th><th /></tr></thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.revision} className={v.revision === activeRevision ? 'row-sel' : ''}>
                  <td>rev {v.revision} {v.revision === activeRevision && <Badge tone="ok">目前啟用</Badge>}</td>
                  <td>{v.kind}</td><td>{v.created_by}</td><td>{fmtTime(v.created_at)}</td><td>{v.comment ?? '—'}</td>
                  <td>{v.revision !== activeRevision && (
                    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setRollbackTo(v.revision)}>回滾到此版本</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="匯入／匯出">
        <div className="row">
          <label className="inline">格式
            <select value={fmt} onChange={(e) => setFmt(e.target.value as 'json' | 'yaml')}>
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
            </select>
          </label>
          <button type="button" className="btn" onClick={() => void doExport()}>匯出目前啟用版本 (rev {activeRevision})</button>
        </div>
        <Field label="匯入內容（貼上或選擇檔案；只會建立草稿，不會直接套用）">
          <textarea className="mono" rows={8} value={content} onChange={(e) => setContent(e.target.value)} spellCheck={false} />
        </Field>
        <div className="row">
          <input type="file" accept=".json,.yaml,.yml,application/json" aria-label="選擇匯入檔案" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setContent(await f.text());
            setFmt(/\.ya?ml$/i.test(f.name) ? 'yaml' : 'json');
          }} />
          <button type="button" className="btn btn-primary" disabled={!content.trim() || busy} onClick={() => setConfirmImport(true)}>匯入為草稿</button>
        </div>
      </Card>

      <Card title="稽核紀錄">
        <ErrorBox error={audit.error} onRetry={() => void audit.reload()} />
        {audit.loading && !audit.data ? <Loading /> : <AuditTable items={(audit.data?.items ?? []).filter((a) => String(a.action ?? '').startsWith('mapping'))} />}
        <div className="small muted">僅顯示 mapping.* 動作；完整紀錄請至「系統診斷」。</div>
      </Card>

      {rollbackTo !== null && (
        <ConfirmDialog title={`回滾到 rev ${rollbackTo}`} confirmLabel="確認回滾" busy={busy} onConfirm={() => void doRollback()} onCancel={() => setRollbackTo(null)}>
          <p>將以 rev {rollbackTo} 的內容建立新的啟用版本（目前為 rev {activeRevision}）。</p>
          <p><strong>回滾只修改設定，不重新播放舊命令；套用不會送出任何 DO 寫入或地址重設。</strong></p>
          <p className="small muted">若匯流排有執行中命令或攝影機仍有串流，伺服器會拒絕（mapping_busy_bus / mapping_active_sessions）。</p>
        </ConfirmDialog>
      )}
      {confirmImport && (
        <ConfirmDialog title="匯入為草稿" confirmLabel="匯入" busy={busy} onConfirm={() => void doImport()} onCancel={() => setConfirmImport(false)}>
          <p>匯入內容會<strong>取代目前伺服器上的草稿</strong>（不會套用）。{dirty && <span className="text-warn">你有尚未儲存的本地修改，匯入後將被覆蓋。</span>}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
