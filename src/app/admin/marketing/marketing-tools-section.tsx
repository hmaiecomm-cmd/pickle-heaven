'use client'

import { useState } from 'react'
import { MessageCircle, Bell, Clock, Send, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { LineAccountStatus } from '@/lib/line'

interface MarketingToolsSectionProps {
  lineStatus: LineAccountStatus
}

const fmt = (n: number | null) => (n === null ? '—' : n.toLocaleString('zh-TW'))

export function MarketingToolsSection({ lineStatus }: MarketingToolsSectionProps) {
  const managerUrl = lineStatus.basicId
    ? `https://manager.line.biz/account/${encodeURIComponent(lineStatus.basicId)}`
    : 'https://manager.line.biz/'
  const [activeTab, setActiveTab] = useState<'line' | 'campaigns'>('line')
  const [campaignType, setCampaignType] = useState<'immediate' | 'scheduled'>('immediate')

  return (
    <div className="space-y-6">
      {/* 標籤導航 */}
      <div className="flex gap-2 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('line')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'line'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" aria-hidden />
            LINE 通知設定
          </div>
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'campaigns'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4" aria-hidden />
            推播行銷活動
          </div>
        </button>
      </div>

      {/* LINE 設定 */}
      {activeTab === 'line' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex flex-1 items-start gap-4">
                  {lineStatus.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={lineStatus.pictureUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${lineStatus.connected ? 'bg-emerald-50' : 'bg-zinc-100'}`}>
                      <MessageCircle className={`h-6 w-6 ${lineStatus.connected ? 'text-emerald-600' : 'text-zinc-400'}`} aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-zinc-900">
                      {lineStatus.connected ? lineStatus.displayName : 'LINE 官方帳號'}
                      {lineStatus.basicId && <span className="ml-2 text-sm font-normal text-muted">{lineStatus.basicId}</span>}
                    </h3>
                    <p className="mt-1 text-sm">
                      {lineStatus.connected ? (
                        <span className="font-medium text-emerald-700">✓ 已連接，訂場確認、開打提醒、取消通知會由此帳號發送</span>
                      ) : lineStatus.configured ? (
                        <span className="font-medium text-red-700">⚠ 推播金鑰無效或已過期，請到 LINE Developers 重新發行後更新 Vercel 環境變數</span>
                      ) : (
                        <span className="font-medium text-amber-700">⚠ 尚未設定推播金鑰（LINE_MESSAGING_CHANNEL_ACCESS_TOKEN）</span>
                      )}
                    </p>
                  </div>
                </div>
                <a
                  href={managerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#06C755] px-4 text-sm font-medium text-white hover:bg-[#05b34c]"
                >
                  開啟 LINE 官方帳號管理後台
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </div>

              {lineStatus.connected && (
                <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-4">
                  {[
                    { label: '好友數', value: fmt(lineStatus.followers), icon: Bell },
                    { label: '封鎖數', value: fmt(lineStatus.blocks), icon: Bell },
                    { label: '本月已發送', value: fmt(lineStatus.usedThisMonth), icon: Send },
                    { label: '每月額度', value: lineStatus.quota === null ? '無上限' : fmt(lineStatus.quota), icon: Clock },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-zinc-50 px-3 py-2">
                      <dt className="text-xs text-muted">{s.label}</dt>
                      <dd className="mt-0.5 text-lg font-semibold text-zinc-900">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-3 text-xs text-muted">好友數為前一天的統計；圖文選單、自動回應、群發訊息請到 LINE 官方帳號管理後台操作。</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 推播行銷活動 */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          {/* 發送方式選擇 */}
          <div className="flex gap-3">
            <button
              onClick={() => setCampaignType('immediate')}
              className={`flex-1 rounded-lg border-2 p-4 text-center transition-all ${
                campaignType === 'immediate'
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-zinc-200 bg-white hover:border-brand-300'
              }`}
            >
              <Send className="h-5 w-5 mx-auto mb-2 text-brand-600" aria-hidden />
              <p className="font-semibold text-zinc-900">立即發送</p>
              <p className="text-xs text-muted mt-1">馬上推播給用戶</p>
            </button>
            <button
              onClick={() => setCampaignType('scheduled')}
              className={`flex-1 rounded-lg border-2 p-4 text-center transition-all ${
                campaignType === 'scheduled'
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-zinc-200 bg-white hover:border-brand-300'
              }`}
            >
              <Clock className="h-5 w-5 mx-auto mb-2 text-brand-600" aria-hidden />
              <p className="font-semibold text-zinc-900">排程發送</p>
              <p className="text-xs text-muted mt-1">設定時間自動發送</p>
            </button>
          </div>

          {/* 推播表單 */}
          <Card>
            <CardContent className="space-y-4 py-6">
              {/* 推播類型 */}
              <div>
                <label className="block text-sm font-medium text-zinc-900 mb-2">
                  推播類型
                </label>
                <select className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none">
                  <option>訂場確認</option>
                  <option>活動提醒</option>
                  <option>優惠推廣</option>
                  <option>自訂訊息</option>
                </select>
              </div>

              {/* 目標受眾 */}
              <div>
                <label className="block text-sm font-medium text-zinc-900 mb-2">
                  目標受眾
                </label>
                <select className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none">
                  <option>全部用戶</option>
                  <option>會員用戶</option>
                  <option>VIP 用戶</option>
                  <option>自訂分群</option>
                </select>
              </div>

              {/* 推播標題 */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-zinc-900 mb-2">
                  推播標題
                </label>
                <input
                  type="text"
                  id="title"
                  placeholder="輸入推播標題"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              {/* 推播內容 */}
              <div>
                <label htmlFor="content" className="block text-sm font-medium text-zinc-900 mb-2">
                  推播內容
                </label>
                <textarea
                  id="content"
                  rows={4}
                  placeholder="輸入推播內容（支持 Emoji 與換行）"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              {/* 排程時間（若選擇排程） */}
              {campaignType === 'scheduled' && (
                <div>
                  <label htmlFor="scheduledAt" className="block text-sm font-medium text-zinc-900 mb-2">
                    排程時間
                  </label>
                  <input
                    type="datetime-local"
                    id="scheduledAt"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  />
                </div>
              )}

              {/* 預覽 */}
              <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
                <p className="text-xs font-semibold text-zinc-600 uppercase mb-2">預覽</p>
                <div className="bg-white rounded-lg p-3 border border-zinc-200">
                  <p className="text-sm font-semibold text-zinc-900">推播標題</p>
                  <p className="text-xs text-zinc-600 mt-1">推播內容會在這裡顯示...</p>
                </div>
              </div>

              {/* 操作按鈕 */}
              <div className="flex gap-3 border-t border-zinc-200 pt-4">
                <button className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  取消
                </button>
                <button className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                  {campaignType === 'immediate' ? '立即發送' : '排程發送'}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* 歷史記錄 */}
          <Card>
            <div className="border-b border-zinc-200 p-4">
              <h3 className="font-semibold text-zinc-900">推播歷史</h3>
            </div>
            <CardContent className="py-6">
              <p className="text-sm text-muted text-center">暫無推播記錄</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
