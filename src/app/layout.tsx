import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { AuthProvider } from '@/components/auth-provider'
import { ToastProvider } from '@/components/ui/toast'
import { CartStoreProvider } from '@/store/cart'
import { AppShell } from '@/components/app-shell'
import { getSessionUser } from '@/lib/session'
import { getCartToken } from '@/lib/session'
import { getCart } from '@/lib/availability'
import { getAdminUser } from '@/lib/admin-auth'
import { googleConfigured } from '@/lib/google-auth'
import { brand, SITE_URL } from '@/config/site'

// 前台一律使用對外場館名稱；後台在 admin/layout 另外設定系統名稱
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${brand.name}｜場地預約`,
    template: `%s｜${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    title: `${brand.name}｜場地預約`,
    description: brand.description,
    siteName: brand.name,
    locale: 'zh_TW',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: `${brand.name} ${brand.englishName}` }],
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#30223D' },
    { media: '(prefers-color-scheme: dark)', color: '#30223D' },
  ],
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, cartToken, h, admin] = await Promise.all([getSessionUser(), getCartToken(), headers(), getAdminUser().catch(() => null)])
  const cart = await getCart(cartToken)
  const area = h.get('x-ph-area') === 'admin' ? 'admin' : 'public'
  // 開發登入只在本機且明確開啟時可用，正式環境一律關閉
  const devLoginEnabled = process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN === '1'

  return (
    <html lang="zh-Hant-TW" data-area={area} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ToastProvider>
          <AuthProvider initialUser={user} googleConfigured={googleConfigured()} devLoginEnabled={devLoginEnabled}>
            <CartStoreProvider initialCart={cart}>
              <AppShell user={user} isAdmin={Boolean(admin)}>
                {children}
              </AppShell>
            </CartStoreProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
