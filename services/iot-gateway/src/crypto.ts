import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/** 場館計畫含門禁明碼，存進資料庫前以 AES-256-GCM 加密。格式：iv.tag.ciphertext（base64url） */
export function encryptJson(keyB64: string, value: unknown): string {
  const key = Buffer.from(keyB64, 'base64')
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()])
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64url')).join('.')
}

export function decryptJson<T>(keyB64: string, payload: string): T {
  const [iv, tag, body] = payload.split('.').map((s) => Buffer.from(s, 'base64url'))
  const d = createDecipheriv('aes-256-gcm', Buffer.from(keyB64, 'base64'), iv)
  d.setAuthTag(tag)
  return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString('utf8')) as T
}

/** 計畫內容指紋（不含 generatedAt / rev），內容沒變就不遞增版本 */
export function planHash(plan: Record<string, unknown>): string {
  const { generatedAt: _g, rev: _r, ...rest } = plan
  return createHash('sha256').update(stableStringify(rest)).digest('hex')
}

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}
