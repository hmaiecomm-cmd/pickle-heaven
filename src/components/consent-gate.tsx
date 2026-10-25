'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { acceptConsent } from '@/server/actions'
import { useAuth } from '@/components/auth-provider'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { PRIVACY_NOTICE_TITLE, PrivacyNoticeBody } from '@/components/legal/privacy-notice'
import { brand, legal } from '@/config/site'
import { cn } from '@/lib/utils'

/** 這些頁面本身就是條款內容，不蓋上同意畫面，讓會員可另開分頁閱讀 */
const EXEMPT_PATHS = ['/privacy', '/terms']

/**
 * 登入後的同意畫面：尚未同意目前版本的告知事項與服務條款時出現，完成前無法使用網站。
 * - 告知事項全文須捲動到底，才能勾選「已閱讀」。
 * - 服務條款為必要勾選；行銷同意另行勾選、不預先勾選。
 */
export function ConsentGate() {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const { logout } = useAuth()
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [readToEnd, setReadToEnd] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [notice, setNotice] = React.useState(false)
  const [terms, setTerms] = React.useState(false)
  const [marketing, setMarketing] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const ratio = max <= 0 ? 1 : el.scrollTop / max
    setProgress(Math.min(100, Math.round(ratio * 100)))
    // 留一點容差，避免不同裝置的小數像素讓最後一格永遠到不了
    if (max <= 0 || el.scrollTop >= max - 8) setReadToEnd(true)
  }, [])

  React.useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [checkScroll])

  // 同意畫面開啟時鎖住背景捲動
  const active = !done && !EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  React.useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])

  if (!active) return null

  const submit = async () => {
    if (!notice || !terms) return
    setSubmitting(true)
    const res = await acceptConsent({ notice, terms, marketing })
    setSubmitting(false)
    if (!res.ok) {
      toast(res.error, 'error')
      return
    }
    setDone(true)
    toast('已完成同意，歡迎使用', 'info')
    router.refresh()
  }

  const company = legal.company ?? '本平台營運公司'

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="flex max-h-[100dvh] w-full max-w-2xl flex-col rounded-t-2xl surface shadow-xl sm:max-h-[92dvh] sm:rounded-2xl">
        <header className="flex items-start gap-3 border-b border-[rgb(var(--border))] px-4 pb-3 pt-4 sm:px-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 id="consent-title" className="text-base font-semibold">
              使用{brand.name}前，請閱讀並同意
            </h2>
            <p className="mt-0.5 text-xs text-muted">請將下方告知事項捲動到最底部，即可勾選同意。</p>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} onScroll={checkScroll} className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6" tabIndex={0} aria-label={PRIVACY_NOTICE_TITLE}>
            <h3 className="pt-4 text-lg font-bold">{PRIVACY_NOTICE_TITLE}</h3>
            <PrivacyNoticeBody />
            <p className="mt-6 text-center text-xs text-muted">— 告知事項到此結束 —</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-[rgb(var(--border))]" aria-hidden>
            <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${readToEnd ? 100 : progress}%` }} />
          </div>
        </div>

        <footer className="space-y-3 border-t border-[rgb(var(--border))] px-4 py-4 pb-safe sm:px-6">
          {!readToEnd && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">尚未閱讀到最底部（已閱讀 {progress}%），請繼續往下捲動。</p>}

          <Check checked={notice} onChange={setNotice} disabled={!readToEnd} required>
            我已閱讀「{brand.name}{PRIVACY_NOTICE_TITLE}」，並知悉資料處理範圍及權利申請方式。
          </Check>
          <Check checked={terms} onChange={setTerms} required>
            我已閱讀並同意
            <Link href="/terms" target="_blank" className="mx-0.5 underline underline-offset-2">
              服務條款
            </Link>
            。
          </Check>
          <Check checked={marketing} onChange={setMarketing}>
            我同意{company}使用我的姓名、聯絡方式及平台消費紀錄，向我提供本平台優惠與活動訊息。我可隨時免費取消，且不影響基本會員及預約服務。
          </Check>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => void logout()} disabled={submitting}>
              不同意並登出
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={!notice || !terms} loading={submitting}>
              同意並繼續
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Check({
  checked,
  onChange,
  disabled,
  required,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={cn('flex items-start gap-2.5 text-[13px] leading-relaxed', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {required ? <span className="mr-1 text-xs font-semibold text-red-600">必要</span> : <span className="mr-1 text-xs text-muted">選填</span>}
        {children}
      </span>
    </label>
  )
}
