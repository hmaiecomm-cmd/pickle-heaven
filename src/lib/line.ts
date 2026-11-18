import 'server-only'
import { formatMinute, formatDateFull } from './time'
import { ntd } from './utils'
import { isDemoTenant } from './db'
import { brand } from '@/config/site'

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'
/** LINE MINI App 服務訊息（需通過審核並預先註冊訊息模板） */
const LINE_SERVICE_MESSAGE_URL = 'https://api.line.me/message/v3/notifier/send?target=service'

export interface LineProfile {
  lineUserId: string
  displayName: string
  pictureUrl: string | null
  email: string | null
}

/**
 * 驗證 LIFF 前端傳來的 id_token。
 * 一律由伺服器向 LINE 驗證，絕不信任前端直接送來的 userId。
 */
export async function verifyLineIdToken(idToken: string): Promise<LineProfile> {
  const clientId = process.env.LINE_LOGIN_CHANNEL_ID || process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID
  if (!clientId) throw new Error('缺少 LINE_LOGIN_CHANNEL_ID 環境變數')

  const res = await fetch(LINE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LINE id_token 驗證失敗（${res.status}）${detail}`)
  }

  const data = (await res.json()) as {
    sub: string
    name?: string
    picture?: string
    email?: string
  }

  return {
    lineUserId: data.sub,
    displayName: data.name || 'LINE 使用者',
    pictureUrl: data.picture ?? null,
    email: data.email ?? null,
  }
}

/** 是否已設定 Messaging API 推播 */
export function canPush(): boolean {
  return Boolean(process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN)
}

/**
 * 以 Messaging API 推播訊息給使用者。
 * 需使用者已加入官方帳號好友；失敗僅記錄，不中斷訂單流程。
 */
export async function pushMessages(lineUserId: string, messages: unknown[]): Promise<boolean> {
  // 展示資料庫的會員都是虛構的：絕不呼叫真實的 LINE 推播
  if (await isDemoTenant()) {
    console.info('[line] 展示環境：推播僅模擬，未送出', { to: lineUserId.slice(0, 6) })
    return false
  }
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.warn('[line] 未設定 LINE_MESSAGING_CHANNEL_ACCESS_TOKEN，略過推播')
    return false
  }

  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: lineUserId, messages }),
    })
    if (!res.ok) {
      console.error('[line] 推播失敗', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[line] 推播例外', err)
    return false
  }
}

/**
 * 是否為官方帳號好友：Messaging API 只回傳好友（未封鎖）的個人資料，非好友回 404。
 * 不依賴瀏覽器的 LIFF 登入狀態，電腦瀏覽器也查得到。無法判斷時回傳 null。
 */
export async function isLineFriend(lineUserId: string): Promise<boolean | null> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  if (!token || (await isDemoTenant())) return null
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (res.ok) return true
    if (res.status === 404) return false
    console.error('[line] 查詢好友狀態失敗', res.status, await res.text().catch(() => ''))
    return null
  } catch (err) {
    console.error('[line] 查詢好友狀態例外', err)
    return null
  }
}

/**
 * LINE MINI App 服務訊息。
 * notificationToken 由前端 LIFF 於使用者完成動作後取得，
 * templateName 必須先在 LINE Developers 後台註冊並通過審核。
 * 未提供 token 時回傳 false，由呼叫端改用 Messaging API 推播。
 */
export async function sendServiceMessage(
  notificationToken: string | null | undefined,
  templateName: string,
  params: Record<string, string>,
): Promise<boolean> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  if (!notificationToken || !token) return false
  if (await isDemoTenant()) return false

  try {
    const res = await fetch(LINE_SERVICE_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ templateName, params, notificationToken }),
    })
    if (!res.ok) {
      console.error('[line] 服務訊息失敗', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[line] 服務訊息例外', err)
    return false
  }
}

export interface LineAccountStatus {
  configured: boolean
  /** Token 有效且查得到帳號 */
  connected: boolean
  displayName: string | null
  basicId: string | null
  pictureUrl: string | null
  followers: number | null
  blocks: number | null
  /** 群發實際會收到的人數（扣除封鎖等） */
  reachable: number | null
  /** 每月可推播則數；null 表示無上限 */
  quota: number | null
  usedThisMonth: number | null
}

/** 唯讀查詢官方帳號資訊與本月額度，供後台顯示連接狀態 */
export async function getLineAccountStatus(): Promise<LineAccountStatus> {
  const empty: LineAccountStatus = {
    configured: false,
    connected: false,
    displayName: null,
    basicId: null,
    pictureUrl: null,
    followers: null,
    blocks: null,
    reachable: null,
    quota: null,
    usedThisMonth: null,
  }
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  if (!token) return empty

  const get = async <T,>(path: string): Promise<T | null> => {
    try {
      const res = await fetch(`https://api.line.me${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      return res.ok ? ((await res.json()) as T) : null
    } catch {
      return null
    }
  }

  // 好友統計以前一天（台北時間）為準，當天資料 LINE 尚未產生
  const yesterday = new Date(Date.now() + 8 * 3600_000 - 86_400_000).toISOString().slice(0, 10).replace(/-/g, '')
  const [info, quota, usage, insight] = await Promise.all([
    get<{ basicId: string; displayName: string; pictureUrl?: string }>('/v2/bot/info'),
    get<{ type: 'none' | 'limited'; value?: number }>('/v2/bot/message/quota'),
    get<{ totalUsage: number }>('/v2/bot/message/quota/consumption'),
    get<{ status: string; followers?: number; blocks?: number; targetedReaches?: number }>(`/v2/bot/insight/followers?date=${yesterday}`),
  ])
  if (!info) return { ...empty, configured: true }

  return {
    configured: true,
    connected: true,
    displayName: info.displayName,
    basicId: info.basicId,
    pictureUrl: info.pictureUrl ?? null,
    followers: insight?.status === 'ready' ? (insight.followers ?? null) : null,
    blocks: insight?.status === 'ready' ? (insight.blocks ?? null) : null,
    reachable: insight?.status === 'ready' ? (insight.targetedReaches ?? null) : null,
    quota: quota?.type === 'limited' ? (quota.value ?? null) : null,
    usedThisMonth: usage?.totalUsage ?? null,
  }
}

