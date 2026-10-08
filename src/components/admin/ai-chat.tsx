'use client'

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, RotateCcw, Send, Square, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAi } from './ai-context'

export const ASSISTANT_NAME = '小P｜AI 營運助理'
export const ASSISTANT_AVATAR = '/images/admin/xiaopi-avatar-v2.webp'

/* ─────────────────────────── 型別 ─────────────────────────── */

export type AiCard =
  | { kind: 'orders'; title: string; items: { id: string; code: string; name: string; phone: string; playDate: string; total: number; payment: string; refund: string; href: string }[] }
  | { kind: 'sessions'; title: string; items: { id: string; title: string; date: string; time: string; remaining: number; capacity: number; href: string }[] }
  | { kind: 'incidents'; title: string; items: { id: string; severity: string; title: string; detail: string | null; href: string | null }[] }
  | { kind: 'refund'; title: string; code: string; href: string; items: { label: string; cash: number; points: number; blocked: string | null }[]; note: string | null }
  | { kind: 'steps'; title: string; steps: string[]; href: string; linkLabel: string }
  | { kind: 'devices'; title: string; items: { court: string; usage: string; sensor: string; devices: string }[]; href: string }
  | { kind: 'guide'; title: string; links: { label: string; href: string | null; state: string | null }[] }
  | { kind: 'faq'; title: string; items: { id: string; question: string }[] }

export interface AiReply {
  reply: string
  cards?: AiCard[]
  sources?: { label: string; href: string }[]
  queriedAt?: string
  mode: 'quick' | 'model' | 'unavailable' | 'guide'
  /** 伺服器給的標示：操作指南／即時查詢／展示範例／AI 回答 */
  label?: string
  demo?: boolean
  actions?: { title: string; items: string[]; impact: string }[]
  /** 下一則使用者訊息要當成什麼快捷查詢的輸入 */
  expect?: 'find' | null
}

interface Msg extends Partial<AiReply> {
  id: string
  role: 'user' | 'assistant'
  text: string
  error?: boolean
}

const QUICK: { key: string; label: string }[] = [
  { key: 'incidents', label: '今天有哪些異常？' },
  { key: 'find', label: '幫我找客人的預約' },
  { key: 'open_sessions', label: '哪些活動還有名額？' },
  { key: 'refundable', label: '這筆訂單可以退哪些項目？' },
  { key: 'faq', label: '操作指南' },
]

const uid = () => Math.random().toString(36).slice(2, 10)

/** 操作指南題目（與伺服器 ai-guide.ts 同步；內容由伺服器提供） */
const FAQ: { id: string; question: string }[] = [
  { id: 'new_session', question: '如何新增球敘活動？' },
  { id: 'slot_blocked', question: '為什麼某個時段不能預約？' },
  { id: 'weekly', question: '如何設定每週固定活動？' },
  { id: 'modify_booking', question: '如何修改客人的預約？' },
  { id: 'complaint', question: '工作人員如何處理客訴？' },
  { id: 'devices', question: '如何查看門是否關好、燈是否關閉？' },
  { id: 'topup_how', question: '客人如何購買點數？' },
  { id: 'topup_missing', question: '付款了但點數沒增加怎麼辦？' },
  { id: 'expense', question: '如何登錄支出收據？' },
  { id: 'finance_hidden', question: '為什麼我看不到財務報表？' },
  { id: 'courts', question: '本館有幾面球場？' },
  { id: 'staff_account', question: '如何建立工作人員帳號？' },
]

/* ─────────────────────────── 元件 ─────────────────────────── */

export function Avatar({ size = 34 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ASSISTANT_AVATAR}
      alt="小P（AI 助理頭像，虛構角色）"
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover ring-1 ring-black/10"
      style={{ width: size, height: size }}
    />
  )
}

