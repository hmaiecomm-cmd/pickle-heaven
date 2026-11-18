'use client'

import { useState } from 'react'
import { MessageCircle, Mail, Bell, Clock, Send, Settings as SettingsIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface LINESettings {
  isConnected: boolean
  enableBookingConfirmation: boolean
  enableActivityReminder: boolean
  enablePromotionNotification: boolean
}

interface MarketingToolsSectionProps {
  lineSettings?: LINESettings
}

export function MarketingToolsSection({ lineSettings }: MarketingToolsSectionProps) {
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
          {/* 連接狀態卡片 */}
          <Card>
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                    lineSettings?.isConnected
                      ? 'bg-emerald-50'
                      : 'bg-zinc-100'
                  }`}
                >
                  <MessageCircle
                    className={`h-6 w-6 ${
                      lineSettings?.isConnected
                        ? 'text-emerald-600'
                        : 'text-zinc-400'
                    }`}
                    aria-hidden
                  />
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-zinc-900">LINE 官方帳號連接</h3>
                  <p className="text-sm text-zinc-600 mt-1">
                    {lineSettings?.isConnected ? (
                      <span className="text-emerald-700 font-medium">✓ 已連接 - 可以發送通知</span>
                    ) : (
                      <span className="text-amber-700 font-medium">⚠ 尚未連接 - 無法發送通知</span>
                    )}
                  </p>
                </div>

                {lineSettings?.isConnected ? (
                  <button className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200">
                    重新設定
                  </button>
                ) : (
                  <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    立即連接
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 通知設定 */}
          {lineSettings?.isConnected && (
            <Card>
              <div className="border-b border-zinc-200 p-4">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5 text-brand-600" aria-hidden />
                  通知類型設定
                </h3>
              </div>
              <CardContent className="space-y-4 py-4">
                {[
                  {
                    id: 'booking',
                    label: '訂場確認通知',
                    desc: '當用戶成功預約時發送確認',
                    icon: Bell,
                  },
                  {
                    id: 'reminder',
                    label: '活動提醒通知',
                    desc: '活動開始前 24 小時提醒',
                    icon: Clock,
                  },
                  {
                    id: 'promotion',
                    label: '優惠推播通知',
                    desc: '發送優惠與行銷訊息',
                    icon: Send,
                  },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <label key={item.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-zinc-50 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="h-4 w-4 rounded border-zinc-300 mt-0.5"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-zinc-900">{item.label}</p>
                        <p className="text-xs text-muted mt-1">{item.desc}</p>
                      </div>
                      <Icon className="h-5 w-5 text-zinc-400 flex-shrink-0 mt-0.5" aria-hidden />
                    </label>
                  )
                })}

                <div className="border-t border-zinc-200 pt-4 mt-4 flex gap-3">
                  <button className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    取消
                  </button>
                  <button className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    保存設定
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
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
