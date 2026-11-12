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
import { now, taipeiDateString, taipeiToUtc, addMinutes, addDays } from '@/lib/time'
import { CircuitNumber, CIRCUIT_DEFINITIONS } from '@/lib/control-types'
import { randomUUID } from 'crypto'

type CircuitState = 'ON' | 'OFF'

interface ScheduleSlot {
  startsAt: Date
  endsAt: Date
  circuits: CircuitNumber[]
  reason: 'RESERVATION' | 'OPERATING_HOURS' | 'NIGHT_AMBIENT' | 'MANUAL_OVERRIDE'
  reasonId?: string // reservationId / overrideId
}

/**
 * 計算球場在特定時間應該的預期迴路狀態
 */
export async function calculateCircuitStates(
  venueId: string,
  atTime: Date,
): Promise<Record<CircuitNumber, CircuitState>> {
  const states: Record<CircuitNumber, CircuitState> = {}

  // 初始化所有回路為 OFF
  for (const num of Object.keys(CIRCUIT_DEFINITIONS) as CircuitNumber[]) {
    states[num] = 'OFF'
  }

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { circuits: true, operatingHours: true },
  })
  if (!venue) return states

  const operatingHours = venue.operatingHours
  const taipeiDate = taipeiDateString(atTime)
  const minuteOfDay = getMinuteOfDay(atTime)

  // 1. 預約動態控制（01-04）
  const reservations = await prisma.reservation.findMany({
    where: {
      court: { venueId },
      startsAt: { lte: atTime },
      endsAt: { gt: atTime },
      status: { in: ['BOOKED', 'EVENT', 'BLOCKED'] },
    },
    include: { court: true },
  })

  for (const res of reservations) {
    const courtNum = res.court.sortOrder + 1
    if (courtNum === 1 || courtNum === 2) {
      // 球場 A: 迴路 01, 02
      states['01'] = 'ON'
      states['02'] = 'ON'
    } else if (courtNum === 3 || courtNum === 4) {
      // 球場 B: 迴路 03, 04
      states['03'] = 'ON'
      states['04'] = 'ON'
    }
  }

  // 2. 營業時間控制（05-09）
  if (operatingHours) {
    const isBizHours = isWithinTimeRange(
      minuteOfDay,
      operatingHours.businessStartMinute,
      operatingHours.businessEndMinute,
    )

    if (isBizHours) {
      // 檢查禁用日期
      const disabledDates = operatingHours.disabledDates ? operatingHours.disabledDates.split(',') : []
      if (!disabledDates.includes(taipeiDate)) {
        // 檢查適用星期
        const dayOfWeek = new Date(atTime).getDay()
        const applicableWeekdays = operatingHours.applicableWeekdays
          ? operatingHours.applicableWeekdays.split(',').map(Number)
          : [0, 1, 2, 3, 4, 5, 6]

        if (applicableWeekdays.includes(dayOfWeek)) {
          states['05'] = 'ON'
          states['06'] = 'ON'
          states['07'] = 'ON'
          states['08'] = 'ON'
          states['09'] = 'ON'
        }
      }
    }
  }

  // 3. 夜間情境控制（10-11）
  if (operatingHours) {
    const isNightTime = isWithinTimeRange(
      minuteOfDay,
      operatingHours.nightStartMinute,
      operatingHours.nightEndMinute,
    )

    if (isNightTime) {
      const disabledDates = operatingHours.disabledDates ? operatingHours.disabledDates.split(',') : []
      if (!disabledDates.includes(taipeiDate)) {
        const dayOfWeek = new Date(atTime).getDay()
        const applicableWeekdays = operatingHours.applicableWeekdays
          ? operatingHours.applicableWeekdays.split(',').map(Number)
          : [0, 1, 2, 3, 4, 5, 6]

        if (applicableWeekdays.includes(dayOfWeek)) {
          states['10'] = 'ON'
          states['11'] = 'ON'
        }
      }
    }
  }

  // 4. 12-16 保持 OFF（24 小時供電，不納入排程控制）

  // 5. 17-18 保持 OFF（預留且停用）

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

/**
 * 取得當日分鐘數（Asia/Taipei）
 */
function getMinuteOfDay(date: Date): number {
  // 簡化計算：假設已轉換為台北時間
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes()
  return hours * 60 + minutes
}

/**
 * Cron 任務：每分鐘檢測排程狀態變化
 *
 * 這應該由 Vercel Cron 或類似的任務調度器呼叫
 */
export async function checkAndUpdateSchedules() {
  const venues = await prisma.venue.findMany({
    where: { active: true },
    include: { circuits: true, courts: true },
  })

  const currentTime = now()

  for (const venue of venues) {
    // 檢查每個迴路的預期狀態
    for (const circuit of venue.circuits) {
      const states = await calculateCircuitStates(venue.id, currentTime)
      const expectedState = states[circuit.circuitNumber as CircuitNumber]

      // 如果預期狀態與當前狀態不同，更新
      if (circuit.expectedState !== expectedState) {
        await prisma.circuit.update({
          where: { id: circuit.id },
          data: { expectedState },
        })

        // 生成控制命令
        await sendCircuitCommand(venue.id, [circuit.circuitNumber as CircuitNumber], expectedState, 'SCHEDULE')
      }
    }
  }
}
