'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bot, Download, Loader2, Send, ShieldCheck, Sparkles, Trash2, User } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { postAIChat } from '@/lib/api-service'

/**
 * AI 管理助理（Phase 1H）。
 * 回覆來自 mock api-service。高風險操作只產生「操作預覽」並要求擁有者確認，
 * 確認後也不會執行任何真實操作，只在對話中留下紀錄。
 */

type Role = 'user' | 'assistant'

interface ActionPreview {
  title: string
  items: string[]
  impact: string
  confirmed?: boolean
}

interface Message {
  id: string
  role: Role
  text: string
  at: Date
  meta?: {
    period?: { from: Date; to: Date }
    sources?: string[]
    notes?: string
  }
  action?: ActionPreview
}

const SUGGESTIONS = [
  '本月營收表現如何？',
  '球場使用率有什麼變化？',
  '有哪些待付款的訂單？',
  '哪些發票已經逾期？',
  '下週活動的報名狀況？',
  '幫我取消所有待付款訂單',
]

/** 依問題主題決定回覆附帶的資料來源與計算說明（mock）。 */
function describe(question: string): { sources: string[]; notes: string } {
  const q = question.toLowerCase()
  if (q.includes('營收') || q.includes('收入') || q.includes('財務')) {
    return { sources: ['營收紀錄（mock-data/revenue）', '費用紀錄（mock-data/expenses）'], notes: '營收為期間內已入帳收入加總；與上期比較以相同天數的前一期間為基準。' }
  }
  if (q.includes('使用率') || q.includes('球場')) {
    return { sources: ['預約紀錄（mock-data/reservations）', '球場設定（mock-data/courts）'], notes: '使用率 = 已預約時段 ÷ 營業時段總數，以場館營業時間為分母。' }
  }
  if (q.includes('付款') || q.includes('訂單')) {
    return { sources: ['付款紀錄（mock-data/payments）', '預約紀錄（mock-data/reservations）'], notes: '待付款為狀態 PENDING 且尚未逾時的付款；金額以訂單總額計。' }
  }
  if (q.includes('發票')) {
    return { sources: ['發票紀錄（mock-data/invoices）'], notes: '逾期 = 狀態為已開立且今日已超過到期日。' }
  }
  if (q.includes('活動') || q.includes('報名')) {
    return { sources: ['活動紀錄（mock-data/events）'], notes: '報名率 = 已報名人數 ÷ 人數上限。' }
  }
  return { sources: ['營收、預約、付款綜合資料（mock）'], notes: '一般性建議，未針對特定指標計算。' }
}

