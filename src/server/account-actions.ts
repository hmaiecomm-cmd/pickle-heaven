'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { verifyLineIdToken } from '@/lib/line'

type Result<T> = ({ ok: true } & T) | { ok: false; error: string }

const profileSchema = z.object({
  displayName: z.string().trim().min(1, '請填寫顯示名稱').max(40, '名稱最多 40 字'),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^$|^0\d{8,9}$/, '手機號碼格式不正確'),
})

/** 更新顯示名稱與手機 */
export async function updateProfile(input: { displayName: string; phone: string }): Promise<Result<{ displayName: string; phone: string | null }>> {
  try {
    const user = await requireUser()
    const parsed = profileSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? '資料格式不正確' }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { displayName: parsed.data.displayName, phone: parsed.data.phone || null },
      select: { displayName: true, phone: true },
    })
    return { ok: true, ...updated }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '更新失敗' }
  }
}

/**
 * 綁定舊 LINE 帳號（身分驗證後遷移）。
 *
 * 由前端透過 LINE 官方登入取得 id_token，伺服器向 LINE 驗證後才認定該 LINE 身分屬於目前登入者。
 * - 該 LINE 身分已有舊會員：把舊會員的訂單、發票、折價券、報名、通知、點數與出席統計搬到目前帳號，再移除舊帳號。
 * - 尚無舊會員：只把 LINE 身分記到目前帳號（之後可收到 LINE 通知）。
 * 不會依姓名或 Email 自動合併。
 */
export async function linkLineAccount(idToken: string): Promise<Result<{ merged: boolean; movedBookings: number; movedPoints: number }>> {
  try {
    const me = await requireUser()
    if (!idToken) return { ok: false, error: '缺少 LINE 身分資料' }
    const profile = await verifyLineIdToken(idToken)

    const current = await prisma.user.findUnique({ where: { id: me.id }, select: { id: true, lineUserId: true } })
    if (!current) return { ok: false, error: '找不到帳號' }
    if (current.lineUserId === profile.lineUserId) return { ok: true, merged: false, movedBookings: 0, movedPoints: 0 }
    if (current.lineUserId) return { ok: false, error: '這個帳號已綁定另一個 LINE 身分，請聯絡櫃台處理' }

    const old = await prisma.user.findUnique({ where: { lineUserId: profile.lineUserId } })
    if (!old) {
      await prisma.user.update({ where: { id: me.id }, data: { lineUserId: profile.lineUserId } })
      return { ok: true, merged: false, movedBookings: 0, movedPoints: 0 }
    }
    if (old.googleSub) return { ok: false, error: '這個 LINE 身分已綁定到另一個 Google 帳號，請聯絡櫃台處理' }

    const result = await prisma.$transaction(async (tx) => {
      const [bookings] = await Promise.all([
        tx.booking.updateMany({ where: { userId: old.id }, data: { userId: me.id } }),
        tx.invoice.updateMany({ where: { userId: old.id }, data: { userId: me.id } }),
        tx.voucher.updateMany({ where: { userId: old.id }, data: { userId: me.id } }),
        tx.notificationLog.updateMany({ where: { userId: old.id }, data: { userId: me.id } }),
        tx.memberRestriction.updateMany({ where: { userId: old.id }, data: { userId: me.id } }),
      ])

      // 同一場次兩邊都有紀錄時保留目前帳號的那筆，避免違反唯一限制
      const mineRegs = await tx.sessionRegistration.findMany({ where: { userId: me.id }, select: { sessionId: true } })
      const mineSessionIds = mineRegs.map((r) => r.sessionId)
      await tx.sessionRegistration.updateMany({
        where: { userId: old.id, sessionId: { notIn: mineSessionIds } },
        data: { userId: me.id },
      })
      const mineWatches = await tx.sessionWatch.findMany({ where: { userId: me.id }, select: { sessionId: true } })
      await tx.sessionWatch.updateMany({
        where: { userId: old.id, sessionId: { notIn: mineWatches.map((w) => w.sessionId) } },
        data: { userId: me.id },
      })

      // 舊帳號移除後（連同殘留的重複報名／關注，皆為 cascade），才把 LINE 身分與點數記到目前帳號
      await tx.user.delete({ where: { id: old.id } })
      await tx.user.update({
        where: { id: me.id },
        data: {
          lineUserId: profile.lineUserId,
          points: { increment: old.points },
          sessionsJoined: { increment: old.sessionsJoined },
          sessionsCompleted: { increment: old.sessionsCompleted },
          normalCancelCount: { increment: old.normalCancelCount },
          lateCancelCount: { increment: old.lateCancelCount },
          noShowCount: { increment: old.noShowCount },
          membershipLevel: old.membershipLevel,
        },
      })
      return { movedBookings: bookings.count, movedPoints: old.points }
    })

    return { ok: true, merged: true, ...result }
  } catch (err) {
    console.error('[account] 綁定 LINE 失敗', err)
    return { ok: false, error: err instanceof Error && /LINE/.test(err.message) ? 'LINE 身分驗證失敗，請重試' : '綁定失敗，請稍後再試' }
  }
}
