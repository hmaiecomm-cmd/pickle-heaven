import { CIRCUIT_DEFINITIONS, type CircuitNumber } from './control-types'

export type CircuitCommandSource = 'SCHEDULE' | 'MANUAL_OVERRIDE' | 'EMERGENCY'

export interface GuardedCircuit {
  circuitNumber: string
  category: string
  enabled: boolean
  remoteControlEnabled: boolean
  scheduleControlEnabled: boolean
}

const PROTECTED = new Set(['ALWAYS_ON', 'RESERVED'])

/** 24 小時供電與預留迴路：任何來源都不可由系統開關。以程式定義為準，資料庫被改成其他分類也一樣擋下。 */
export function isProtectedCircuit(c: Pick<GuardedCircuit, 'circuitNumber' | 'category'>): boolean {
  const def = CIRCUIT_DEFINITIONS[c.circuitNumber as CircuitNumber]
  return PROTECTED.has(c.category) || (def !== undefined && PROTECTED.has(def.category))
}

/**
 * 送出迴路指令前的唯一檢查點（排程、預約結束、人工操作皆經過）。
 * 回傳不可執行的原因；可執行時回傳 null。
 */
export function circuitCommandBlocker(c: GuardedCircuit, source: CircuitCommandSource): string | null {
  const def = CIRCUIT_DEFINITIONS[c.circuitNumber as CircuitNumber]
  if (!def) return `迴路 ${c.circuitNumber} 不在 18 路定義中`
  if (isProtectedCircuit(c)) {
    return def.category === 'RESERVED' ? `迴路 ${c.circuitNumber} 為預留迴路，未接設備` : `迴路 ${c.circuitNumber} 為 24 小時供電迴路，不可由系統開關`
  }
  if (!c.enabled) return `迴路 ${c.circuitNumber} 已停用`
  if (source === 'MANUAL_OVERRIDE' && !(c.remoteControlEnabled && def.remoteControlEnabled)) return `迴路 ${c.circuitNumber} 不允許遠端控制`
  if (source === 'SCHEDULE' && !(c.scheduleControlEnabled && def.scheduleControlEnabled)) return `迴路 ${c.circuitNumber} 不接受排程控制`
  return null
}
