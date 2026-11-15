/**
 * 排程服務 — 預約到迴路控制狀態的計算引擎
 *
 * 責務：
 * 1. 監聽預約事件（建立、確認、取消、改期）
 * 2. 計算受影響球場的排程
 * 3. 合併連續或重疊預約
 * 4. 生成 ControlCommand（待 MQTT 發送）
 * 5. 管理營業時間與夜間情境的排程
 */

import 'server-only'
import { prisma } from '@/lib/db'
import { now, taipeiDateString, taipeiToUtc, addMinutes, addDays, taipeiMinuteOfDay, taipeiWeekday } from '@/lib/time'
import { CircuitNumber, CIRCUIT_DEFINITIONS, DEFAULT_CIRCUIT_CONFIG } from '@/lib/control-types'
import { randomUUID } from 'crypto'
import { circuitCommandBlocker } from '@/lib/circuit-guard'
import { deviceIntegration } from './monitor-service'

type CircuitState = 'ON' | 'OFF'

interface ScheduleSlot {
  startsAt: Date
  endsAt: Date
  circuits: CircuitNumber[]
  reason: 'RESERVATION' | 'OPERATING_HOURS' | 'NIGHT_AMBIENT' | 'MANUAL_OVERRIDE'
  reasonId?: string // reservationId / overrideId
}

/** 依球場排序對應的預約動態迴路：第 1 面球場 01、02，第 2 面球場 03、04 */
const COURT_CIRCUITS: CircuitNumber[][] = [
  ['01', '02'],
  ['03', '04'],
]
const ALL_DAYS = '0,1,2,3,4,5,6'

type Window = { startMinute: number | null; endMinute: number | null; weekdays: string }

/**
 * 計算場館在特定時間各迴路的預期狀態（台北時間）。
 * - 預約動態（01–04）：該球場有預約／活動／封場，含每路迴路的提前開啟與延遲關閉分鐘數
 * - 營業時間（05–09）：該迴路的主排程；沒有則用場地設定的營業時間；另加自訂時段
 * - 夜間（10–11）：該迴路的主排程；沒有則用預設夜間時段；另加自訂時段
 * - 不可排程的迴路（24 小時供電、預留、停用）一律不納入，維持 OFF 且不會送出指令
 */
export async function calculateCircuitStates(
  venueId: string,
  atTime: Date,
): Promise<Record<CircuitNumber, CircuitState>> {
  const states = {} as Record<CircuitNumber, CircuitState>
  for (const num of Object.keys(CIRCUIT_DEFINITIONS) as CircuitNumber[]) states[num] = 'OFF'

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: {
      circuits: { include: { schedules: { where: { enabled: true } } } },
      courts: { where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true } },
    },
  })
  if (!venue) return states

  const minute = taipeiMinuteOfDay(atTime)
  const weekday = taipeiWeekday(taipeiDateString(atTime))
  const inWindow = (w: Window) => {
    if (w.startMinute === null || w.endMinute === null) return false
    if (!w.weekdays.split(',').map(Number).includes(weekday)) return false
    const end = w.endMinute > 1440 ? w.endMinute - 1440 : w.endMinute
    return isWithinTimeRange(minute, w.startMinute, end)
  }

  for (const circuit of venue.circuits) {
    const n = circuit.circuitNumber as CircuitNumber
    const def = CIRCUIT_DEFINITIONS[n]
    if (!def || circuitCommandBlocker(circuit, 'SCHEDULE')) continue
    const own = circuit.schedules.filter((x) => x.category === def.category)
    const main = own.find((x) => x.note === null)
    const custom = own.filter((x) => x.note !== null)

    if (def.category === 'RESERVATION_DYNAMIC') {
      const court = venue.courts[COURT_CIRCUITS.findIndex((g) => g.includes(n))]
      if (!court) continue
      const advance = circuit.reservationAdvanceMinutes ?? DEFAULT_CIRCUIT_CONFIG.reservation.advanceMinutes
      const delay = circuit.reservationDelayMinutes ?? DEFAULT_CIRCUIT_CONFIG.reservation.delayMinutes
      // 預約與活動一律開啟；人工封場依該筆設定，清潔維護依維護計畫設定是否需要照明
      const hit = await prisma.reservation.count({
        where: {
          courtId: court.id,
          startsAt: { lte: addMinutes(atTime, advance) },
          endsAt: { gt: addMinutes(atTime, -delay) },
          OR: [
            { status: { in: ['BOOKED', 'EVENT'] } },
            { status: 'BLOCKED', maintenanceEventId: null, lighting: true },
            { status: 'BLOCKED', maintenanceEvent: { plan: { lighting: true } } },
          ],
        },
      })
      if (hit > 0) states[n] = 'ON'
    } else if (def.category === 'OPERATING_HOURS') {
      const base: Window = main ?? { startMinute: venue.openMinute, endMinute: venue.closeMinute, weekdays: ALL_DAYS }
      if (inWindow(base) || custom.some(inWindow)) states[n] = 'ON'
    } else if (def.category === 'NIGHT_AMBIENT') {
      const base: Window = main ?? DEFAULT_CIRCUIT_CONFIG.nightAmbience
      if (inWindow(base) || custom.some(inWindow)) states[n] = 'ON'
    }
  }

  return states
}

