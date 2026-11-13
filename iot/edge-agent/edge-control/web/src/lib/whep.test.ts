import { describe, expect, it, vi } from 'vitest';
import { whepConnect, WhepError, waitForIceGathering } from './whep';

type Listener = (ev: Event) => void;

class FakePc {
  iceGatheringState: RTCIceGatheringState = 'new';
  connectionState: RTCPeerConnectionState = 'new';
  localDescription: { type: string; sdp: string } | null = null;
  remote: { type: string; sdp: string } | null = null;
  closed = false;
  transceivers: Array<[string, unknown]> = [];
  listeners = new Map<string, Listener[]>();
  config: RTCConfiguration;
  constructor(config: RTCConfiguration, private autoComplete = true) {
    this.config = config;
  }
  addEventListener(t: string, l: Listener) {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), l]);
  }
  removeEventListener(t: string, l: Listener) {
    this.listeners.set(t, (this.listeners.get(t) ?? []).filter((x) => x !== l));
  }
  emit(t: string) {
    for (const l of this.listeners.get(t) ?? []) l(new Event(t));
  }
  addTransceiver(kind: string, init: unknown) {
    this.transceivers.push([kind, init]);
  }
  async createOffer() {
    return { type: 'offer', sdp: 'v=0\r\no=offer' };
  }
  async setLocalDescription(d: { type: string; sdp: string }) {
    this.localDescription = d;
    if (this.autoComplete) {
      this.iceGatheringState = 'complete';
    }
  }
  async setRemoteDescription(d: { type: string; sdp: string }) {
    this.remote = d;
  }
  close() {
    this.closed = true;
  }
}

const asPc = (p: FakePc) => p as unknown as RTCPeerConnection;

function resp(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

describe('whepConnect', () => {
  it('posts the offer as application/sdp with the media bearer token and applies the answer', async () => {
    let pc!: FakePc;
    const fetchImpl = vi.fn(async () => resp(201, 'v=0\r\no=answer', { Location: '/media/cam/whep/abc' }));
    const conn = await whepConnect({
      url: 'http://gw.local:8889/cam-01/whep',
      token: 'media-token-1',
      iceServers: [{ urls: 'stun:stun.example:3478' }],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      createPeerConnection: (c) => {
        pc = new FakePc(c);
        return asPc(pc);
      },
    });
    expect(pc.config.iceServers).toEqual([{ urls: 'stun:stun.example:3478' }]);
    expect(pc.transceivers).toEqual([['video', { direction: 'recvonly' }]]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://gw.local:8889/cam-01/whep');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('v=0\r\no=offer');
    const h = init.headers as Record<string, string>;
    expect(h['Content-Type']).toBe('application/sdp');
    expect(h.Authorization).toBe('Bearer media-token-1');
    expect(pc.remote).toEqual({ type: 'answer', sdp: 'v=0\r\no=answer' });
    expect(conn.resourceUrl).toBe('http://gw.local:8889/media/cam/whep/abc');
  });

  it('close() closes the peer connection and DELETEs the WHEP resource', async () => {
    let pc!: FakePc;
    const fetchImpl = vi.fn(async (_u: string, init?: RequestInit) =>
      init?.method === 'DELETE' ? resp(200, '') : resp(201, 'v=0\r\nanswer', { Location: 'http://gw/res/1' }));
    const conn = await whepConnect({
      url: 'http://gw/x/whep', token: 't', fetchImpl: fetchImpl as unknown as typeof fetch,
      createPeerConnection: (c) => ((pc = new FakePc(c)), asPc(pc)),
    });
    await conn.close();
    await conn.close(); // idempotent
    expect(pc.closed).toBe(true);
    const dels = fetchImpl.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'DELETE');
    expect(dels).toHaveLength(1);
    expect(dels[0][0]).toBe('http://gw/res/1');
    expect(((dels[0][1] as RequestInit).headers as Record<string, string>).Authorization).toBe('Bearer t');
  });

  it('maps HTTP failures to stable WhepError codes and cleans up', async () => {
    let pc!: FakePc;
    const mk = (status: number) =>
      whepConnect({
        url: 'http://gw/x/whep', token: 't',
        fetchImpl: (async () => resp(status, 'nope')) as unknown as typeof fetch,
        createPeerConnection: (c) => ((pc = new FakePc(c)), asPc(pc)),
      });
    await expect(mk(401)).rejects.toMatchObject({ code: 'whep_unauthorized', status: 401 });
    expect(pc.closed).toBe(true);
    await expect(mk(404)).rejects.toMatchObject({ code: 'whep_not_found' });
    await expect(mk(500)).rejects.toMatchObject({ code: 'whep_http_500' });
  });

  it('rejects an answer that is not an SDP and a network failure', async () => {
    await expect(
      whepConnect({
        url: 'http://gw/x/whep', token: 't',
        fetchImpl: (async () => resp(201, '<html>oops</html>')) as unknown as typeof fetch,
        createPeerConnection: (c) => asPc(new FakePc(c)),
      }),
    ).rejects.toBeInstanceOf(WhepError);
    await expect(
      whepConnect({
        url: 'http://gw/x/whep', token: 't',
        fetchImpl: (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch,
        createPeerConnection: (c) => asPc(new FakePc(c)),
      }),
    ).rejects.toMatchObject({ code: 'whep_network' });
  });

  it('requires url and token', async () => {
    await expect(whepConnect({ url: '', token: '' })).rejects.toMatchObject({ code: 'whep_missing_playback' });
  });

  it('does not wait longer than gatherTimeoutMs for ICE gathering', async () => {
    const pc = new FakePc({}, false);
    const t0 = Date.now();
    await waitForIceGathering(asPc(pc), 30);
    expect(Date.now() - t0).toBeLessThan(500);
    // resolves immediately when already complete
    pc.iceGatheringState = 'complete';
    await waitForIceGathering(asPc(pc), 10_000);
  });

  it('forwards connection state changes', async () => {
    let pc!: FakePc;
    const states: string[] = [];
    await whepConnect({
      url: 'http://gw/x/whep', token: 't', onConnectionState: (s) => states.push(s),
      fetchImpl: (async () => resp(201, 'v=0\r\nx')) as unknown as typeof fetch,
      createPeerConnection: (c) => ((pc = new FakePc(c)), asPc(pc)),
    });
    pc.connectionState = 'connected';
    pc.emit('connectionstatechange');
    expect(states).toEqual(['connected']);
  });
});
