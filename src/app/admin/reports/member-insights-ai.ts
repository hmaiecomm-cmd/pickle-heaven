'use client'

import * as React from 'react'
import type { ChartKeyMember, MemberInsightsData } from './member-insights-types'

export interface MemberAiInsightRequest {
  data: MemberInsightsData
  chart: ChartKeyMember
  focus: 'kpi' | 'funnel' | 'segments' | 'actions'
}

export interface MemberAiInsightResult {
  findings: string[]
  issues: string[]
  actions: string[]
  generatedAt: string
}

export type MemberAiInsightProvider = (req: MemberAiInsightRequest, signal: AbortSignal) => Promise<MemberAiInsightResult>

export class MemberAiNotConnectedError extends Error {
  constructor() {
    super('會員分析 AI 服務尚未串接')
  }
}

export const analyzeMemberInsight: MemberAiInsightProvider = async () => {
  throw new MemberAiNotConnectedError()
}

export type MemberAiInsightState =
  | { status: 'idle' }
  | { status: 'loading'; request: MemberAiInsightRequest }
  | { status: 'success'; request: MemberAiInsightRequest; result: MemberAiInsightResult }
  | { status: 'error'; request: MemberAiInsightRequest; reason: string }

export function useMemberAiInsight(provider: MemberAiInsightProvider = analyzeMemberInsight) {
  const [state, setState] = React.useState<MemberAiInsightState>({ status: 'idle' })
  const inFlight = React.useRef<AbortController | null>(null)

  const run = React.useCallback(
    async (request: MemberAiInsightRequest) => {
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