export function AiChat({ onClose, compact = false }: { onClose?: () => void; compact?: boolean }) {
  const { context, dismissed, dismiss, consumePrompt, pendingPrompt } = useAi()
  const storageKey = `ph-ai-chat:${context.tenant}:${context.venueId}`
  const [messages, setMessages] = React.useState<Msg[]>([])
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [expect, setExpect] = React.useState<'find' | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const lastRequest = React.useRef<{ text: string; quick?: string } | null>(null)

  // 對話依「資料範圍＋場館」分開保存，切換後不會看到別處的紀錄；讀回之前不寫入，避免以空白覆蓋既有紀錄
  const [loaded, setLoaded] = React.useState(false)
  React.useEffect(() => {
    setLoaded(false)
    try {
      const raw = sessionStorage.getItem(storageKey)
      setMessages(raw ? JSON.parse(raw) : [])
    } catch {
      setMessages([])
    }
    setExpect(null)
    setLoaded(true)
  }, [storageKey])
  React.useEffect(() => {
    if (!loaded) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)))
    } catch {}
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, storageKey, loaded])

  const send = React.useCallback(
    async (text: string, quick?: string) => {
      const clean = text.trim()
      if (!clean || busy) return
      if (quick === 'faq') {
        setMessages((m) => [...m, { id: uid(), role: 'assistant', text: '這些是不需要查即時資料的操作指南，點一題即可：', mode: 'guide', label: '操作指南', cards: [{ kind: 'faq', title: '操作指南', items: FAQ }] }])
        return
      }
      const mode = quick ?? (expect === 'find' ? 'find' : undefined)
      lastRequest.current = { text: clean, quick: mode }
      const userMsg: Msg = { id: uid(), role: 'user', text: clean }
      const history = [...messages, userMsg]
      setMessages(history)
      setInput('')
      setBusy(true)
      setExpect(null)
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await fetch('/api/admin/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })).slice(-16),
            quick: mode,
            query: mode === 'find' && !quick ? clean : undefined,
            context: {
              path: context.path,
              section: dismissed.section ? null : context.section,
              venueId: context.venueId,
              selection: dismissed.selection ? null : context.selection,
              filters: dismissed.filters ? null : context.filters,
            },
          }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          setMessages((m) => [...m, { id: uid(), role: 'assistant', text: json?.error?.message ?? 'AI 助理暫時無法回應，請稍後再試。', error: true }])
          return
        }
        const data = json.data as AiReply
        setMessages((m) => [...m, { id: uid(), role: 'assistant', text: data.reply, ...data }])
        setExpect(data.expect ?? null)
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError'
        setMessages((m) => [...m, { id: uid(), role: 'assistant', text: aborted ? '已停止。' : '連線中斷，請重試。', error: !aborted }])
      } finally {
        setBusy(false)
        abortRef.current = null
      }
    },
    [busy, context, dismissed, expect, messages],
  )

  // 其他頁面請助理代問
  React.useEffect(() => {
    if (pendingPrompt && !busy) {
      const p = consumePrompt()
      if (p) void send(p)
    }
  }, [pendingPrompt, busy, consumePrompt, send])

  const retry = () => {
    const last = lastRequest.current
    if (!last) return
    setMessages((m) => {
      const copy = [...m]
      while (copy.length && copy[copy.length - 1].role === 'assistant') copy.pop()
      if (copy.length && copy[copy.length - 1].role === 'user') copy.pop()
      return copy
    })
    setTimeout(() => void send(last.text, last.quick), 0)
  }

  const tags = [
    !dismissed.section && { k: 'section' as const, label: `目前：${context.section}` },
    !dismissed.selection && context.selection && { k: 'selection' as const, label: `已選取：${context.selection.label}` },
    !dismissed.filters && context.filters && { k: 'filters' as const, label: `篩選：${context.filters}` },
  ].filter(Boolean) as { k: 'section' | 'selection' | 'filters'; label: string }[]

  return (
    <div className="flex h-full flex-col bg-white text-[13.5px] text-zinc-900">
      {/* 頂部：小頭像、名稱、AI 標示、關閉 */}
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2">
        <Avatar size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ASSISTANT_NAME}</p>
          <p className="text-[11px] text-zinc-500">虛構 AI 助理・非真人客服{context.tenant === 'demo' ? '・展示資料' : ''}</p>
        </div>
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">AI</span>
        <button type="button" onClick={() => setMessages([])} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100" aria-label="清除目前對話" title="清除目前對話">
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100" aria-label="收合 AI 助理">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* 訊息 */}
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-[#F4F2F8] px-3 py-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex items-start gap-2">
            <Avatar />
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
              我是小P，可以解說功能與規則、依你的權限查詢資料。資料以系統紀錄為準；回覆會標示「操作指南」「即時查詢」或「展示範例」。退款、開門等操作只會產生預覽，由你確認後才執行。
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const firstOfGroup = i === 0 || messages[i - 1].role !== m.role
          if (m.role === 'user') {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-[#713CDE] px-3 py-2 text-white">{m.text}</div>
              </div>
            )
          }
          return (
            <div key={m.id} className="flex items-start gap-2">
              {firstOfGroup ? <Avatar /> : <span className="w-[34px] shrink-0" />}
              <div className={cn('max-w-[85%] space-y-2 rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm', m.error && 'border border-red-200 bg-red-50 text-red-800')}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.cards?.map((c, ci) => <CardView key={ci} card={c} onAsk={(q, id) => void send(q, `guide:${id}`)} />)}
                {m.actions?.map((a, ai) => (
                  <div key={ai} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
                    <p className="font-semibold">操作預覽（尚未執行）：{a.title}</p>
                    <ul className="mt-1 list-disc pl-4">{a.items.map((x, xi) => <li key={xi}>{x}</li>)}</ul>
                    <p className="mt-1">{a.impact}</p>
                  </div>
                ))}
                {(m.label || m.sources?.length || m.queriedAt) && (
                  <div className="border-t border-zinc-100 pt-1.5 text-[11px] text-zinc-500">
                    {m.label && <span className={cn('mr-2 rounded px-1.5 py-0.5 font-semibold', m.label.startsWith('展示') ? 'bg-amber-100 text-amber-800' : m.mode === 'guide' ? 'bg-zinc-100 text-zinc-700' : 'bg-violet-100 text-violet-800')}>{m.label}</span>}
                    {m.queriedAt && m.mode !== 'guide' && <span>查詢時間 {new Date(m.queriedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}</span>}
                    {m.sources?.map((s, si) => (
                      <Link key={si} href={s.href} className="ml-2 inline-flex items-center gap-0.5 text-violet-700 hover:underline">
                        {s.label}
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </Link>
                    ))}
                    {m.mode === 'quick' && !m.label && <span className="ml-2">（系統查詢，未使用 AI 模型）</span>}
                  </div>
                )}
                {m.error && (
                  <button type="button" onClick={retry} className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline">
                    <RotateCcw className="h-3 w-3" aria-hidden />
                    重試
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Avatar />
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            查詢中…
          </div>
        )}
      </div>

      {/* 脈絡標籤與快捷提問 */}
      <div className="space-y-2 border-t border-zinc-200 px-3 py-2">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t.k} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-800 ring-1 ring-violet-200">
                {t.label}
                <button type="button" onClick={() => dismiss(t.k)} aria-label={`移除 ${t.label}`} className="rounded-full hover:bg-violet-100">
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
        {!compact && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {QUICK.map((q) => (
              <button
                key={q.key}
                type="button"
                disabled={busy}
                onClick={() => void send(q.label, q.key)}
                className="shrink-0 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send(input)
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder={expect === 'find' ? '輸入姓名、電話、Email 或訂單編號' : '輸入問題，Enter 送出'}
            className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            aria-label="輸入給 AI 助理的訊息"
          />
          {busy ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-800 text-white" aria-label="停止生成">
              <Square className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="grid h-10 w-10 place-items-center rounded-xl bg-[#713CDE] text-white disabled:opacity-40" aria-label="傳送">
              <Send className="h-4 w-4" aria-hidden />
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

function CardView({ card, onAsk }: { card: AiCard; onAsk: (question: string, id: string) => void }) {
  const box = 'rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs'
  switch (card.kind) {
    case 'guide':
      return (
        <div className={box}>
          <p className="mb-1 font-semibold">相關入口</p>
          <ul className="space-y-0.5">
            {card.links.map((l, i) => (
              <li key={i}>
                {l.href ? (
                  <Link href={l.href} className="inline-flex items-center gap-0.5 font-semibold text-violet-700 hover:underline">{l.label}<ExternalLink className="h-3 w-3" aria-hidden /></Link>
                ) : (
                  <span className="text-zinc-500">{l.label}（{l.state ?? '尚未開放'}）</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'faq':
      return (
        <div className={box}>
          <p className="mb-1 font-semibold">{card.title}</p>
          <ul className="space-y-1">
            {card.items.map((q) => (
              <li key={q.id}>
                <button type="button" onClick={() => onAsk(q.question, q.id)} className="w-full rounded-md bg-white p-1.5 text-left ring-1 ring-zinc-200 hover:ring-violet-300">{q.question}</button>
              </li>
            ))}
          </ul>
        </div>
      )
    case 'orders':
      return (
        <div className={box}>
          <p className="mb-1 font-semibold">{card.title}</p>
          <ul className="space-y-1">
            {card.items.map((o) => (
              <li key={o.id}>
                <Link href={o.href} className="block rounded-md bg-white p-1.5 ring-1 ring-zinc-200 hover:ring-violet-300">
                  <span className="font-mono font-semibold">{o.code}</span>　{o.name} {o.phone}
                  <span className="block text-zinc-500">
                    {o.playDate}・NT${o.total.toLocaleString()}・{o.payment}・{o.refund}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )
    case 'sessions':
      return (
        <div className={box}>
          <p className="mb-1 font-semibold">{card.title}</p>
          <ul className="space-y-1">
            {card.items.map((s) => (
              <li key={s.id}>
                <Link href={s.href} className="flex justify-between gap-2 rounded-md bg-white p-1.5 ring-1 ring-zinc-200 hover:ring-violet-300">
                  <span>
                    {s.title}
                    <span className="block text-zinc-500">
                      {s.date} {s.time}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">剩 {s.remaining}／{s.capacity}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )
    case 'incidents':
      return (
        <div className={box}>
          <p className="mb-1 font-semibold">{card.title}</p>
          <ul className="space-y-1">
            {card.items.map((x) => (
              <li key={x.id} className="rounded-md bg-white p-1.5 ring-1 ring-zinc-200">
                <span className={cn('mr-1 rounded px-1 text-[10px] font-bold', x.severity === 'HIGH' ? 'bg-red-100 text-red-700' : x.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-600')}>
                  {x.severity === 'HIGH' ? '高' : x.severity === 'MEDIUM' ? '中' : '低'}
                </span>
                {x.href ? <Link href={x.href} className="hover:underline">{x.title}</Link> : x.title}
                {x.detail && <span className="block text-zinc-500">{x.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'refund':
      return (
        <div className={box}>
          <p className="mb-1 font-semibold">{card.title}</p>
          <ul className="space-y-1">
            {card.items.map((x, i) => (
              <li key={i} className="flex justify-between gap-2 rounded-md bg-white p-1.5 ring-1 ring-zinc-200">
                <span>{x.label}</span>
                <span className="shrink-0 text-right">{x.blocked ? <span className="text-zinc-500">{x.blocked}</span> : `可退 NT$${x.cash}${x.points ? `＋${x.points} 點` : ''}`}</span>
              </li>
            ))}
          </ul>
          {card.note && <p className="mt-1 text-amber-800">{card.note}</p>}
          <Link href={card.href} className="mt-1.5 inline-block font-semibold text-violet-700 hover:underline">
            開啟退款確認（草稿，尚未送出）→
          </Link>
        </div>
      )
    case 'steps':
      return (
        <div className={box}>
          <p className="mb-1 font-semibold">{card.title}</p>
          <ol className="list-decimal space-y-0.5 pl-4">{card.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <Link href={card.href} className="mt-1.5 inline-block font-semibold text-violet-700 hover:underline">
            {card.linkLabel} →
          </Link>
        </div>
      )
    case 'devices':
      return (
        <div className={box}>
          <p className="mb-1 font-semibold">{card.title}</p>
          <ul className="space-y-1">
            {card.items.map((d, i) => (
              <li key={i} className="rounded-md bg-white p-1.5 ring-1 ring-zinc-200">
                <span className="font-semibold">{d.court}</span>：{d.usage}
                <span className="block text-zinc-500">感測：{d.sensor}・設備：{d.devices}</span>
              </li>
            ))}
          </ul>
          <Link href={card.href} className="mt-1.5 inline-block font-semibold text-violet-700 hover:underline">查看場地監測 →</Link>
        </div>
      )
  }
}
