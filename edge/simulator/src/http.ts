import { signRequest } from '../../../packages/iot-contract/src/index'

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export class NetworkDownError extends Error {}

/** 簽章後送出 JSON 請求（場館與平台兩種身分共用） */
export async function signedFetch(opts: {
  baseUrl: string
  keyId: string
  secret: string
  method: string
  path: string
  body?: unknown
  headers?: Record<string, string>
  /** 故障注入：竄改簽章、時鐘偏移、重送同一個 nonce */
  tamper?: { badSignature?: boolean; skewMs?: number; nonce?: string }
  timeoutMs?: number
  signal?: AbortSignal
  /** 成功時不解析 JSON（下載 log 原文用） */
  raw?: boolean
}): Promise<{ status: number; json: any; text: string; headers: Headers }> {
  const binary = opts.body instanceof Uint8Array
  const body: string | Uint8Array = opts.body === undefined ? '' : binary ? (opts.body as Uint8Array) : JSON.stringify(opts.body)
  const h = signRequest({
    keyId: opts.keyId,
    secret: opts.tamper?.badSignature ? `${opts.secret}x` : opts.secret,
    method: opts.method,
    pathWithQuery: opts.path,
    body,
    now: Date.now() + (opts.tamper?.skewMs ?? 0),
    nonce: opts.tamper?.nonce,
  })
  const res = await fetch(opts.baseUrl + opts.path, {
    method: opts.method,
    headers: { ...(binary ? { 'content-type': 'video/mp2t' } : body ? { 'content-type': 'application/json' } : {}), ...h, ...opts.headers },
    body: binary ? (body as Uint8Array) : (body as string) || undefined,
    signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 40_000),
  })
  const text = res.status === 304 ? '' : await res.text()
  const json = text && !(opts.raw && res.status < 400) ? JSON.parse(text) : null
  if (res.status >= 400) throw new HttpStatusError(res.status, json?.error?.code ?? 'HTTP', json?.error?.message ?? `HTTP ${res.status}`)
  return { status: res.status, json, text, headers: res.headers }
}
