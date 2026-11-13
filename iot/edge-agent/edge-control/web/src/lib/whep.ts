// Minimal WHEP (WebRTC-HTTP Egress Protocol) client for MediaMTX.
// The bearer token passed here is the short-lived per-session MEDIA token (not the admin token) and is only
// kept in memory.

export class WhepError extends Error {
  code: string;
  status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'WhepError';
    this.code = code;
    this.status = status;
  }
}

export interface WhepOptions {
  url: string;
  token: string;
  iceServers?: RTCIceServer[];
  /** wait at most this long for ICE gathering to complete (default 2000ms) */
  gatherTimeoutMs?: number;
  signal?: AbortSignal;
  onTrack?: (stream: MediaStream) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
  /** injectable for tests */
  fetchImpl?: typeof fetch;
  createPeerConnection?: (config: RTCConfiguration) => RTCPeerConnection;
}

export interface WhepConnection {
  pc: RTCPeerConnection;
  /** absolute URL of the WHEP resource (from the Location header), if the server provided one */
  resourceUrl: string | null;
  /** close the peer connection and DELETE the WHEP resource (best effort, never throws) */
  close: () => Promise<void>;
}

export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

function resolveLocation(base: string, location: string | null): string | null {
  if (!location) return null;
  try {
    const origin = typeof window !== 'undefined' ? window.location.href : undefined;
    return new URL(location, new URL(base, origin)).toString();
  } catch {
    return null;
  }
}

/** Exchange the SDP offer/answer with a WHEP endpoint. Throws WhepError with a stable `code`. */
export async function whepConnect(opts: WhepOptions): Promise<WhepConnection> {
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const makePc = opts.createPeerConnection ?? ((c: RTCConfiguration) => new RTCPeerConnection(c));
  if (!opts.url || !opts.token) throw new WhepError('whep_missing_playback', '伺服器未提供播放位址或權杖');

  const pc = makePc({ iceServers: opts.iceServers ?? [] });
  let resourceUrl: string | null = null;
  let closed = false;

  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      pc.close();
    } catch {
      /* ignore */
    }
    if (resourceUrl) {
      try {
        await doFetch(resourceUrl, { method: 'DELETE', headers: { Authorization: `Bearer ${opts.token}` } });
      } catch {
        /* best effort */
      }
    }
  };

  try {
    pc.addEventListener('connectionstatechange', () => opts.onConnectionState?.(pc.connectionState));
    pc.addEventListener('track', (ev: Event) => {
      const e = ev as RTCTrackEvent;
      const stream = e.streams?.[0] ?? new MediaStream([e.track]);
      opts.onTrack?.(stream);
    });

    pc.addTransceiver('video', { direction: 'recvonly' });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc, opts.gatherTimeoutMs ?? 2000);
    if (opts.signal?.aborted) throw new WhepError('aborted', '已取消');
    const sdp = pc.localDescription?.sdp;
    if (!sdp) throw new WhepError('whep_no_offer', '無法產生 WebRTC offer');

    let res: Response;
    try {
      res = await doFetch(opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', Authorization: `Bearer ${opts.token}` },
        body: sdp,
        signal: opts.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw new WhepError('aborted', '已取消');
      throw new WhepError('whep_network', '無法連線到媒體閘道（WHEP）');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new WhepError('whep_unauthorized', '媒體權杖被拒絕（可能已過期）', res.status);
      }
      if (res.status === 404) throw new WhepError('whep_not_found', '媒體路徑不存在或串流尚未就緒', res.status);
      throw new WhepError('whep_http_' + res.status, `媒體閘道回應 ${res.status}${body ? '：' + body.slice(0, 120) : ''}`, res.status);
    }
    resourceUrl = resolveLocation(opts.url, res.headers.get('Location'));
    const answer = await res.text();
    if (!answer.trim().startsWith('v=0')) throw new WhepError('whep_bad_answer', '媒體閘道回傳的 SDP answer 格式不正確');
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    return { pc, resourceUrl, close };
  } catch (e) {
    await close();
    if (e instanceof WhepError) throw e;
    throw new WhepError('whep_failed', e instanceof Error ? e.message : String(e));
  }
}
