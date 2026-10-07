import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { getMonitorSnapshot, recentCommands, ACTIONS_BY_TYPE } from '@/server/monitor-service'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { ControlClient } from './control-client'

export const metadata: Metadata = { title: '無人化控制' }
export const dynamic = 'force-dynamic'

export default async function ControlPage() {
  const ctx = await pagePermission('monitor')
  if (ctx === 'forbidden') return <Forbidden />
  const [snap, cmds] = await Promise.all([getMonitorSnapshot(), recentCommands(15)])
  if (!snap) return <p className="text-sm text-muted">尚未建立場館。</p>
  return (
    <div>
      <PageTitle
        title="無人化控制"
        desc="開門、燈光等指令都要先看操作預覽，由有權限的人員確認。送出不等於完成：收到設備回報才顯示「設備已確認」。"
      />
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
        commands={cmds.map((c) => ({
          id: c.id,
          label: `${c.device.court.name} ${c.device.name} ${c.action}`,
          status: c.status,
          simulated: c.simulated,
          error: c.error,
          at: c.createdAt.toISOString(),
          by: c.requestedBy,
        }))}
      />
    </div>
  )
}
