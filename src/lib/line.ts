import 'server-only'
import { formatMinute, formatDateFull } from './time'
import { ntd } from './utils'
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
        backgroundColor: '#0fa36b',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '預約成功', color: '#ffffff', weight: 'bold', size: 'lg' },
          { type: 'text', text: `訂單編號 ${b.code}`, color: '#d1fae5', size: 'xs', margin: 'sm' },
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
              { type: 'text', text: ntd(b.total), size: 'sm', weight: 'bold', color: '#0fa36b', align: 'end' },
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
            color: '#0fa36b',
            height: 'sm',
            action: { type: 'uri', label: '查看預約詳情', uri: bookingLink(b.bookingId) },
          },
          {
            type: 'text',
            text: '請於開打前 10 分鐘至櫃台報到',
            size: 'xxs',
            color: '#8591a6',
            align: 'center',
            margin: 'md',
          },
        ],
      },
    },
  }
}

/** 送出「訂單成立」通知：先試服務訊息，退回 Messaging API 推播 */
export async function notifyBookingConfirmed(
  lineUserId: string | null,
  payload: BookingNotifyPayload,
  notificationToken?: string | null,
): Promise<void> {
  if (!lineUserId) return

  const viaService = await sendServiceMessage(notificationToken, 'booking_confirmed', {
    code: payload.code,
    venue: payload.venueName,
    date: payload.playDate,
  })
  if (viaService) return

  await pushMessages(lineUserId, [buildBookingFlex(payload)])
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
