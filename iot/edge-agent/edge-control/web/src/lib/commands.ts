import { get } from '../api/client';
import type { CommandStatusName, CommandView } from '../api/types';

export const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['succeeded', 'failed', 'expired', 'unknown']);

export function isTerminal(status: CommandStatusName | string | undefined | null): boolean {
  return !!status && TERMINAL_STATUSES.has(status);
}

/** Client-generated idempotency/command id (matches ^[A-Za-z0-9._:-]+$, 8..80 chars). */
export function newCommandId(prefix = 'web'): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${rnd}`;
}

/** ISO-8601 (with Z timezone) `seconds` from now. */
export function expiresAtIso(seconds = 60, now: number = Date.now()): string {
  return new Date(now + seconds * 1000).toISOString();
}

export interface PollOptions {
  intervalMs?: number;
  /** stop polling (outcome 'timeout') after this long without a terminal status */
  maxMs?: number;
  signal?: AbortSignal;
  onUpdate?: (c: CommandView) => void;
  /** injectable for tests */
  fetchCommand?: (id: string, signal?: AbortSignal) => Promise<CommandView>;
  maxConsecutiveErrors?: number;
}

export type PollOutcome = 'terminal' | 'timeout' | 'aborted' | 'error';
export interface PollResult {
  outcome: PollOutcome;
  command: CommandView | null;
  error?: unknown;
}

const defaultFetch = (id: string, signal?: AbortSignal) => get<CommandView>(`/v1/commands/${encodeURIComponent(id)}`, { signal });

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Poll GET /v1/commands/{id} until a terminal status. Never re-submits the command.
 * Transient fetch errors are tolerated up to `maxConsecutiveErrors`; after that the outcome is 'error' and the
 * last known command (if any) is returned — the command may still be executing on the edge.
 */
export async function pollCommand(commandId: string, opts: PollOptions = {}): Promise<PollResult> {
  const { intervalMs = 700, maxMs = 90_000, signal, onUpdate, maxConsecutiveErrors = 5 } = opts;
  const fetchCommand = opts.fetchCommand ?? defaultFetch;
  const started = Date.now();
  let last: CommandView | null = null;
  let errors = 0;
  for (;;) {
    if (signal?.aborted) return { outcome: 'aborted', command: last };
    try {
      const c = await fetchCommand(commandId, signal);
      errors = 0;
      last = c;
      onUpdate?.(c);
      if (isTerminal(c.status)) return { outcome: 'terminal', command: c };
    } catch (e) {
      if (signal?.aborted) return { outcome: 'aborted', command: last };
      errors += 1;
      if (errors >= maxConsecutiveErrors) return { outcome: 'error', command: last, error: e };
    }
    if (Date.now() - started >= maxMs) return { outcome: 'timeout', command: last };
    await sleep(intervalMs, signal);
  }
}
