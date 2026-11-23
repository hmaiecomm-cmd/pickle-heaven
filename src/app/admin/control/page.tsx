import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { circuitCommandBlocker, isProtectedCircuit } from '@/lib/circuit-guard'
import { CIRCUIT_DEFINITIONS } from '@/lib/control-types'
import { CATEGORY_INFO, CIRCUIT_NUMBERS, circuitLocation } from '@/lib/venue-layout'
import { getMonitorSnapshot, recentCommands, ACTIONS_BY_TYPE } from '@/server/monitor-service'
import { recentCircuitCommands } from '@/server/circuit-control'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { IotStatusBanner } from '@/components/admin/iot-status-banner'
import { ControlClient } from './control-client'
import { CircuitPanel, type CircuitRow } from './circuit-panel'

export const metadata: Metadata = { title: '控制中心' }
export const dynamic = 'force-dynamic'

const TARGET_LABEL: Record<string, string> = { ON: '開啟', OFF: '關閉' }
const SOURCE_LABEL: Record<string, string> = { MANUAL_OVERRIDE: '手動', SCHEDULE: '排程', EMERGENCY: '緊急' }

export default async function ControlPage() {
  const ctx = await pagePermission('device')
  if (ctx === 'forbidden') return <Forbidden />
  const [snap, cmds, circuitCmds, dbCircuits] = await Promise.all([
    getMonitorSnapshot(),
    recentCommands(15),
    recentCircuitCommands(15),
    prisma.circuit.findMany({ select: { circuitNumber: true, category: true, enabled: true, remoteControlEnabled: true, scheduleControlEnabled: true, actualState: true, expectedState: true, overrideMode: true, overrideUntil: true } }),
  ])
  if (!snap) return <p className="text-sm text-muted">尚未建立場館。</p>

  const byNumber = new Map(dbCircuits.map((c) => [c.circuitNumber, c]))
  const circuits: CircuitRow[] = [...CIRCUIT_NUMBERS].sort().map((n) => {
    const def = CIRCUIT_DEFINITIONS[n]
    const info = CATEGORY_INFO[def.category]
    const db = byNumber.get(n)
    const guarded = db ?? { circuitNumber: n, category: def.category, enabled: def.defaultEnabled, remoteControlEnabled: def.remoteControlEnabled, scheduleControlEnabled: def.scheduleControlEnabled }
    const locked = isProtectedCircuit(guarded)
      ? def.category === 'RESERVED'
        ? '預留未使用'
        : '24 小時供電・不可由系統開關'
      : circuitCommandBlocker(guarded, 'MANUAL_OVERRIDE')
    const onOff = (v: string | null | undefined) => (v === 'ON' || v === 'OFF' ? v : null)
    return {
      number: n,
      name: def.name,
      categoryLabel: info.label,
      range: info.range,
      location: circuitLocation(n),
      state: onOff(db?.actualState),
      expected: onOff(db?.expectedState),
      override: db?.overrideMode ? { mode: db.overrideMode, until: db.overrideUntil?.toISOString() ?? null } : null,
      locked,
    }
  })

  const commands = [
    ...cmds.map((c) => ({ id: c.id, label: `${c.device.court.name} ${c.device.name} ${c.action}`, status: c.status, simulated: c.simulated, error: c.error, at: c.createdAt.toISOString(), by: c.requestedBy })),
    ...circuitCmds.map((c) => ({
      id: c.id,
      label: `迴路 ${c.circuit.circuitNumber} ${c.circuit.name} ${TARGET_LABEL[c.targetState] ?? c.targetState}（${SOURCE_LABEL[c.source] ?? c.source}）`,
      status: c.status,
      simulated: c.simulated,
      error: c.error,
      at: c.createdAt.toISOString(),
      by: c.requestedBy ?? '系統',
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20)

  return (
    <div>
      <PageTitle
        title="控制中心"
        desc="燈光、風扇與電力迴路的指令都要先看操作預覽，由有權限的人員確認。送出不等於完成：收到設備回報才顯示「設備已確認」。"
      />
      {/* 已設定 IoT Gateway 時顯示目前連線對象（實體 IoT PC／網頁模擬器）；否則維持 Demo Mode 說明 */}
      <div className="mb-4">
        <IotStatusBanner what="電力迴路、燈控與設備硬體" />
      </div>
      <ControlClient
        integration={snap.integration}
        canControl={can(ctx.role, 'device.control')}
        courts={snap.courts.map((c) => ({
          id: c.id,
          name: c.name,
          usage: c.usage?.label ?? null,
          devices: c.devices
            .filter((d) => ACTIONS_BY_TYPE[d.type])
            .map((d) => ({ id: d.id, name: d.name, typeLabel: d.typeLabel, state: d.state, lastAction: d.lastAction, actions: ACTIONS_BY_TYPE[d.type] })),
        }))}
        commands={commands}
      >
        <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          門禁的授權與開關由「門禁權限管理」負責，控制中心不提供開門、上鎖。
          <Link href="/admin/access" className="ml-1 font-semibold text-brand-700 hover:underline">前往門禁權限管理 →</Link>
        </p>
        <CircuitPanel circuits={circuits} canControl={can(ctx.role, 'device.control')} connected={snap.integration.mode !== 'NOT_CONNECTED'} hasData={dbCircuits.length > 0} />
      </ControlClient>
    </div>
  )
}
