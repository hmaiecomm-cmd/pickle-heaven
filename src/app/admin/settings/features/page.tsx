/**
 * 舊功能加購頁面 - 重定向至新的平台訂購頁面
 * @deprecated 已移至 /admin/settings/subscription
 */

import { redirect } from 'next/navigation'

export default function FeaturesPage() {
  redirect('/admin/settings/subscription?tab=addons')
}
