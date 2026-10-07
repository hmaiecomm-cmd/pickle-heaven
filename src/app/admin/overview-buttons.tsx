'use client'

import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { useAi } from '@/components/admin/ai-context'
import { Avatar } from '@/components/admin/ai-chat'

export function AskAiButton({ prompt }: { prompt?: string }) {
  const { ask } = useAi()
  return (
    <button type="button" onClick={() => ask(prompt)} className="flex h-10 items-center gap-2 rounded-full bg-white px-2 pr-3 text-sm font-semibold text-[#281343] hover:bg-violet-50">
      <Avatar size={26} />
      詢問 AI 助理
    </button>
  )
}

export function RefreshButton() {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.refresh()} className="flex h-10 items-center gap-1.5 rounded-full border border-white/40 px-3 text-sm text-white hover:bg-white/10">
      <RefreshCw className="h-4 w-4" aria-hidden />
      重新整理
    </button>
  )
}
