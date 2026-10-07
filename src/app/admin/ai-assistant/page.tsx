import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { isAiConfigured } from '@/server/ai-assistant'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { AiChat } from '@/components/admin/ai-chat'

export const metadata: Metadata = { title: 'AI 助理對話' }

export default async function AiAssistantPage() {
  if ((await pagePermission('ai')) === 'forbidden') return <Forbidden />
  const configured = isAiConfigured()
  return (
    <div>
      <PageTitle
        title="AI 助理對話"
        desc={configured ? '小匹會依你的權限查詢資料；退款、通知、設備等操作只會產生預覽，由你確認後才執行。' : 'AI 模型尚未設定（ANTHROPIC_API_KEY），目前可使用快捷查詢；自由提問會導向對應的系統查詢或說明可用範圍。'}
      />
      <div className="h-[70vh] overflow-hidden rounded-2xl border border-zinc-200">
        <AiChat />
      </div>
    </div>
  )
}
