import 'server-only'
import { prisma } from '@/lib/db'
import { can, type AdminRole } from '@/lib/admin-permissions'
import { listOrders, PAYMENT_STATUS, REFUND_STATUS } from './admin-orders'
import { getUpcomingSessions } from './activity-service'
import { getRefundOptions } from './refund-service'
import { detectIncidents, getMonitorSnapshot, listIncidents } from './monitor-service'

/**
 * AI 助理的「快捷查詢」與共用查詢工具。
 * 每個查詢都直接讀系統資料（依登入者的資料範圍），附來源連結與查詢時間；
 * 在伺服器端依角色檢查權限，與手動操作相同。
 */

export interface AiContextInput {
  path?: string
  section?: string | null
  venueId?: string
  selection?: { type: string; id: string; label: string } | null
  filters?: string | null
}

export interface QuickReply {
  reply: string
  cards?: unknown[]
  sources?: { label: string; href: string }[]
  queriedAt: string
  mode: 'quick' | 'model' | 'unavailable'
  expect?: 'find' | null
  actions?: { title: string; items: string[]; impact: string }[]
}

const ts = () => new Date().toISOString()

export class AiContextError extends Error {}

/** 核對前端送來的脈絡：場館必須是目前資料範圍的場館，選取的訂單必須存在 */
export async function verifyContext(ctx: AiContextInput) {
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } })
  if (ctx.venueId && venue && ctx.venueId !== venue.id) {
    throw new AiContextError('場館已切換，請重新整理頁面後再問一次（不會沿用先前的脈絡）')
  }
  let booking: { id: string; code: string } | null = null
  if (ctx.selection?.type === 'booking') {
    booking = await prisma.booking.findUnique({ where: { id: ctx.selection.id }, select: { id: true, code: true } })
    if (!booking) throw new AiContextError('找不到目前選取的訂單（可能已切換場館或資料已變更），請重新選取')
  }
  return { venue, booking }
}

