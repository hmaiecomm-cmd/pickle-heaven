'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/admin-auth'

/**
 * 活動主持人／負責人。
 * 前台只公開 name／photo／bio／publicContact；internal* 只有後台看得到。
 * 綁定會員只用來對應人員，不授予任何後台權限。
 */

type R<T> = ({ ok: true; message?: string } & T) | { ok: false; message: string }

const hostSchema = z.object({
  name: z.string().trim().min(1, '請填寫姓名').max(40),
  photoAssetId: z.string().nullable(),
  bio: z.string().trim().max(500).nullable(),
  publicContact: z.string().trim().max(120).nullable(),
  internalPhone: z.string().trim().max(40).nullable(),
  internalEmail: z.string().trim().max(120).nullable(),
  internalNote: z.string().trim().max(500).nullable(),
  userId: z.string().nullable(),
})
export type HostInput = z.infer<typeof hostSchema>

export interface HostRow extends HostInput {
  id: string
  active: boolean
  memberName: string | null
}

async function venueId() {
  await requirePermission('activities')
  const v = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
  if (!v) throw new Error('尚未設定場館')
  return v.id
}

export async function listHostsAction(query = ''): Promise<R<{ hosts: HostRow[] }>> {
  try {
    const vid = await venueId()
    const q = query.trim()
    const rows = await prisma.host.findMany({
      where: { venueId: vid, ...(q ? { name: { contains: q } } : {}) },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      take: 50,
    })
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId).filter((x): x is string => Boolean(x)) } }, select: { id: true, displayName: true } })
    const nameOf = new Map(users.map((u) => [u.id, u.displayName]))
    return {
      ok: true,
      hosts: rows.map((r) => ({
        id: r.id,
        name: r.name,
        photoAssetId: r.photoAssetId,
        bio: r.bio,
        publicContact: r.publicContact,
        internalPhone: r.internalPhone,
        internalEmail: r.internalEmail,
        internalNote: r.internalNote,
        userId: r.userId,
        active: r.active,
        memberName: r.userId ? (nameOf.get(r.userId) ?? null) : null,
      })),
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : '讀取失敗' }
  }
}

/** 搜尋會員當主持人（只回顯示名稱與遮罩電話） */
export async function searchMembersForHostAction(query: string): Promise<R<{ members: { id: string; name: string; phoneMasked: string | null }[] }>> {
  try {
    await requirePermission('activities')
    const q = query.trim()
    if (!q) return { ok: true, members: [] }
    const rows = await prisma.user.findMany({ where: { OR: [{ displayName: { contains: q } }, { phone: { contains: q } }] }, select: { id: true, displayName: true, phone: true }, take: 10 })
    return { ok: true, members: rows.map((u) => ({ id: u.id, name: u.displayName, phoneMasked: u.phone ? `${u.phone.slice(0, 4)}***${u.phone.slice(-3)}` : null })) }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : '搜尋失敗' }
  }
}

export async function saveHostAction(id: string | null, input: unknown): Promise<R<{ host: { id: string; name: string } }>> {
  try {
    const vid = await venueId()
    const v = hostSchema.parse(input)
    const data = { ...v, bio: v.bio || null, publicContact: v.publicContact || null, internalPhone: v.internalPhone || null, internalEmail: v.internalEmail || null, internalNote: v.internalNote || null }
    const host = id ? await prisma.host.update({ where: { id }, data }) : await prisma.host.create({ data: { ...data, venueId: vid } })
    revalidatePath('/admin/activities')
    return { ok: true, host: { id: host.id, name: host.name }, message: id ? '已更新主持人' : '已新增主持人' }
  } catch (err) {
    return { ok: false, message: err instanceof z.ZodError ? (err.errors[0]?.message ?? '輸入資料有誤') : err instanceof Error ? err.message : '儲存失敗' }
  }
}

export async function setHostActiveAction(id: string, active: boolean): Promise<R<object>> {
  try {
    await venueId()
    await prisma.host.update({ where: { id }, data: { active } })
    revalidatePath('/admin/activities')
    return { ok: true, message: active ? '已啟用' : '已停用（既有活動保留紀錄，前台不再顯示）' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : '更新失敗' }
  }
}
