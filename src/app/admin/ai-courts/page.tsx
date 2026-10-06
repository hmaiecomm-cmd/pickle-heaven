import { requireAdmin } from '@/lib/admin-auth'
import { AICourtsClient } from './ai-courts-client'

export const metadata = {
  title: 'AI智慧球場',
}

export const dynamic = 'force-dynamic'

export default async function AICortsPage() {
  await requireAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">🤖 AI 無人管理系統</h1>
        <p className="mt-1 text-sm text-muted">讓球場自己營運｜Access · Automation · Security · Energy</p>
      </div>

      <AICourtsClient />
    </div>
  )
}