/** 偵測高風險意圖：批次取消、退款、刪除、對外發送。回傳操作預覽，不執行。 */
function detectRiskyAction(question: string): ActionPreview | null {
  const q = question.toLowerCase()
  if (/(取消|刪除|作廢).*(所有|全部|批次)|(所有|全部|批次).*(取消|刪除|作廢)/.test(q)) {
    return {
      title: '批次取消待付款訂單',
      items: ['PH002　王曉明　Court 2 - 2小時　NT$1,000（待付款）'],
      impact: '影響 1 筆訂單。取消後會釋放時段，並需通知會員。',
    }
  }
  if (q.includes('退款')) {
    return {
      title: '退款',
      items: ['PH001　郭昱伸　NT$1,000　信用卡'],
      impact: '影響 1 筆付款。退款需透過金流商執行，且不可逆。',
    }
  }
  if (/(發送|通知|推播|群發).*(會員|所有人|全部)/.test(q)) {
    return {
      title: '群發通知',
      items: ['收件對象：全部會員（3 人）', '管道：LINE 訊息'],
      impact: '對外發送後無法收回。',
    }
  }
  return null
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const fmtDate = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export function AiAssistantClient() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    setMessages((m) => [...m, { id: uid(), role: 'user', text: q, at: new Date() }])
    setBusy(true)
    try {
      const risky = detectRiskyAction(q)
      const res = await postAIChat(q)
      const period = res.meta?.dateRange ? { from: new Date(res.meta.dateRange.from), to: new Date(res.meta.dateRange.to) } : undefined
      const reply: Message = risky
        ? {
            id: uid(),
            role: 'assistant',
            text: `這是高風險操作。我已整理出操作預覽，請確認內容。即使確認，系統目前也不會真的執行，只會留下紀錄。`,
            at: new Date(),
            action: risky,
          }
        : {
            id: uid(),
            role: 'assistant',
            text: res.success ? res.data : '目前無法取得回覆，請稍後再試。',
            at: new Date(),
            meta: { period, ...describe(q) },
          }
      setMessages((m) => [...m, reply])
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const confirmAction = (id: string, confirmed: boolean) =>
    setMessages((m) => [
      ...m.map((msg) => (msg.id === id && msg.action ? { ...msg, action: { ...msg.action, confirmed } } : msg)),
      {
        id: uid(),
        role: 'assistant',
        text: confirmed
          ? '已記錄擁有者確認。此為 mock 模式，沒有執行任何真實操作；Phase 2 會在此處呼叫對應 API 並寫入稽核紀錄。'
          : '已取消，未做任何變更。',
        at: new Date(),
      },
    ])

  const clear = () => setMessages([])

  const exportChat = () => {
    const lines = messages.map((m) => {
      const who = m.role === 'user' ? '擁有者' : 'AI 助理'
      const extra = m.action ? `\n  [操作預覽] ${m.action.title}：${m.action.items.join('；')}（${m.action.confirmed === true ? '已確認，未執行' : m.action.confirmed === false ? '已取消' : '待確認'}）` : ''
      return `[${fmtDate(m.at)} ${fmtTime(m.at)}] ${who}：${m.text}${extra}`
    })
    const blob = new Blob(['﻿' + lines.join('\n'), '\n'], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-chat-${fmtDate(new Date()).replace(/\//g, '')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const empty = messages.length === 0
  const pendingAction = useMemo(() => messages.some((m) => m.action && m.action.confirmed === undefined), [messages])

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col">
      <PageHeader
        title="AI 管理助理"
        subtitle="以自然語言查詢營運數據；高風險操作只做預覽，不會真的執行"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={exportChat} disabled={empty}>
              <Download className="h-4 w-4" aria-hidden />
              匯出對話
            </Button>
            <Button size="sm" variant="secondary" onClick={clear} disabled={empty}>
              <Trash2 className="h-4 w-4" aria-hidden />
              清除對話
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
        {/* 對話區 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {empty ? (
            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                <Sparkles className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold">想了解什麼？</h2>
              <p className="mt-1 text-sm text-muted">可以問營收、使用率、訂單、發票或活動。目前為 mock 回覆，資料期間與來源會一併列出。</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-[rgb(var(--border))] px-3 py-1.5 text-sm transition-colors hover:surface-2"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="mx-auto max-w-3xl space-y-4">
              {messages.map((m) => (
                <li key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      m.role === 'user' ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200' : 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400'
                    }`}
                    aria-hidden
                  >
                    {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </span>
                  <div className={`max-w-[85%] space-y-2 ${m.role === 'user' ? 'text-right' : ''}`}>
                    <div
                      className={`inline-block rounded-2xl px-4 py-2.5 text-left text-sm ${
                        m.role === 'user' ? 'bg-brand-600 text-white' : 'border border-[rgb(var(--border))] surface'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>

                    {m.meta && (
                      <dl className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-left text-xs">
                        <div className="flex items-center gap-2">
                          <StatusBadge status="Mock 回覆" variant="warning" size="sm" />
                          {m.meta.period && (
                            <span className="text-muted">
                              資料期間 {fmtDate(m.meta.period.from)} – {fmtDate(m.meta.period.to)}
                            </span>
                          )}
                        </div>
                        {m.meta.sources && (
                          <div className="mt-2">
                            <dt className="font-medium text-muted">資料來源</dt>
                            <dd className="mt-0.5">{m.meta.sources.join('、')}</dd>
                          </div>
                        )}
                        {m.meta.notes && (
                          <div className="mt-2">
                            <dt className="font-medium text-muted">計算說明</dt>
                            <dd className="mt-0.5">{m.meta.notes}</dd>
                          </div>
                        )}
                      </dl>
                    )}

                    {m.action && (
                      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-left text-sm dark:border-amber-700 dark:bg-amber-950/30">
                        <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4" aria-hidden />
                          操作預覽：{m.action.title}
                        </div>
                        <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
                          {m.action.items.map((it) => (
                            <li key={it}>{it}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-muted">{m.action.impact}</p>
                        {m.action.confirmed === undefined ? (
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" variant="danger" onClick={() => confirmAction(m.id, true)}>
                              <ShieldCheck className="h-4 w-4" aria-hidden />
                              擁有者確認
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => confirmAction(m.id, false)}>
                              取消
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs font-medium">{m.action.confirmed ? '已確認（mock，未執行）' : '已取消'}</p>
                        )}
                      </div>
                    )}

                    <p className="text-[11px] text-muted">{fmtTime(m.at)}</p>
                  </div>
                </li>
              ))}
              {busy && (
                <li className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400" aria-hidden>
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-[rgb(var(--border))] surface px-4 py-2.5 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    分析中…
                  </div>
                </li>
              )}
              <div ref={bottomRef} />
            </ul>
          )}
        </div>

        {/* 輸入區 */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="border-t border-[rgb(var(--border))] p-3"
        >
          {!empty && (
            <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar">
              {SUGGESTIONS.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={busy}
                  className="shrink-0 rounded-full border border-[rgb(var(--border))] px-3 py-1 text-xs transition-colors hover:surface-2 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send(input)
                }
              }}
              rows={1}
              placeholder={pendingAction ? '請先處理上方的操作預覽' : '輸入問題，Enter 送出，Shift+Enter 換行'}
              disabled={busy || pendingAction}
              className="max-h-32 min-h-[2.75rem] flex-1 resize-y rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2.5 text-sm disabled:opacity-60"
            />
            <Button type="submit" size="md" disabled={busy || pendingAction || !input.trim()} aria-label="送出">
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted">AI 回覆僅供參考，重要決策請以財務與訂單頁的實際資料為準。</p>
        </form>
      </div>
    </div>
  )
}