/**
 * 重新計算預約受影響的球場排程
 *
 * 被呼叫於：
 * - 預約建立
 * - 預約確認
 * - 預約取消
 * - 預約改期
 */
export async function recalculateReservationSchedule(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { court: { include: { venue: true } } },
  })

  if (!reservation) return

  const { court, startsAt, endsAt, status } = reservation
  const venue = court.venue

  // 計算受影響的時間範圍（包括提前開啟與延遲關閉）
  const circuits = getCircuitsForCourt(court.sortOrder + 1)

  if (circuits.length === 0) return

  // 查詢該球場在這個時間段的所有有效預約
  const overlappingReservations = await prisma.reservation.findMany({
    where: {
      courtId: court.id,
      status: { in: ['BOOKED', 'EVENT', 'BLOCKED'] },
      // 時間重疊或接近的預約
      startsAt: { lt: addMinutes(endsAt, 60) },
      endsAt: { gt: addMinutes(startsAt, -60) },
    },
    orderBy: { startsAt: 'asc' },
  })

  // 如果當前預約被取消或狀態無效，則跳過
  if (status === 'HELD' || status === undefined) {
    // 尋找替代的預約
    if (overlappingReservations.length === 0) {
      // 沒有其他預約，發送關閉命令
      await sendCircuitCommand(venue.id, circuits, 'OFF', 'SCHEDULE', reservationId)
    }
    return
  }

  // 合併連續或重疊的預約時段
  const mergedSlots = mergeReservationSlots(overlappingReservations)

  // 為每個合併的時段生成命令
  for (const slot of mergedSlots) {
    await sendCircuitCommand(venue.id, circuits, 'ON', 'SCHEDULE', reservationId)
  }
}

/**
 * 發送迴路控制命令到 MQTT
 *
 * 該函數只生成 ControlCommand 記錄，實際 MQTT 發送由 mqtt-service.ts 處理
 */
export async function sendCircuitCommand(
  venueId: string,
  circuits: CircuitNumber[],
  targetState: CircuitState,
  source: 'SCHEDULE' | 'MANUAL_OVERRIDE' | 'EMERGENCY',
  reservationId?: string,
): Promise<string[]> {
  const commandIds: string[] = []
  const expiresAt = addMinutes(new Date(), 5) // 命令 5 分鐘有效期

  for (const circuitNum of circuits) {
    const circuit = await prisma.circuit.findUnique({
      where: { circuitNumber: circuitNum },
    })

    if (!circuit) continue

    const blocker = circuitCommandBlocker(circuit, source)
    if (blocker) {
      await prisma.controlEvent.create({
        data: {
          eventId: randomUUID(),
          venueId,
          circuitId: circuit.id,
          reservationId,
          eventType: 'COMMAND_FAILED',
          severity: 'WARNING',
          environment: 'SIMULATION',
          title: `迴路 ${circuitNum} 指令已攔截`,
          description: blocker,
          data: { targetState, source, blocked: true },
        },
      })
      continue
    }

    const commandId = randomUUID()

    const command = await prisma.controlCommand.create({
      data: {
        commandId,
        circuitId: circuit.id,
        source,
        targetState,
        status: 'PENDING',
        reservationId,
        expiresAt,
        simulated: true, // 在沒有真實設備時，所有命令都是模擬的
      },
    })

    commandIds.push(command.id)

    // 記錄事件
    await prisma.controlEvent.create({
      data: {
        eventId: randomUUID(),
        venueId,
        circuitId: circuit.id,
        commandId: command.id,
        reservationId,
        eventType: 'COMMAND_SENT',
        severity: 'INFO',
        environment: 'SIMULATION',
        title: `迴路 ${circuitNum} 控制命令已生成`,
        description: `目標狀態: ${targetState}, 來源: ${source}`,
        data: {
          targetState,
          source,
          reason: source === 'SCHEDULE' ? '排程控制' : '人工操作',
        },
      },
    })
  }

  return commandIds
}

/**
 * 合併連續或重疊的預約時段
 */