export type LineSendTarget = { kind: 'broadcast' } | { kind: 'multicast'; to: string[] }

/**
 * 行銷訊息：broadcast 發給全部好友，multicast 發給指定名單（每次最多 500 人）。
 * 每次請求帶 X-Line-Retry-Key，網路重試時 LINE 不會重複發送。
 */
export async function sendLineMarketing(
  target: LineSendTarget,
  messages: unknown[],
): Promise<{ sent: number; failed: number; error: string | null }> {
  if (await isDemoTenant()) return { sent: 0, failed: 0, error: '展示環境不會實際發送 LINE 訊息' }
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  if (!token) return { sent: 0, failed: 0, error: '尚未設定 LINE_MESSAGING_CHANNEL_ACCESS_TOKEN' }

  const post = async (path: string, body: unknown): Promise<string | null> => {
    try {
      const res = await fetch(`https://api.line.me${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Line-Retry-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      })
      if (res.ok) return null
      const detail = await res.text().catch(() => '')
      console.error('[line] 行銷訊息失敗', path, res.status, detail)
      return `LINE 回應 ${res.status}${detail ? `：${detail.slice(0, 200)}` : ''}`
    } catch (err) {
      console.error('[line] 行銷訊息例外', err)
      return err instanceof Error ? err.message : '連線失敗'
    }
  }

  if (target.kind === 'broadcast') {
    const error = await post('/v2/bot/message/broadcast', { messages })
    return { sent: error ? 0 : 1, failed: error ? 1 : 0, error }
  }

  let sent = 0
  let failed = 0
  let error: string | null = null
  for (let i = 0; i < target.to.length; i += 500) {
    const chunk = target.to.slice(i, i + 500)
    const err = await post('/v2/bot/message/multicast', { to: chunk, messages })
    if (err) {
      failed += chunk.length
      error = err
    } else {
      sent += chunk.length
    }
  }
  return { sent, failed, error }
}

export interface BookingNotifyPayload {
  code: string
  venueName: string
  venueAddress: string
  playDate: string
  items: { courtName: string; startMinute: number; endMinute: number }[]
  total: number
  bookingId: string
}

/** 訂單詳情連結：優先使用 LIFF 深連結，可於 LINE 內直接開啟 */
export function bookingLink(bookingId: string): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return liffId ? `https://liff.line.me/${liffId}/bookings/${bookingId}` : `${appUrl}/bookings/${bookingId}`
}

/** 訂單成立的 Flex Message */
export function buildBookingFlex(b: BookingNotifyPayload) {
  const slotLines = b.items.map((it) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: it.courtName, size: 'sm', color: '#505b70', flex: 3 },
      {
        type: 'text',
        text: `${formatMinute(it.startMinute)}–${formatMinute(it.endMinute)}`,
        size: 'sm',
        color: '#0e1726',
        align: 'end',
        flex: 4,
      },
    ],
  }))

  return {
    type: 'flex',
    altText: `【${brand.name}】訂單 ${b.code} 已成立`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#6941A5',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '預約成功', color: '#ffffff', weight: 'bold', size: 'lg' },
          { type: 'text', text: `訂單編號 ${b.code}`, color: '#EEE6FA', size: 'xs', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: b.venueName, weight: 'bold', size: 'md', color: '#0e1726' },
          { type: 'text', text: b.venueAddress, size: 'xs', color: '#8591a6', wrap: true },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: formatDateFull(b.playDate), weight: 'bold', size: 'sm', color: '#0e1726', margin: 'md' },
          { type: 'box', layout: 'vertical', spacing: 'xs', margin: 'sm', contents: slotLines },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: '實付金額', size: 'sm', color: '#505b70' },
              { type: 'text', text: ntd(b.total), size: 'sm', weight: 'bold', color: '#6941A5', align: 'end' },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#6941A5',
            height: 'sm',
            action: { type: 'uri', label: '查看預約詳情', uri: bookingLink(b.bookingId) },
          },
        ],
      },
    },
  }
}

/** 送出「訂單成立」通知：先試服務訊息，退回 Messaging API 推播；回傳是否成功 */
export async function notifyBookingConfirmed(
  lineUserId: string | null,
  payload: BookingNotifyPayload,
  notificationToken?: string | null,
): Promise<boolean> {
  if (!lineUserId) return false

  const viaService = await sendServiceMessage(notificationToken, 'booking_confirmed', {
    code: payload.code,
    venue: payload.venueName,
    date: payload.playDate,
  })
  if (viaService) return true

  const ok = await pushMessages(lineUserId, [buildBookingFlex(payload)])
  return ok
}

/** 取消通知 */
export async function notifyBookingCancelled(
  lineUserId: string | null,
  code: string,
  refundPoints: number,
): Promise<void> {
  if (!lineUserId) return
  const text =
    refundPoints > 0
      ? `【${brand.name}】訂單 ${code} 已取消，已回補 ${refundPoints} 點至您的帳戶，可於下次預約折抵。`
      : `【${brand.name}】訂單 ${code} 已取消。依取消政策本次不予退款，如有疑問請洽櫃台。`
  await pushMessages(lineUserId, [{ type: 'text', text }])
}
