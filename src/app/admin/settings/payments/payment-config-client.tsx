'use client'

import * as React from 'react'
import { AlertCircle, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

interface PaymentConfig {
  id: string
  displayName: string
  method: string
  status: 'ready' | 'unconfigured'
  issues?: string[]
  requiredEnvVars?: string[]
  setupGuide?: string
  instructions?: string
}

interface ConfigResponse {
  configured: PaymentConfig[]
  unconfigured: PaymentConfig[]
  current: {
    primary: string
    available: string[]
  }
  notes: {
    production: boolean
    canUseMock: boolean
  }
}

export function PaymentConfigClient() {
  const { toast } = useToast()
  const [config, setConfig] = React.useState<ConfigResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/admin/settings/payment-config')
        if (!res.ok) throw new Error('取得設定失敗')
        setConfig(await res.json())
      } catch (err) {
        toast((err as Error).message, 'error')
      } finally {
        setLoading(false)
      }
    }
    void fetchConfig()
  }, [toast])

  if (loading) {
    return <div className="text-center py-8 text-muted">載入中…</div>
  }

  if (!config) {
    return <div className="text-center py-8 text-red-600">無法載入設定</div>
  }

  return (
    <div className="space-y-6">
      {/* 當前狀態 */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <h3 className="font-semibold">目前狀態</h3>
          <div className="text-sm text-muted space-y-1">
            <p>主要金流：<strong>{config.current.primary}</strong></p>
            <p>可用方式：<strong>{config.current.available.length > 0 ? config.current.available.join(', ') : '無（僅模擬）'}</strong></p>
            {config.notes.production && (
              <p className="text-amber-600">
                ⚠️ 正式環境 — 確保已使用正式金鑰
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 已配置 */}
      {config.configured.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            已配置完成（{config.configured.length}）
          </h3>
          <div className="grid gap-3">
            {config.configured.map((p) => (
              <Card key={p.id} className="border-green-200 bg-green-50">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-green-900">{p.displayName}</p>
                      <p className="text-xs text-green-700 mt-1">
                        支付方式：{p.method}
                      </p>
                    </div>
                    <span className="rounded-full bg-green-600 text-white px-2 py-1 text-xs font-semibold">
                      就緒
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 未配置 */}
      {config.unconfigured.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            未配置（{config.unconfigured.length}）
          </h3>
          <div className="grid gap-3">
            {config.unconfigured.map((p) => (
              <Card key={p.id} className="border-amber-200 bg-amber-50">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-amber-900">{p.displayName}</p>
                      <p className="text-xs text-amber-700 mt-1">
                        支付方式：{p.method}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-600 text-white px-2 py-1 text-xs font-semibold">
                      缺少配置
                    </span>
                  </div>

                  {/* 需要的環境變數 */}
                  {p.requiredEnvVars && p.requiredEnvVars.length > 0 && (
                    <div className="text-xs">
                      <p className="font-semibold text-amber-900 mb-1">
                        需要填入以下環境變數：
                      </p>
                      <ul className="space-y-0.5 font-mono text-amber-800 pl-3">
                        {p.requiredEnvVars.map((v) => (
                          <li key={v}>• {v}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 設定說明 */}
                  {p.instructions && (
                    <details className="text-xs text-amber-800">
                      <summary className="cursor-pointer font-semibold">
                        設定步驟（點擊展開）
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed bg-white/50 p-2 rounded border border-amber-200">
                        {p.instructions}
                      </pre>
                    </details>
                  )}

                  {/* 官方連結 */}
                  {p.setupGuide && p.setupGuide !== '#' && (
                    <a
                      href={p.setupGuide}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-semibold"
                    >
                      官方設定文件
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold">環境變數設定提示</p>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• 本機開發：填入 <code className="bg-white px-1 py-0.5 rounded">.env.local</code></li>
                <li>• Vercel：在 Project Settings → Environment Variables 中填入</li>
                <li>• 金鑰應透過環境變數設定，<strong>勿寫入程式碼或提交到 Git</strong></li>
                <li>• 開發環境可使用測試金鑰，正式環境需切換至正式金鑰</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
