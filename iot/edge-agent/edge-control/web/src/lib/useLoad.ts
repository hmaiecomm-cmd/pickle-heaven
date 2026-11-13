import { useCallback, useEffect, useRef, useState } from 'react';
import { asApiError } from './errors';
import type { ApiError } from '../api/client';

/** Load data on mount (and on demand / on an interval). Aborts and ignores stale results on unmount. */
export function useLoad<T>(loader: (signal: AbortSignal) => Promise<T>, deps: unknown[] = [], opts: { intervalMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const acRef = useRef<AbortController | null>(null);

  const reload = useCallback(async (silent = false) => {
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    if (!silent) setLoading(true);
    try {
      const d = await loaderRef.current(ac.signal);
      if (ac.signal.aborted) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(asApiError(e));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => acRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!opts.intervalMs) return;
    const t = setInterval(() => void reload(true), opts.intervalMs);
    return () => clearInterval(t);
  }, [opts.intervalMs, reload]);

  return { data, error, loading, reload, setData };
}
