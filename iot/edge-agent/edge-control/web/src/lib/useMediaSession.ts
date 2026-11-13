import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, del, get, post, releaseKeepalive, trackSession, untrackSession } from '../api/client';
import type { SessionView } from '../api/types';
import { asApiError } from './errors';
import { whepConnect, WhepError, type WhepConnection } from './whep';

export type MediaKind = 'live' | 'playback';
export type MediaPhase = 'idle' | 'creating' | 'preparing' | 'connecting' | 'playing' | 'failed' | 'stopped' | 'expired';

export interface MediaError {
  code: string;
  message: string;
  requestId?: string | null;
}

const deletePathOf = (kind: MediaKind, id: string) => (kind === 'live' ? `/v1/live-sessions/${id}` : `/v1/playback-sessions/${id}`);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * One live/playback session: create (202) -> poll status_url until ready|failed -> WHEP connect -> play.
 * Releases the server session on stop, unmount and pagehide.
 */
export function useMediaSession() {
  const [phase, setPhase] = useState<MediaPhase>('idle');
  const [error, setError] = useState<MediaError | null>(null);
  const [connState, setConnState] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [session, setSession] = useState<SessionView | null>(null);

  const gen = useRef(0);
  const conn = useRef<WhepConnection | null>(null);
  const current = useRef<{ kind: MediaKind; id: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  /** Close WebRTC + release the server-side session. */
  const release = useCallback(async (keepalive: boolean) => {
    clearTimer();
    const c = conn.current;
    conn.current = null;
    const cur = current.current;
    current.current = null;
    if (c) void c.close();
    if (cur) {
      const path = deletePathOf(cur.kind, cur.id);
      untrackSession(path);
      if (keepalive) releaseKeepalive(path);
      else {
        try {
          await del(path);
        } catch {
          /* already gone / expired */
        }
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      gen.current += 1;
      void release(true);
    };
  }, [release]);

  const fail = (my: number, code: string, message: string, requestId?: string | null) => {
    if (gen.current !== my || !alive.current) return;
    setError({ code, message, requestId });
    setPhase('failed');
  };

  const start = useCallback(
    async (kind: MediaKind, cameraId: string, body: Record<string, unknown>) => {
      const my = ++gen.current;
      await release(false);
      if (gen.current !== my || !alive.current) return;
      setError(null);
      setStream(null);
      setSession(null);
      setConnState('');
      setPhase('creating');

      const base = kind === 'live' ? `/v1/cameras/${cameraId}/live-sessions` : `/v1/cameras/${cameraId}/playback-sessions`;
      let view: SessionView;
      try {
        view = await post<SessionView>(base, body, { headers: { 'Idempotency-Key': `web-${crypto.randomUUID()}` } });
      } catch (e) {
        const err = asApiError(e);
        fail(my, err.code, err.message, err.requestId);
        return;
      }
      const delPath = deletePathOf(kind, view.session_id);
      if (gen.current !== my || !alive.current) {
        // superseded while the request was in flight: release it right away
        releaseKeepalive(delPath);
        return;
      }
      current.current = { kind, id: view.session_id };
      trackSession(delPath);
      setSession(view);
      setPhase('preparing');

      // ---- poll until ready | failed
      const deadline = Date.now() + 60_000;
      while (view.status === 'preparing') {
        if (Date.now() > deadline) {
          fail(my, 'prepare_timeout', '等待串流準備逾時');
          return;
        }
        await sleep(800);
        if (gen.current !== my) return;
        try {
          view = await get<SessionView>(view.status_url);
        } catch (e) {
          const err = asApiError(e);
          fail(my, err.code, err.message, err.requestId);
          return;
        }
        if (gen.current !== my) return;
        setSession(view);
      }
      if (view.status === 'failed') {
        fail(my, view.error?.code ?? 'session_failed', view.error?.message ?? '串流準備失敗');
        return;
      }
      if (view.status !== 'ready') {
        if (gen.current === my && alive.current) setPhase(view.status === 'expired' ? 'expired' : 'stopped');
        return;
      }
      if (!view.playback) {
        fail(my, 'playback_unavailable', '伺服器未回傳播放資訊（此工作階段的權杖僅提供給建立者）');
        return;
      }

      // ---- WHEP
      setPhase('connecting');
      try {
        const c = await whepConnect({
          url: view.playback.url,
          token: view.playback.token,
          iceServers: view.playback.ice_servers,
          onTrack: (s) => {
            if (gen.current === my && alive.current) setStream(s);
          },
          onConnectionState: (st) => {
            if (gen.current !== my || !alive.current) return;
            setConnState(st);
            if (st === 'connected') setPhase('playing');
            if (st === 'failed') fail(my, 'webrtc_failed', 'WebRTC 連線失敗（網路、防火牆或 TURN 設定）');
          },
        });
        if (gen.current !== my || !alive.current) {
          void c.close();
          return;
        }
        conn.current = c;
        setConnState(c.pc.connectionState);
        if (c.pc.connectionState === 'connected') setPhase('playing');
      } catch (e) {
        const msg = e instanceof WhepError ? `${e.message}` : e instanceof ApiError ? e.message : '無法建立 WebRTC 連線';
        fail(my, e instanceof WhepError ? e.code : 'whep_failed', msg);
        void release(false);
        return;
      }

      // ---- expiry
      const ms = Date.parse(view.expires_at) - Date.now();
      if (Number.isFinite(ms)) {
        timer.current = setTimeout(() => {
          if (gen.current !== my || !alive.current) return;
          setPhase('expired');
          setStream(null);
          void release(false);
        }, Math.max(0, ms));
      }
    },
    [release],
  );

  const stop = useCallback(async () => {
    gen.current += 1;
    setStream(null);
    setConnState('');
    setPhase('stopped');
    await release(false);
  }, [release]);

  const active = phase === 'creating' || phase === 'preparing' || phase === 'connecting' || phase === 'playing';
  return { phase, error, connState, stream, session, active, start, stop };
}
