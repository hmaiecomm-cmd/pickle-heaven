/**
 * 舊金流設定（平台訂閱）頁面 - 重定向至新的平台訂購頁面
 * @deprecated 已移至 /admin/settings/subscription
 */

import { redirect } from 'next/navigation'

export default function PlatformPaymentPage() {
  redirect('/admin/settings/subscription?tab=billing')
}