function mergeReservationSlots(reservations: any[]): ScheduleSlot[] {
  if (reservations.length === 0) return []

  const sorted = [...reservations].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const merged: ScheduleSlot[] = []

  let current: ScheduleSlot = {
    startsAt: sorted[0].startsAt,
    endsAt: sorted[0].endsAt,
    circuits: [],
    reason: 'RESERVATION',
  }

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]

    // 如果與當前時段有重疊或相鄰，則合併
    if (next.startsAt <= current.endsAt) {
      current.endsAt = new Date(Math.max(current.endsAt.getTime(), next.endsAt.getTime()))
    } else {
      merged.push(current)
      current = {
        startsAt: next.startsAt,
        endsAt: next.endsAt,
        circuits: [],
        reason: 'RESERVATION',
      }
    }
  }

  merged.push(current)
  return merged
}

/**
 * 根據球場編號取得對應的迴路
 *
 * 球場 1 (A) → 01, 02
 * 球場 2 (B) → 03, 04
 * 其他 → []
 */
function getCircuitsForCourt(courtNum: number): CircuitNumber[] {
  if (courtNum === 1) return ['01', '02']
  if (courtNum === 2) return ['03', '04']
  return []
}

/**
 * 檢查當前時間是否在指定時間範圍內
 *
 * @param minuteOfDay 當前分鐘（0-1439）
 * @param startMinute 開始分鐘
 * @param endMinute 結束分鐘（可跨日，例如 1440+）
 */
function isWithinTimeRange(minuteOfDay: number, startMinute: number, endMinute: number): boolean {
  if (startMinute < endMinute) {
    // 不跨日
    return minuteOfDay >= startMinute && minuteOfDay < endMinute
  } else {
    // 跨日（例如 22:00 - 08:00）
    return minuteOfDay >= startMinute || minuteOfDay < (endMinute % 1440)
  }
}


type OverrideFields = { overrideMode: string | null; overrideBaseline: string | null; overrideUntil: Date | null }

/** 手動操作是否仍在維持期間（computed：排程此刻算出的狀態） */
export function overrideActive(c: OverrideFields, computed: CircuitState, at: Date): boolean {
  if (c.overrideMode === 'INDEFINITE') return true
  if (c.overrideMode === 'MINUTES') return c.overrideUntil !== null && c.overrideUntil > at
  if (c.overrideMode === 'NEXT_CHANGE') return c.overrideBaseline === computed
  return false
}

/**
 * Cron 任務：每分鐘依排程更新各迴路的預期狀態。
 * - 手動操作維持期間內不改變；維持結束時清除並記錄 OVERRIDE_EXPIRED，交回排程
 * - 未串接設備時只記錄預期狀態，不產生控制指令（避免累積無法送出的指令被 Watchdog 判為異常）
 */
export async function checkAndUpdateSchedules() {
  const venues = await prisma.venue.findMany({
    where: { active: true },
    include: { circuits: true, courts: true },
  })
  const currentTime = now()
  const connected = (await deviceIntegration()).mode !== 'NOT_CONNECTED'

  for (const venue of venues) {
    const states = await calculateCircuitStates(venue.id, currentTime)
    for (const circuit of venue.circuits) {
      // 24 小時供電、預留、停用或不接受排程的迴路不由排程改變狀態
      if (circuitCommandBlocker(circuit, 'SCHEDULE')) continue
      const expectedState = states[circuit.circuitNumber as CircuitNumber]
      let current = circuit.expectedState

      if (circuit.overrideMode) {
        if (overrideActive(circuit, expectedState, currentTime)) continue
        await prisma.circuit.update({
          where: { id: circuit.id },
          data: { overrideMode: null, overrideState: null, overrideBaseline: null, overrideUntil: null, overrideBy: null },
        })
        await prisma.controlEvent.create({
          data: {
            eventId: randomUUID(),
            venueId: venue.id,
            circuitId: circuit.id,
            eventType: 'OVERRIDE_EXPIRED',
            severity: 'INFO',
            environment: connected ? 'PRODUCTION' : 'SIMULATION',
            title: `迴路 ${circuit.circuitNumber} 手動操作結束，交回排程`,
            description: `維持方式 ${circuit.overrideMode}，排程目前為 ${expectedState}`,
            data: { mode: circuit.overrideMode, overrideState: circuit.overrideState, scheduleState: expectedState },
          },
        })
        current = circuit.overrideState ?? current
      }

      if (current !== expectedState) {
        await prisma.circuit.update({ where: { id: circuit.id }, data: { expectedState } })
        if (connected) await sendCircuitCommand(venue.id, [circuit.circuitNumber as CircuitNumber], expectedState, 'SCHEDULE')
      }
    }
  }
}
