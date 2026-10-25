import type { Metadata } from 'next'
import Link from 'next/link'
import { brand } from '@/config/site'
import { PRIVACY_NOTICE_TITLE, PrivacyNoticeBody, PrivacyNoticeVersion } from '@/components/legal/privacy-notice'

export const metadata: Metadata = { title: PRIVACY_NOTICE_TITLE, robots: { index: true, follow: true } }

/** 蒐集、處理及利用個人資料法定告知事項（本文見 components/legal/privacy-notice） */
export default function PrivacyPage() {
  return (
    <article className="prose-ph mx-auto max-w-3xl py-4">
      <p className="text-sm font-semibold text-muted">{brand.name}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{PRIVACY_NOTICE_TITLE}</h1>
      <p className="mt-1 text-xs text-muted">
        版本日期：<PrivacyNoticeVersion />
      </p>

      <PrivacyNoticeBody />

      <p className="mt-8 text-xs text-muted">
        另請參閱 <Link href="/terms" className="underline underline-offset-2">服務條款</Link>。
      </p>
    </article>
  )
}
