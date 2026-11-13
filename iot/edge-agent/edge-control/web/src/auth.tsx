import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, get, post, setUnauthorizedHandler } from './api/client';
import type { Me, Role } from './api/types';

const RANK: Record<Role, number> = { viewer: 1, operator: 2, admin: 3 };

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (minimum: Role) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMe(await get<Me>('/v1/auth/me'));
      setError(null);
    } catch (e) {
      setMe(null);
      if (e instanceof ApiError && e.status !== 401) setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setMe(null)); // any 401 -> back to the login page
    void refresh();
    return () => setUnauthorizedHandler(null);
  }, [refresh]);

  const login = useCallback(
    async (token: string) => {
      await post('/v1/auth/login', { token });
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await post('/v1/auth/logout');
    } finally {
      setMe(null);
    }
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ me, loading, error, refresh, login, logout, can: (min) => !!me && RANK[me.role] >= RANK[min] }),
    [me, loading, error, refresh, login, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}
