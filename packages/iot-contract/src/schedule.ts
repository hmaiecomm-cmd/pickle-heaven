import type { CircuitDef, CircuitNo, CircuitOverride, DoorCode, OnOff, SitePlan } from './types'

/**
 * 地端執行計畫的參考邏輯（模擬器使用，地端廠商可照此實作）。
 * 純函式、不依賴任何套件。
 */

const ms = (iso: string) => Date.parse(iso)

/** 排程結果：時間表裡任何一段包含 at 就是 ON */
export function scheduledState(plan: Pick<SitePlan, 'timeline'>, circuit: CircuitNo, at: number): OnOff {
  for (const i of plan.timeline) {
    if (i.circuit === circuit && ms(i.start) <= at && at < ms(i.end)) return 'ON'
  }
  return 'OFF'
}

/** 手動操作是否仍在維持 */
export function overrideActive(o: CircuitOverride, scheduled: OnOff, at: number): boolean {
  if (o.hold.mode === 'INDEFINITE') return true
  if (o.hold.mode === 'MINUTES') return !!o.hold.until && ms(o.hold.until) > at
  // NEXT_CHANGE：排程結果還跟手動當下一樣就繼續維持
  return o.baseline === undefined ? true : o.baseline === scheduled
}

/**
 * 某一路此刻該有的狀態。
 * - ALWAYS_ON 一律 ON；RESERVED 一律 OFF
 * - 有效的手動操作優先；否則照排程
 * 回傳 expiredOverride=true 表示手動維持剛結束，呼叫端應把它移除。
 */
export function desiredState(
  def: CircuitDef,
  plan: Pick<SitePlan, 'timeline'>,
  override: CircuitOverride | undefined,
  at: number,
): { state: OnOff; source: 'FIXED' | 'OVERRIDE' | 'SCHEDULE'; expiredOverride: boolean } {
  if (def.kind === 'ALWAYS_ON') return { state: 'ON', source: 'FIXED', expiredOverride: false }
  if (def.kind === 'RESERVED') return { state: 'OFF', source: 'FIXED', expiredOverride: false }
  const scheduled = def.schedule ? scheduledState(plan, def.no, at) : 'OFF'
  if (override) {
    if (overrideActive(override, scheduled, at)) return { state: override.state, source: 'OVERRIDE', expiredOverride: false }
    return { state: scheduled, source: 'SCHEDULE', expiredOverride: true }
  }
  return { state: scheduled, source: 'SCHEDULE', expiredOverride: false }
}

/** 此刻可開門的密碼 */
export function activeDoorCodes(plan: Pick<SitePlan, 'doorCodes'>, at: number, door = 'main'): DoorCode[] {
  return plan.doorCodes.filter((c) => c.doors.includes(door) && ms(c.validFrom) <= at && at < ms(c.validTo))
}

/** 驗證門鎖輸入 */
export function checkDoorCode(plan: Pick<SitePlan, 'doorCodes'>, input: string, at: number, door = 'main'): DoorCode | null {
  return activeDoorCodes(plan, at, door).find((c) => c.code === input) ?? null
}

/** 計畫快到期（地端應在 window.to 前至少 6 小時拿到新版） */
export function planStale(plan: Pick<SitePlan, 'window'>, at: number, marginMs = 6 * 3600_000): boolean {
  return ms(plan.window.to) - at < marginMs
}

/** 某時刻有預約的球場（依 COURT 類迴路的 BOOKING/EVENT 區間） */
export function bookedCourts(plan: Pick<SitePlan, 'timeline' | 'circuits'>, at: number): string[] {
  const courts = new Set<string>()
  for (const d of plan.circuits) {
    if (d.kind !== 'COURT' || !d.court) continue
    const hit = plan.timeline.some((i) => i.circuit === d.no && (i.reason === 'BOOKING' || i.reason === 'EVENT') && ms(i.start) <= at && at < ms(i.end))
    if (hit) courts.add(d.court)
  }
  return [...courts]
}
