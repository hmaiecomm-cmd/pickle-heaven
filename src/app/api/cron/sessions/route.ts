import { NextResponse } from 'next/server'
import { runAllSessionJobs } from '@/server/session-scheduler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 球敘生命週期排程（規格 §12）。
 *
 * 由 Vercel Cron 依 vercel.json 的設定呼叫，會帶入
 * Authorization: Bearer $CRON_SECRET。
 *
 * 所有任務皆為冪等，重複呼叫不會重複發通知、重複遞補或重複產生場次，
 * 因此也可以安全地手動觸發以便測試。
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    const result = await runAllSessionJobs()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/sessions] 執行失敗', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' },
      { status: 500 },
    )
  }
}
