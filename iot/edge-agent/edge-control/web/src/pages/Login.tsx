import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { ErrorBox } from '../components/ui';
import { asApiError } from '../lib/errors';
import type { ApiError } from '../api/client';

export default function Login() {
  const { login, error: bootError } = useAuth();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(token.trim());
      setToken(''); // never keep the token around after the exchange
    } catch (err) {
      setError(asApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit} autoComplete="off">
        <h1>顧好 Edge Control</h1>
        <p className="muted">請貼上您的存取 Token。Token 只會送到伺服器換取登入工作階段（HttpOnly Cookie），不會儲存在瀏覽器。</p>
        <label className="field">
          <span className="field-label">存取 Token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            required
            minLength={8}
            maxLength={512}
            aria-label="存取 Token"
          />
        </label>
        <ErrorBox error={error ?? bootError} />
        <button type="submit" className="btn btn-primary" disabled={busy || token.trim().length < 8}>
          {busy ? '登入中…' : '登入'}
        </button>
      </form>
    </main>
  );
}