export async function runQuick(kind: string, query: string | undefined, ctx: AiContextInput, role: AdminRole): Promise<QuickReply> {
  const { booking } = await verifyContext(ctx)
  switch (kind) {
    case 'incidents': {
      if (!can(role, 'monitor')) return deny('場地監測與異常')
      await detectIncidents()
      const rows = await listIncidents('OPEN', 10)
      const snap = await getMonitorSnapshot()
      const deviceNote =
        snap?.integration.mode === 'NOT_CONNECTED'
          ? '設備（門禁、燈光、感測器）尚未串接，無法判斷現場設備狀態。'
          : snap
            ? `設備離線 ${snap.counts.offline} 台、狀態未知 ${snap.counts.unknown} 台（模擬設備）。`
            : ''
      return {
        reply: rows.length === 0 ? `目前沒有待處理的異常事件。${deviceNote}` : `目前有 ${rows.length} 件待處理事件，依嚴重程度排列。${deviceNote}`,
        cards: rows.length
          ? [{ kind: 'incidents', title: '待處理事件', items: rows.map((r) => ({ id: r.id, severity: r.severity, title: r.title, detail: r.detail, href: r.link })) }]
          : [],
        sources: [{ label: '異常警示與處理紀錄', href: '/admin/incidents' }, { label: '場地即時監測', href: '/admin/monitor' }],
        queriedAt: ts(),
        mode: 'quick',
      }
    }
    case 'find': {
      if (!can(role, 'bookings')) return deny('交易查詢')
      if (!query?.trim() || query.trim() === '幫我找客人的預約') {
        return { reply: '請輸入客人的姓名、電話、Email 或訂單編號，我會在訂場與活動訂單中搜尋。', queriedAt: ts(), mode: 'quick', expect: 'find' }
      }
      const res = await listOrders({ q: query.trim(), sort: 'created_desc', pageSize: 10 })
      const href = `/admin/bookings?q=${encodeURIComponent(query.trim())}`
      return {
        reply: res.total === 0 ? `找不到符合「${query.trim()}」的訂單。` : `找到 ${res.total} 筆符合「${query.trim()}」的訂單${res.total > 10 ? '，以下列出最新 10 筆' : ''}。同名客人不一定是同一人，請以電話末碼與會員編號確認。`,
        cards: res.rows.length
          ? [
              {
                kind: 'orders',
                title: '訂單',
                items: res.rows.map((r) => ({
                  id: r.id,
                  code: r.code,
                  name: r.customer.name,
                  phone: r.customer.phone,
                  playDate: r.playDate,
                  total: r.total,
                  payment: PAYMENT_STATUS[r.paymentStatus],
                  refund: REFUND_STATUS[r.refundStatus],
                  href: `/admin/bookings?order=${r.id}`,
                })),
              },
            ]
          : [],
        sources: [{ label: '在交易管理開啟這個搜尋', href }],
        queriedAt: res.queriedAt,
        mode: 'quick',
      }
    }
    case 'open_sessions': {
      if (!can(role, 'activities')) return deny('活動')
      const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
      const sessions = venue ? await getUpcomingSessions(venue.id, null, { days: 21, limit: 40 }) : []
      const open = sessions.filter((s) => s.remaining > 0 && (s.state === 'OPEN' || s.state === 'NOT_OPEN'))
      return {
        reply: open.length === 0 ? '未來三週沒有還有名額的活動場次。' : `未來三週有 ${open.length} 場還有名額（含尚未開放報名的場次）。`,
        cards: open.length
          ? [{ kind: 'sessions', title: '有名額的場次', items: open.slice(0, 12).map((s) => ({ id: s.id, title: `${s.title}${s.state === 'NOT_OPEN' ? '（尚未開放）' : ''}`, date: s.dateLabel, time: s.timeLabel, remaining: s.remaining, capacity: s.capacity, href: `/admin/sessions/${s.id}` })) }]
          : [],
        sources: [{ label: '場次與週期安排', href: '/admin/sessions' }],
        queriedAt: ts(),
        mode: 'quick',
      }
    }
    case 'howto_weekly':
      return {
        reply: '新增每週固定活動的步驟如下。發布前一定要先預覽，系統會列出每一場的日期、場地與衝突。',
        cards: [
          {
            kind: 'steps',
            title: '新增每週固定活動',
            steps: [
              '到「活動管理／活動列表」按「新增活動」，填寫名稱、類型、介紹與封面。',
              '設定費用、計價單位與名額上限。',
              '在「場次排程」選「每週重複」，勾選星期、每隔幾週，以及結束日期或重複次數（一次最多 60 場）。',
              '選擇開始與結束時間、使用場地，需要時加入跳過日期（例如休館日）。',
              '按「預覽場次」，處理衝突：改時段、換場地，或勾選排除衝突日期。',
              '確認後按「發布」，每個日期會建立獨立場次、名額與訂單，並同步到前台預約表。',
            ],
            href: '/admin/activities/new',
            linkLabel: '前往新增活動',
          },
        ],
        sources: [{ label: '活動列表', href: '/admin/activities' }],
        queriedAt: ts(),
        mode: 'quick',
      }
    case 'refundable': {
      if (!can(role, 'refund')) return deny('退款')
      if (!booking) {
        return { reply: '請先在「交易管理」點開一筆訂單，再問我這筆訂單可以退哪些項目。', queriedAt: ts(), mode: 'quick' }
      }
      const opt = await getRefundOptions(booking.id)
      const anyRefundable = opt.items.some((i) => !i.blocked)
      return {
        reply: anyRefundable
          ? `訂單 ${opt.code} 可退款的項目如下。金額已依折扣與點數分攤並扣除已退部分；${opt.simulated ? '這筆款項使用模擬金流，退款只會產生模擬結果。' : '原路退款需等金流回覆成功才算完成。'}`
          : `訂單 ${opt.code} 目前沒有可退款的項目。`,
        cards: [
          {
            kind: 'refund',
            title: `訂單 ${opt.code} 可退項目`,
            code: opt.code,
            href: `/admin/bookings?order=${booking.id}&refund=1`,
            note: opt.note,
            items: opt.items.map((i) => ({ label: `${i.label}（${i.detail}）`, cash: i.refundableCash, points: i.refundablePoints, blocked: i.blocked })),
          },
        ],
        sources: [{ label: `訂單 ${opt.code}`, href: `/admin/bookings?order=${booking.id}` }],
        queriedAt: ts(),
        mode: 'quick',
      }
    }
    case 'devices': {
      if (!can(role, 'monitor')) return deny('場地監測')
      const snap = await getMonitorSnapshot()
      if (!snap) return { reply: '尚未建立場館。', queriedAt: ts(), mode: 'quick' }
      return {
        reply: snap.integration.mode === 'NOT_CONNECTED' ? `設備尚未串接：${snap.integration.reason}。以下使用狀態依預約推估，不是現場偵測。` : '以下為模擬設備的狀態（展示環境）。',
        cards: [
          {
            kind: 'devices',
            title: '場地狀態',
            href: '/admin/monitor',
            items: snap.courts.map((c) => ({
              court: c.name,
              usage: c.usage ? `${c.usage.label}（依預約推估）` : '目前無預約',
              sensor: { NOT_CONNECTED: '尚未串接', OCCUPIED: '偵測到有人', EMPTY: '未偵測到人', UNKNOWN: '狀態未知' }[c.sensor.state],
              devices: c.devices.length ? c.devices.map((d) => `${d.typeLabel}${{ NOT_CONNECTED: '未串接', ONLINE: '在線', OFFLINE: '離線', UNKNOWN: '未知' }[d.state]}`).join('、') : '無',
            })),
          },
        ],
        sources: [{ label: '場地即時監測', href: '/admin/monitor' }],
        queriedAt: snap.generatedAt,
        mode: 'quick',
      }
    }
    default:
      return { reply: '不支援這個快捷查詢。', queriedAt: ts(), mode: 'quick' }
  }
}

function deny(what: string): QuickReply {
  return { reply: `目前帳號沒有「${what}」的權限，無法查詢。`, queriedAt: ts(), mode: 'quick' }
}

/** 沒有設定 AI 模型時，依關鍵字導向對應的快捷查詢；判斷不了就說明可用範圍，不猜答案 */
export function routeWithoutModel(text: string): string | null {
  const t = text.replace(/\s/g, '')
  if (/異常|警示|事件|告警/.test(t)) return 'incidents'
  if (/名額|還有.*位|空位/.test(t)) return 'open_sessions'
  if (/每週|週期|固定活動|新增活動/.test(t)) return 'howto_weekly'
  if (/退款|可以退|退哪/.test(t)) return 'refundable'
  if (/設備|門禁|燈|監測|感測/.test(t)) return 'devices'
  if (/^(PH-?\d{8}-?[A-Z0-9]{4}|09\d{8}|\S+@\S+)$/i.test(t)) return 'find'
  return null
}
