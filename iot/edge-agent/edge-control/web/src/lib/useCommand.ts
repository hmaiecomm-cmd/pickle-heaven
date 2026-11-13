import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError } from '../api/client';
import type { CommandAccepted, CommandView } from '../api/types';
import { asApiError } from './errors';
import { expiresAtIso, newCommandId, pollCommand } from './commands';

export type RunnerPhase = 'idle' | 'submitting' | 'polling' | 'done' | 'error';

export interface RunnerState {
  phase: RunnerPhase;
  commandId: string | null;
  command: CommandView | null;
  /** submit rejected by the server (nothing was queued) */
  error: ApiError | null;
  /** polling gave up (network / timeout) - command may still be running on the edge */
  pollIssue: 'timeout' | 'error' | null;
  replay: boolean;
}

const IDLE: RunnerState = { phase: 'idle', commandId: null, command: null, error: null, pollIssue: null, replay: false };

/**
 * Runs one hardware command at a time: generate id -> submit (202) -> poll until terminal.
 * No optimistic state; no automatic re-submit (a retry is always an explicit user action with a new id).
 */
export function useCommandRunner() {
  const [state, setState] = useState<RunnerState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const busy = state.phase === 'submitting' || state.phase === 'polling';

  const run = useCallback(
    async (submit: (commandId: string, expiresAt: string) => Promise<CommandAccepted>, onFinished?: (c: CommandView | null) => void) => {
      if (inFlight.current) return; // never start a second command while one is in flight
      inFlight.current = true;
      const ac = new AbortController();
      abortRef.current = ac;
      const commandId = newCommandId();
      const set = (s: Partial<RunnerState>) => alive.current && setState((p) => ({ ...p, ...s }));
      setState({ ...IDLE, phase: 'submitting', commandId });
      let accepted: CommandAccepted;
      try {
        accepted = await submit(commandId, expiresAtIso(60));
      } catch (e) {
        inFlight.current = false;
        set({ phase: 'error', error: asApiError(e) });
        return;
      }
      set({ phase: 'polling', replay: accepted.replay });
      const res = await pollCommand(accepted.command_id, {
        signal: ac.signal,
        onUpdate: (c) => set({ command: c }),
      });
      inFlight.current = false;
      if (res.outcome === 'aborted') return;
      if (res.outcome === 'terminal') set({ phase: 'done', command: res.command });
      else set({ phase: 'done', command: res.command, pollIssue: res.outcome === 'timeout' ? 'timeout' : 'error' });
      if (alive.current) onFinished?.(res.command);
    },
    [],
  );

  const reset = useCallback(() => setState(IDLE), []);
  return { state, busy, run, reset };
}
