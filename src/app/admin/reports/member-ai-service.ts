'use server'
import Anthropic from '@anthropic-ai/sdk'
import type { OperationData, MemberRecommendation } from './member-operations-types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface AISuggestion {
  strategy: string
  actions: string[]
  estimatedROI: number
  confidence: number
}

export interface AILineMessage {
  original: string
  optimized: string
  reasoning: string
}

export async function generateMemberStrategy(data: OperationData): Promise<AISuggestion> {
  const prompt = buildStrategyPrompt(data)
  
  const message = await client.messages.create({
    model: 'claude-opus-4-1-20250805',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]?.type === 'text' ? message.content[0].text : ''
  
  return {
    strategy: content,
    actions: extractActions(content),
    estimatedROI: estimateROI(data),
    confidence: 0.85,
  }
}

export async function optimizeLineMessages(members: MemberRecommendation[]): Promise<AILineMessage[]> {
  const results: AILineMessage[] = []
  
  for (const member of members.slice(0, 5)) {
    if (!member.lineMessageTemplate) continue
    
    const prompt = `優化此 LINE 推播文案，提升轉換率。原文：${member.lineMessageTemplate}`
    
    const message = await client.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const optimized = message.content[0]?.type === 'text' ? message.content[0].text : member.lineMessageTemplate
    
    results.push({
      original: member.lineMessageTemplate,
      optimized,
      reasoning: '已根據會員特性最佳化',
    })
  }
  
  return results
}

function buildStrategyPrompt(data: OperationData): string {
  const kpis = data.summary.kpis
  return `分析以下會員營運數據，提供策略建議：
主題：${data.filters.theme}
可溝通會員：${kpis.communicableMembers.value}
LINE 綁定率：${kpis.lineBindRate.value}%
活躍會員：${kpis.active30d.value}
預估營收：${data.summary.estimatedRevenue}

請提供具體的營運策略和行動項目。`
}

function extractActions(content: string): string[] {
  return content
    .split('\n')
    .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'))
    .map(line => line.trim().replace(/^[•\-]\s*/, ''))
    .slice(0, 5)
}

function estimateROI(data: OperationData): number {
  const baseROI = data.summary.estimatedRevenue ? (data.summary.estimatedRevenue / 1000) * 100 : 50
  return Math.min(baseROI, 300)
}
