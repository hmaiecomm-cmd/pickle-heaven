import 'server-only'
import type { Messages } from '@anthropic-ai/sdk/resources'

/**
 * 預佔位符：Anthropic AI 工具定義
 * 
 * 這個文件提供 ai-assistant.ts (Anthropic 實現) 所需的類型和函數。
 * 完整實現在 AI_ASSISTANT_IMPLEMENTATION_PLAN.md 的 Phase 4。
 */

export interface ActionPreview {
  toolName: string
  action: string
  description: string
  impact: string
}

export interface AITool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

export interface ToolResult {
  source: string
  note?: string
  period?: { from: Date; to: Date }
  data: unknown
}

export const AI_TOOLS: Messages.Tool[] = []

export function parseActionPreview(input: unknown): ActionPreview | null {
  if (!input || typeof input !== 'object') return null
  const obj = input as Record<string, unknown>
  if (!obj.title || !obj.items || !obj.impact) return null
  return {
    toolName: String(obj.title),
    action: 'preview',
    description: String(obj.items),
    impact: String(obj.impact),
  }
}

export async function runTool(name: string, input: unknown): Promise<ToolResult> {
  return {
    source: 'unknown',
    data: { error: 'Tool execution not implemented', toolName: name, input },
  }
}
