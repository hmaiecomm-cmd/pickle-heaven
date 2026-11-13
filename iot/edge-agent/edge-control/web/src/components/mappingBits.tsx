import type { ReactNode } from 'react';
import type { Deployment, Issue, MappingStatus, ValidationResult } from '../api/types';
import { MAPPING_STATUS_LABEL, MAPPING_STATUS_TIP } from '../lib/format';
import { Badge, type Tone } from './ui';

export type UpdateFn = (fn: (d: Deployment) => void) => void;

const TONE: Record<MappingStatus, Tone> = { unbound: 'mute', draft: 'warn', validated: 'info', active: 'ok' };

export function MappingChip({ status }: { status: MappingStatus | string }) {
  const tip = status === 'validated' ? '設定驗證通過，不表示硬體已測試' : MAPPING_STATUS_TIP;
  return (
    <Badge tone={TONE[status as MappingStatus] ?? 'mute'} title={tip}>
      {MAPPING_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function allIssues(v: ValidationResult | null): Issue[] {
  return v ? [...v.errors, ...v.warnings, ...v.pending] : [];
}

export function issuesFor(v: ValidationResult | null, section: string, entity: string): Issue[] {
  return allIssues(v).filter((i) => i.section === section && (i.entity === entity || i.entity.split(',').includes(entity)));
}

const LEVEL_LABEL = { error: '錯誤', warning: '警告', pending: '待確認' } as const;

/** Inline issues for one row/card: errors+warnings shown, pending collapsed. */
export function RowIssues({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  const hot = issues.filter((i) => i.level !== 'pending');
  const pend = issues.filter((i) => i.level === 'pending');
  return (
    <div className="row-issues">
      {hot.map((i, k) => (
        <div key={k} className={`small ${i.level === 'error' ? 'text-bad' : 'text-warn'}`}>
          {LEVEL_LABEL[i.level]}：{i.message} <code className="code">{i.code}</code>
        </div>
      ))}
      {pend.length > 0 && (
        <details className="small muted">
          <summary>待確認 {pend.length} 項</summary>
          <ul>{pend.map((i, k) => <li key={k}>{i.message} <code className="code">{i.code}</code></li>)}</ul>
        </details>
      )}
    </div>
  );
}

const SECTION_LABEL: Record<string, string> = { buses: '通訊匯流排', controllers: '控制器', circuits: '迴路綁定', cameras: '攝影機／NVR' };

export function IssueGroups({ v }: { v: ValidationResult }) {
  const groups: Array<[keyof typeof LEVEL_LABEL, Issue[], string]> = [
    ['error', v.errors, 'text-bad'],
    ['warning', v.warnings, 'text-warn'],
    ['pending', v.pending, 'muted'],
  ];
  return (
    <div>
      {groups.map(([lvl, list, cls]) => {
        if (!list.length) return null;
        const bySection = new Map<string, Issue[]>();
        for (const i of list) bySection.set(i.section, [...(bySection.get(i.section) ?? []), i]);
        return (
          <details key={lvl} open={lvl !== 'pending'} className="issue-group">
            <summary className={cls}><strong>{LEVEL_LABEL[lvl]}（{list.length}）</strong></summary>
            {[...bySection.entries()].map(([sec, items]) => (
              <div key={sec}>
                <div className="small"><strong>{SECTION_LABEL[sec] ?? sec}</strong></div>
                <ul>
                  {items.map((i, k) => (
                    <li key={k} className="small"><span className="mono">{i.entity}</span> — {i.message} <code className="code">{i.code}</code></li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
        );
      })}
      {!v.errors.length && !v.warnings.length && !v.pending.length && <div className="small">沒有任何問題。</div>}
    </div>
  );
}

// ---- small nullable inputs --------------------------------------------------------------------
export function NumInput({ value, onChange, disabled, min, max, step, label, width }: {
  value: number | null | undefined; onChange: (v: number | null) => void; disabled?: boolean; min?: number; max?: number; step?: number; label: string; width?: number;
}) {
  return (
    <input
      type="number"
      aria-label={label}
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      style={width ? { width } : undefined}
      onChange={(e) => {
        const s = e.target.value;
        if (s === '') return onChange(null);
        const n = Number(s);
        onChange(Number.isFinite(n) ? n : null);
      }}
    />
  );
}

export function TextInput({ value, onChange, disabled, label, placeholder, mono, width }: {
  value: string | null | undefined; onChange: (v: string | null) => void; disabled?: boolean; label: string; placeholder?: string; mono?: boolean; width?: number;
}) {
  return (
    <input
      type="text"
      aria-label={label}
      className={mono ? 'mono' : undefined}
      value={value ?? ''}
      placeholder={placeholder}
      disabled={disabled}
      style={width ? { width } : undefined}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
    />
  );
}

export function TriSelect({ value, onChange, label, disabled }: { value: boolean | null; onChange: (v: boolean | null) => void; label: string; disabled?: boolean }) {
  return (
    <select aria-label={label} disabled={disabled} value={value === null ? '' : value ? 'y' : 'n'} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'y')}>
      <option value="">未知</option>
      <option value="y">有</option>
      <option value="n">無</option>
    </select>
  );
}

export function LabeledCheck({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="inline">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /> {children}
    </label>
  );
}
