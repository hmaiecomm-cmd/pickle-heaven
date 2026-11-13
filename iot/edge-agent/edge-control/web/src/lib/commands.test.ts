import { describe, expect, it, vi } from 'vitest';
import type { CommandView } from '../api/types';
import { expiresAtIso, isTerminal, newCommandId, pollCommand } from './commands';

const cmd = (status: CommandView['status'], extra: Partial<CommandView> = {}): CommandView => ({
  command_id: 'web-test-0001', type: 'relay', target_id: 'circuit-01', status, requested_state: 'on', reported_state: null,
  verification: 'unverified', error: null, expires_at: null, created_at: null, started_at: null, finished_at: null, actor: 'dev',
  source: 'api', mapping_revision: 1, driver_mode: 'mock', simulated: true, status_url: '/v1/commands/web-test-0001', ...extra,
});

describe('command helpers', () => {
  it('generates ids matching the server pattern', () => {
    const id = newCommandId();
    expect(id).toMatch(/^web-[A-Za-z0-9._:-]+$/);
    expect(id.length).toBeGreaterThanOrEqual(8);
    expect(id.length).toBeLessThanOrEqual(80);
    expect(newCommandId()).not.toBe(id);
  });
  it('expiresAtIso is now + seconds in ISO-8601 with timezone', () => {
    expect(expiresAtIso(60, Date.parse('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:01:00.000Z');
  });
  it('knows terminal statuses', () => {
    for (const s of ['succeeded', 'failed', 'expired', 'unknown']) expect(isTerminal(s)).toBe(true);
    for (const s of ['accepted', 'running']) expect(isTerminal(s)).toBe(false);
  });
});

describe('pollCommand', () => {
  it('polls until a terminal status and reports each update', async () => {
    const seq = [cmd('accepted'), cmd('running'), cmd('succeeded')];
    const fetchCommand = vi.fn(async () => seq.shift()!);
    const seen: string[] = [];
    const r = await pollCommand('web-test-0001', { intervalMs: 1, fetchCommand, onUpdate: (c) => seen.push(c.status) });
    expect(r.outcome).toBe('terminal');
    expect(r.command?.status).toBe('succeeded');
    expect(seen).toEqual(['accepted', 'running', 'succeeded']);
    expect(fetchCommand).toHaveBeenCalledTimes(3);
  });

  it('treats failed / expired / unknown as terminal and keeps the error', async () => {
    for (const s of ['failed', 'expired', 'unknown'] as const) {
      const r = await pollCommand('x', { intervalMs: 1, fetchCommand: async () => cmd(s, { error: { code: 'device_timeout', message: 'no response' } }) });
      expect(r.outcome).toBe('terminal');
      expect(r.command?.error?.code).toBe('device_timeout');
    }
  });

  it('tolerates transient errors but gives up after maxConsecutiveErrors without throwing', async () => {
    let n = 0;
    const fetchCommand = vi.fn(async () => {
      n += 1;
      if (n === 1) throw new Error('blip');
      if (n === 2) return cmd('running');
      throw new Error('down');
    });
    const r = await pollCommand('x', { intervalMs: 1, fetchCommand, maxConsecutiveErrors: 3 });
    expect(r.outcome).toBe('error');
    expect(r.command?.status).toBe('running'); // last known state is kept
  });

  it('times out when the command never finishes', async () => {
    const r = await pollCommand('x', { intervalMs: 5, maxMs: 30, fetchCommand: async () => cmd('running') });
    expect(r.outcome).toBe('timeout');
    expect(r.command?.status).toBe('running');
  });

  it('stops when aborted', async () => {
    const ac = new AbortController();
    const p = pollCommand('x', { intervalMs: 1000, signal: ac.signal, fetchCommand: async () => cmd('running') });
    setTimeout(() => ac.abort(), 10);
    const r = await p;
    expect(r.outcome).toBe('aborted');
  });
});
