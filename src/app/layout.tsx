import type { Metadata, Viewport } from 'next'
import './globals.css'
import { LiffProvider } from '@/components/liff-provider'
import { ToastProvider } from '@/components/ui/toast'
import { CartStoreProvider } from '@/store/cart'
import { AppShell } from '@/components/app-shell'
import { getSessionUser } from '@/lib/session'
import { getCartToken } from '@/lib/session'
import { getCart } from '@/lib/availability'
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
    { media: '(prefers-color-scheme: light)', color: '#281343' },
    { media: '(prefers-color-scheme: dark)', color: '#281343' },
  ],
  // LIFF 全螢幕模式需要延伸到安全區域
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, cartToken] = await Promise.all([getSessionUser(), getCartToken()])
  const cart = await getCart(cartToken)

  return (
    <html lang="zh-Hant-TW" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ToastProvider>
          <LiffProvider initialUser={user}>
            <CartStoreProvider initialCart={cart}>
              <AppShell user={user}>{children}</AppShell>
            </CartStoreProvider>
          </LiffProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
