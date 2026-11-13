import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import { hintFor } from '../lib/errors';

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'mute' | 'sim';

export function Badge({ tone = 'mute', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Loading({ text = '載入中…' }: { text?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> {text}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Shows message + code (+ request_id small) and a Chinese hint for known codes. */
export function ErrorBox({ error, onRetry, children }: { error: unknown; onRetry?: () => void; children?: ReactNode }) {
  if (!error) return null;
  const e = error instanceof ApiError ? error : new ApiError(0, 'client_error', error instanceof Error ? error.message : String(error));
  const hint = hintFor(e.code);
  return (
    <div className="alert alert-bad" role="alert">
      <div>
        <strong>{e.message}</strong> <code className="code">{e.code}</code>
      </div>
      {hint && hint !== e.message && <div>{hint}</div>}
      {children}
      <div className="small muted">
        {e.requestId ? <>request_id: {e.requestId}</> : null}
        {onRetry && (
          <>
            {' '}
            <button type="button" className="btn btn-sm" onClick={onRetry}>
              重試
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; children: ReactNode }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'bad' ? 'alert' : 'note'}>
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children, wide, danger }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; danger?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''} ${danger ? 'modal-danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref}>
        <h2 id={id}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title, children, confirmLabel = '確認', danger, busy, onConfirm, onCancel, disabled,
}: {
  title: string; children: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; disabled?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel} danger={danger}>
      <div className="modal-body">{children}</div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>取消</button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy || disabled}>
          {busy ? '處理中…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string; badge?: ReactNode }>; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label} {t.badge}
        </button>
      ))}
    </div>
  );
}

export function KV({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || actions) && (
        <header className="card-head">
          <h3>{title}</h3>
          <div>{actions}</div>
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="small muted">{hint}</span>}
    </label>
  );
}

export function BoolBadge({ value, yes = '是', no = '否' }: { value: boolean | null | undefined; yes?: string; no?: string }) {
  if (value === null || value === undefined) return <Badge>未知</Badge>;
  return <Badge tone={value ? 'ok' : 'mute'}>{value ? yes : no}</Badge>;
}
