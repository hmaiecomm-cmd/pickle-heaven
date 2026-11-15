/** 球場新增／修改的欄位驗證（API 共用）。回傳錯誤訊息，或整理後的資料。 */

export interface CourtInput {
  name: string
  capacity: number
  indoor: boolean
  covered: boolean
  surface: string | null
  sortOrder: number
}

type Raw = Partial<Record<keyof CourtInput, unknown>>

export function parseCourtInput(body: Raw, partial: boolean): { error: string } | { data: Partial<CourtInput> } {
  const data: Partial<CourtInput> = {}
  const has = (k: keyof CourtInput) => body[k] !== undefined

  if (has('name') || !partial) {
    const name = String(body.name ?? '').trim()
    if (!name) return { error: '球場名稱不可空白' }
    if (name.length > 30) return { error: '球場名稱最多 30 字' }
    data.name = name
  }
  if (has('capacity') || !partial) {
    const n = Number(body.capacity ?? 4)
    if (!Number.isInteger(n) || n < 1 || n > 40) return { error: '容納人數需為 1 到 40 的整數' }
    data.capacity = n
  }
  if (has('sortOrder')) {
    const n = Number(body.sortOrder)
    if (!Number.isInteger(n) || n < 0 || n > 999) return { error: '排序需為 0 到 999 的整數' }
    data.sortOrder = n
  }
  if (has('indoor')) {
    if (typeof body.indoor !== 'boolean') return { error: '室內／室外格式錯誤' }
    data.indoor = body.indoor
  }
  if (has('covered')) {
    if (typeof body.covered !== 'boolean') return { error: '雨棚格式錯誤' }
    data.covered = body.covered
  }
  if (has('surface')) {
    const s = body.surface === null ? '' : String(body.surface).trim()
    if (s.length > 30) return { error: '地面材質最多 30 字' }
    data.surface = s || null
  }
  return { data }
}
