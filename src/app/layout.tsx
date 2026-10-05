import type { Metadata, Viewport } from 'next'
import './globals.css'
import { LiffProvider } from '@/components/liff-provider'
import { ToastProvider } from '@/components/ui/toast'
import { CartStoreProvider } from '@/store/cart'
import { AppShell } from '@/components/app-shell'
import { getSessionUser } from '@/lib/session'
import { getCartToken } from '@/lib/session'
import { getCart } from '@/lib/availability'

export const metadata: Metadata = {
  title: {
    default: '匹克天堂 · 場地預約',
    template: '%s｜匹克天堂',
  },
  description: '台灣室內匹克球場線上預約系統。選日期、挑場地、加入購物車，於 LINE 內完成付款。',
  applicationName: '匹克天堂',
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    title: '匹克天堂 · 場地預約',
    description: '室內恆溫匹克球場，線上即時查詢空檔並完成預約。',
    locale: 'zh_TW',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0fa36b' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
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
