import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { deviceIntegration, DEVICE_TYPE_LABEL } from '@/server/monitor-service'
import { Forbidden, PageTitle, Pill } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: '設備串接' }
export const dynamic = 'force-dynamic'

export default async function DeviceSettingsPage() {
  if ((await pagePermission('settings')) === 'forbidden') return <Forbidden />
  const integ = await deviceIntegration()
  const devices = await prisma.device.findMany({ include: { court: { select: { name: true, sortOrder: true } } }, orderBy: [{ courtId: 'asc' }, { type: 'asc' }] })
  return (
    <div className="space-y-4">
      <PageTitle title="設備串接" />
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          設備閘道 <Pill tone={integ.mode === 'SIMULATED' ? 'violet' : 'gray'}>{integ.label}</Pill>
        </p>
        <p className="mt-1 text-muted">{integ.reason}</p>
        <p className="mt-3 font-semibold">串接需要</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
          <li>門禁、燈控廠商提供的 API（狀態查詢、下指令、指令結果回報）</li>
          <li>設備心跳或狀態推送，系統才能判斷離線與資料過期</li>
          <li>感測器（人流或占用偵測）才能區分「現場偵測」與「依預約推估」</li>
          <li>不新增人臉身分辨識；影像只提供授權範圍內的事件檢視</li>
        </ul>
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">設備紀錄（{devices.length}）</h2>
        <p className="mt-1 text-xs text-muted">{integ.mode === 'SIMULATED' ? '展示環境的模擬設備。' : '以下只是預先建立的設備清單，尚未連線，狀態一律視為「尚未串接」。'}</p>
        <ul className="mt-2 divide-y divide-zinc-100 text-sm">
          {devices.map((d) => (
            <li key={d.id} className="flex justify-between py-1.5">
              <span>{d.court.name}・{DEVICE_TYPE_LABEL[d.type] ?? d.type}・{d.name}</span>
              <span className="text-xs text-muted">{integ.mode === 'SIMULATED' ? `${d.status}（模擬）` : '尚未串接'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
