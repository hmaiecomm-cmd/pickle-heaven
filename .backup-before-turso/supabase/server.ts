import 'server-only'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieToSet = { name: string; value: string; options?: CookieOptions }

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/**
 * Supabase 伺服器端 client（僅供後台管理者驗證使用）。
 * 顧客端一律使用 LINE 登入，不經過 Supabase Auth。
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            }
          } catch {
            // 在 Server Component 中無法寫入 cookie，交由 Server Action / Route Handler 處理
          }
        },
      },
    },
  )
}
