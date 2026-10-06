import type { Metadata } from 'next'
import { AiAssistantClient } from './ai-assistant-client'

export const metadata: Metadata = { title: 'AI 管理助理' }

export default function AiAssistantPage() {
  return <AiAssistantClient />
}
