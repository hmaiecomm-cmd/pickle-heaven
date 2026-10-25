import type { Metadata } from 'next'
import { LineCheckClient } from './line-check-client'

export const metadata: Metadata = { title: 'LINE 連線狀態', robots: { index: false, follow: false } }

/** LINE 連線診斷：顯示目前裝置的 LIFF 登入與官方帳號好友狀態（只看得到自己的） */
export default function LineCheckPage() {
  return <LineCheckClient />
}
