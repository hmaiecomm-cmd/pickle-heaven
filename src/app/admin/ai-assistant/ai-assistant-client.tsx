'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bot, Download, Loader2, Send, ShieldCheck, Sparkles, Trash2, User } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { postAdminChat, recordAiDecision } from '@/lib/api-service'
import type { AiActionPreview } from '@/lib/models'

/**
 * AI 管理助理（Phase 2）。
 * 回覆由伺服器呼叫 Claude 並以唯讀工具查詢營運資料產生；
 * 資料期間、來源、計算說明由伺服器依實際查詢彙整。
 * 高風險操作只產生「操作預覽」，確認後只寫稽核紀錄，不執行任何操作。
 */

type Role = 'user' | 'assistant'

interface Message {
  id: string
  role: Role
  text: string
  at: Date
  /** 錯誤訊息不送回模型 */
  isError?: boolean
  meta?: {
    period?: { from: Date; to: Date }
    sources: string[]
    notes: string[]
    model?: string
  }
  actions?: (AiActionPreview & { decision?: 'confirm' | 'decline' })[]
}

const SUGGESTIONS = [
  '本月營收表現如何？跟上個月比呢？',
  '這週各球場的使用率？',
  '有哪些待付款的訂單？',
  '哪些發票已經逾期？',
  '未來兩週的球敘報名狀況？',
  '幫我取消所有待付款訂單',
]

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
  const { toast } = useToast()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    const userMsg: Message = { id: uid(), role: 'user', text: q, at: new Date() }
    const next = [...messages, userMsg]
    setMessages(next)
    setBusy(true)
    try {
      // 只送文字歷史；錯誤訊息不送
      const history = next.filter((m) => !m.isError).map((m) => ({ role: m.role, text: m.text }))
      const res = await postAdminChat(history)
      if (!res.success) {
        setMessages((m) => [...m, { id: uid(), role: 'assistant', text: res.error?.message ?? 'AI 助理暫時無法回應。', at: new Date(), isError: true }])
        return
      }
      const d = res.data
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: 'assistant',
          text: d.reply,
          at: new Date(),
          meta: d.toolsUsed.length ? { period: d.period, sources: d.sources, notes: d.notes, model: d.model } : undefined,
          actions: d.actions.length ? d.actions : undefined,
        },
      ])
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const decide = async (msgId: string, idx: number, decision: 'confirm' | 'decline') => {
    const msg = messages.find((m) => m.id === msgId)
    const action = msg?.actions?.[idx]
    if (!action) return
    const res = await recordAiDecision(decision, action)
    if (!res.success) {
      toast(`記錄失敗：${res.error?.message ?? '未知錯誤'}`, 'error')
      return
    }
    setMessages((m) => m.map((x) => (x.id === msgId && x.actions ? { ...x, actions: x.actions.map((a, i) => (i === idx ? { ...a, decision } : a)) } : x)))
    toast(decision === 'confirm' ? '已記錄確認（未執行任何操作）' : '已取消，未做任何變更', decision === 'confirm' ? 'success' : 'info')
  }

  const clear = () => {
    setMessages([])
    toast('對話已清除', 'info')
  }

  const exportChat = () => {
    const lines = messages.map((m) => {
      const who = m.role === 'user' ? '擁有者' : 'AI 助理'
      const extra = (m.actions ?? [])
        .map((a) => `\n  [操作預覽] ${a.title}：${a.items.join('；')}（${a.decision === 'confirm' ? '已確認，未執行' : a.decision === 'decline' ? '已取消' : '待確認'}）`)
        .join('')
      const src = m.meta?.sources.length ? `\n  [資料來源] ${m.meta.sources.join('、')}` : ''
      return `[${fmtDate(m.at)} ${fmtTime(m.at)}] ${who}：${m.text}${src}${extra}`
    })
    const blob = new Blob(['﻿' + lines.join('\n'), '\n'], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-chat-${fmtDate(new Date()).replace(/\//g, '')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast('對話已匯出', 'success')
  }

  const empty = messages.length === 0
  const pendingAction = useMemo(() => messages.some((m) => m.actions?.some((a) => !a.decision)), [messages])

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
            <Button size="sm" variant="secondary" onClick={clear} disabled={empty || busy}>
              <Trash2 className="h-4 w-4" aria-hidden />
              清除對話
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {empty ? (
            <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                <Sparkles className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold">想了解什麼？</h2>
              <p className="mt-1 text-sm text-muted">可以問營收、使用率、訂單、會員、費用、發票或球敘。助理會直接查詢資料庫，並列出資料期間與來源。</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-[rgb(var(--border))] px-3 py-1.5 text-sm transition-colors hover:surface-2">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="mx-auto max-w-3xl space-y-4" aria-live="polite">
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
                        m.role === 'user'
                          ? 'bg-brand-600 text-white'
                          : m.isError
                            ? 'border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
                            : 'border border-[rgb(var(--border))] surface'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>

                    {m.meta && (
                      <dl className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-left text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status="資料庫即時查詢" variant="success" size="sm" />
                          {m.meta.period && <span className="text-muted">資料期間 {fmtDate(m.meta.period.from)} – {fmtDate(new Date(m.meta.period.to.getTime() - 1))}</span>}
                        </div>
                        {m.meta.sources.length > 0 && (
                          <div className="mt-2">
                            <dt className="font-medium text-muted">資料來源</dt>
                            <dd className="mt-0.5">{m.meta.sources.join('、')}</dd>
                          </div>
                        )}
                        {m.meta.notes.length > 0 && (
                          <div className="mt-2">
                            <dt className="font-medium text-muted">計算說明</dt>
                            <dd className="mt-0.5 space-y-0.5">
                              {m.meta.notes.map((n) => (
                                <p key={n}>{n}</p>
                              ))}
                            </dd>
                          </div>
                        )}
                      </dl>
                    )}

                    {m.actions?.map((a, idx) => (
                      <div key={idx} className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-left text-sm dark:border-amber-700 dark:bg-amber-950/30">
                        <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4" aria-hidden />
                          操作預覽：{a.title}
                        </div>
                        {a.items.length > 0 && (
                          <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
                            {a.items.map((it) => (
                              <li key={it}>{it}</li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-2 text-xs text-muted">{a.impact}</p>
                        {!a.decision ? (
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" variant="danger" onClick={() => decide(m.id, idx, 'confirm')}>
                              <ShieldCheck className="h-4 w-4" aria-hidden />
                              擁有者確認
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => decide(m.id, idx, 'decline')}>
                              取消
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs font-medium">{a.decision === 'confirm' ? '已確認並記錄於稽核紀錄（系統未執行任何操作）' : '已取消'}</p>
                        )}
                      </div>
                    ))}

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
                    正在查詢資料並分析…
                  </div>
                </li>
              )}
              <div ref={bottomRef} />
            </ul>
          )}
        </div>

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
                  disabled={busy || pendingAction}
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
              maxLength={2000}
              placeholder={pendingAction ? '請先處理上方的操作預覽' : '輸入問題，Enter 送出，Shift+Enter 換行'}
              disabled={busy || pendingAction}
              aria-label="輸入問題"
              className="max-h-32 min-h-[2.75rem] flex-1 resize-y rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2.5 text-sm disabled:opacity-60"
            />
            <Button type="submit" size="md" disabled={busy || pendingAction || !input.trim()} aria-label="送出">
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted">AI 回覆僅供參考，重要決策請以財務與訂單頁的實際資料為準。對話內容會送至 Anthropic 處理。</p>
        </form>
      </div>
    </div>
  )
}
