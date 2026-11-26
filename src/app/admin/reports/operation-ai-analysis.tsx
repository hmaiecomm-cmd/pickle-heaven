'use client'
import { useState } from 'react'
import type { AIAnalysisResult } from './member-ai-provider'
import { memberOperationsAIProvider } from './member-ai-provider'

interface OperationAIAnalysisProps {
  painPoint: string
  dateRange: { from: string; to: string; days: number }
  memberCount: number
}

export function OperationAIAnalysis({ painPoint, dateRange, memberCount }: OperationAIAnalysisProps) {
  const [result, setResult] = useState<AIAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const analysisResult = await memberOperationsAIProvider.analyzeMemberOperations({
        dateRange,
        painPoint,
        memberSegments: { total: memberCount },
        memberStats: {},
        revenueStats: {},
        bookingStats: {},
        retentionStats: {},
        lineBindingStats: {},
        promotionStats: {}
      })
      setResult(analysisResult)
      setExpanded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white p-6 space-y-4">
      {/* 按鈕 */}
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="w-full px-6 py-3 bg-[#2f7d3b] text-white rounded-lg font-semibold hover:bg-[#1f5a2b] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            分析中...
          </>
        ) : (
          <>🤖 AI 幫我分析會員營運</>
        )}
      </button>

      {/* 錯誤訊息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm font-semibold">❌ {error}</p>
        </div>
      )}

      {/* AI 分析結果 */}
      {result && (
        <div className="space-y-4 border-t border-[#e3e8dc] pt-4">
          <div className="flex items-start justify-between">
            <h3 className="font-bold">🤖 AI 分析結果</h3>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {expanded ? '📖 收合' : '📖 展開'}
            </button>
          </div>

          {expanded && (
            <div className="space-y-6">
              {/* 數據摘要 */}
              <div>
                <h4 className="font-semibold text-sm mb-2">📊 數據摘要</h4>
                <p className="text-sm text-gray-700 leading-relaxed">{result.dataSummary}</p>
              </div>

              {/* 主要發現 */}
              <div>
                <h4 className="font-semibold text-sm mb-2">🔍 主要發現</h4>
                <ul className="space-y-2">
                  {result.mainFindings.map((finding, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-gray-700">
                      <span className="text-[#2f7d3b] font-bold">•</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 目標會員 */}
              <div className="bg-[#f1f5ec] p-4 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">👥 目前最值得經營的會員群</h4>
                <p className="text-sm text-gray-700">{result.targetMembers}</p>
              </div>

              {/* 建議優惠 */}
              <div>
                <h4 className="font-semibold text-sm mb-2">🎁 建議優惠或溝通方式</h4>
                <ul className="space-y-2">
                  {result.suggestedPromotions.map((promo, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-gray-700 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <span className="text-blue-600 font-bold">{idx + 1}.</span>
                      <span>{promo}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 建議 LINE 文案 */}
              <div>
                <h4 className="font-semibold text-sm mb-2">💬 建議 LINE 文案</h4>
                <div className="space-y-2">
                  {result.suggestedLineMessages.map((msg, idx) => (
                    <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-sm text-gray-700">{msg}</p>
                      <button className="mt-2 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition">
                        📋 複製文案
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 預估營收影響 */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <h4 className="font-semibold text-sm mb-2">💰 預估營收影響</h4>
                <p className="text-sm text-gray-700">{result.estimatedRevenue}</p>
              </div>

              {/* 建議追蹤指標 */}
              <div>
                <h4 className="font-semibold text-sm mb-2">📈 建議追蹤指標</h4>
                <div className="grid grid-cols-2 gap-2">
                  {result.trackedMetrics.map((metric, idx) => (
                    <div key={idx} className="p-2 bg-purple-50 rounded-lg border border-purple-100 text-xs font-semibold text-purple-700">
                      {metric}
                    </div>
                  ))}
                </div>
              </div>

              {/* 風險與不建議 */}
              {result.risksAndWarnings.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">⚠️ 風險與不建議做的事情</h4>
                  <ul className="space-y-2">
                    {result.risksAndWarnings.map((warning, idx) => (
                      <li key={idx} className="flex gap-3 text-sm text-orange-700 p-3 bg-orange-50 rounded-lg border border-orange-100">
                        <span className="font-bold">⚠️</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 加載時間 */}
              {result.loadingTime && (
                <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
                  分析耗時 {(result.loadingTime / 1000).toFixed(1)} 秒 ⏱️
                </div>
              )}

              {/* 操作按鈕 */}
              <div className="flex gap-2 pt-4 border-t border-[#e3e8dc]">
                <button className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-200 transition">
                  📋 複製全部分析
                </button>
                <button className="flex-1 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-200 transition">
                  📧 分享給團隊
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
