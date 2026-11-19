'use client'

import * as React from 'react'
import type { ChartKey, OverviewData } from './overview-types'

/**
 * 「AI 幫我判讀」的資料介面。
 * 目前沒有串接 LLM：analyzeOverview 會回報「尚未串接」。
 * 之後只要把 analyzeOverview 換成呼叫伺服器端 API（例如 server action 或 /api/admin/ai/overview），
 * 回傳 AiInsightResult 即可，畫面與 hook 不需要修改。
 */
export interface AiInsightRequest {
  range: OverviewData['range']
  chart: ChartKey
  kpi: OverviewData['kpi']
  /** 目前圖表下方的簡易判讀，讓模型知道使用者正在看什麼 */
  chartSummary: string
  quickRead: string[]
}

export interface AiInsightResult {
  findings: string[]
  issues: string[]
  actions: string[]
  generatedAt: string
}

export type AiInsightProvider = (req: AiInsightRequest, signal: AbortSignal) => Promise<AiInsightResult>

export class AiNotConnectedError extends Error {
  constructor() {
    super('AI 服務尚未串接')
  }
}

export const analyzeOverview: AiInsightProvider = async () => {
  throw new AiNotConnectedError()
}

export type AiInsightState =
  | { status: 'idle' }
  | { status: 'loading'; request: AiInsightRequest }
  | { status: 'success'; request: AiInsightRequest; result: AiInsightResult }
  | { status: 'error'; request: AiInsightRequest; reason: string }

/** 防止重複送出：判讀進行中再按不會發出第二次請求；期間改變時呼叫 reset 清掉舊結果 */
export function useAiInsight(provider: AiInsightProvider = analyzeOverview) {
  const [state, setState] = React.useState<AiInsightState>({ status: 'idle' })
  const inFlight = React.useRef<AbortController | null>(null)

  const run = React.useCallback(
    async (request: AiInsightRequest) => {
      if (inFlight.current) return
      const ctrl = new AbortController()
      inFlight.current = ctrl
      setState({ status: 'loading', request })
      try {
        const result = await provider(request, ctrl.signal)
        if (!ctrl.signal.aborted) setState({ status: 'success', request, result })
      } catch (err) {
        if (!ctrl.signal.aborted) setState({ status: 'error', request, reason: err instanceof Error ? err.message : '未知錯誤' })
      } finally {
        if (inFlight.current === ctrl) inFlight.current = null
      }
    },
    [provider],
  )

  const reset = React.useCallback(() => {
    inFlight.current?.abort()
    inFlight.current = null
    setState({ status: 'idle' })
  }, [])

  React.useEffect(() => () => inFlight.current?.abort(), [])
  return { state, run, reset, busy: state.status === 'loading' }
}
