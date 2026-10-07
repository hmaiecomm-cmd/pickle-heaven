import 'server-only'
import { toInt } from './admin-api'

/** 教練資料的驗證與正規化（新增與修改共用）。 */

export const COACH_STATUSES = ['ACTIVE', 'ON_LEAVE', 'INACTIVE'] as const
export type CoachStatusValue = (typeof COACH_STATUSES)[number]

export interface CoachInput {
  name?: unknown
  phone?: unknown
  email?: unknown
  status?: unknown
  specialties?: unknown
  hourlyRate?: unknown
  bio?: unknown
  availability?: unknown
}

export interface CoachData {
  name?: string
  phone?: string | null
  email?: string | null
  status?: CoachStatusValue
  specialties?: string[]
  hourlyRate?: number
  bio?: string | null
}

export interface Slot {
  dayOfWeek: number
  startMinute: number
  endMinute: number
}

/** partial = true 時只驗證有提供的欄位（PATCH 用）。回傳錯誤訊息或正規化結果。 */
export function parseCoachInput(body: CoachInput, partial: boolean): { error: string } | { data: CoachData; availability?: Slot[] } {
  const data: CoachData = {}
  const has = (k: keyof CoachInput) => body[k] !== undefined

  if (!partial || has('name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return { error: '請填寫教練姓名' }
    if (name.length > 40) return { error: '姓名最多 40 字' }
    data.name = name
  }
  if (has('phone')) {
    const v = typeof body.phone === 'string' ? body.phone.trim() : ''
    if (v.length > 30) return { error: '電話最多 30 字' }
    data.phone = v || null
  }
  if (has('email')) {
    const v = typeof body.email === 'string' ? body.email.trim() : ''
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { error: 'Email 格式不正確' }
    data.email = v || null
  }
  if (has('status')) {
    if (typeof body.status !== 'string' || !(COACH_STATUSES as readonly string[]).includes(body.status)) return { error: '狀態不正確' }
    data.status = body.status as CoachStatusValue
  }
  if (!partial || has('specialties')) {
    const list = Array.isArray(body.specialties) ? body.specialties : []
    const clean = [...new Set(list.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean))]
    if (clean.length > 10) return { error: '專長最多 10 項' }
    if (clean.some((x) => x.length > 20)) return { error: '每項專長最多 20 字' }
    data.specialties = clean
  }
  if (!partial || has('hourlyRate')) {
    const n = toInt(body.hourlyRate)
    if (n === null || n < 0 || n > 100000) return { error: '時薪需介於 0 到 100,000' }
    data.hourlyRate = n
  }
  if (has('bio')) {
    const v = typeof body.bio === 'string' ? body.bio.trim() : ''
    if (v.length > 1000) return { error: '簡介最多 1000 字' }
    data.bio = v || null
  }

  let availability: Slot[] | undefined
  if (!partial || has('availability')) {
    const raw = Array.isArray(body.availability) ? body.availability : []
    if (raw.length > 21) return { error: '可授課時段最多 21 段' }
    availability = []
    for (const r of raw as Record<string, unknown>[]) {
      const d = toInt(r?.dayOfWeek)
      const s = toInt(r?.startMinute)
      const e = toInt(r?.endMinute)
      if (d === null || d < 0 || d > 6) return { error: '星期不正確' }
      if (s === null || e === null || s < 0 || e > 1440 || s >= e) return { error: '時段的結束時間必須晚於開始時間' }
      availability.push({ dayOfWeek: d, startMinute: s, endMinute: e })
    }
    // 同一天的時段不可重疊
    const sorted = [...availability].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].dayOfWeek === sorted[i - 1].dayOfWeek && sorted[i].startMinute < sorted[i - 1].endMinute) return { error: '同一天的時段不可重疊' }
    }
    availability = sorted
  }
  return { data, availability }
}

export function serializeCoach(c: {
  id: string
  name: string
  phone: string | null
  email: string | null
  status: string
  specialties: unknown
  hourlyRate: number
  bio: string | null
  availability: { dayOfWeek: number; startMinute: number; endMinute: number }[]
}) {
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? '',
    email: c.email ?? '',
    status: c.status,
    specialties: Array.isArray(c.specialties) ? (c.specialties as string[]) : [],
    hourlyRate: c.hourlyRate,
    bio: c.bio ?? '',
    availability: c.availability.map((a) => ({ dayOfWeek: a.dayOfWeek, startTime: hhmm(a.startMinute), endTime: hhmm(a.endMinute) })),
  }
}
