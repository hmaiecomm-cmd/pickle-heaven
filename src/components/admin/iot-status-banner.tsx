import Link from 'next/link'
import { Cpu, FlaskConical } from 'lucide-react'
import { getAdminContext } from '@/lib/admin-auth'
import { DemoModeBanner } from '@/components/admin/page-bits'
import { GatewayError, gateway, iotGatewayConfig } from '@/server/iot/gateway-client'
import { engineerVenues } from '@/server/iot/engineer'
import { siteIdFor } from '@/server/iot/site-id'

/**
 * 設備總覽、手動控制、即時監控頁上方：目前連的是「實體 IoT PC」還是「網頁模擬器」，以及它的連線與硬體狀態。
 * 尚未設定 IoT Gateway 時維持原本的 Demo Mode 說明。
 */
export async function IotStatusBanner({ what }: { what: string }) {
  const ctx = await getAdminContext()
  if (!ctx || !iotGatewayConfig()) return <DemoModeBanner what={what} />
  const v = (await engineerVenues(ctx).catch(() => []))[0]
  if (!v) return <DemoModeBanner what={what} />
  const siteId = siteIdFor(v.siteCode, v.target)
  const site = await gateway.site(siteId).catch((e) => (e instanceof GatewayError ? null : null))
  const sim = v.target === 'SIMULATOR'
  const hw = site?.status?.hardware
  const hwBad = hw && (hw.modbus !== 'OK' || hw.doorController !== 'OK')
  const tpe = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '—')

  return (
    <div role="status" className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-2.5 text-sm ${sim ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>
      <span className="flex items-center gap-1.5 font-semibold">
        {sim ? <FlaskConical className="h-4 w-4" aria-hidden /> : <Cpu className="h-4 w-4" aria-hidden />}
        {sim ? 'IoT 模擬器模式' : '實體 IoT PC'}
        <span className="font-mono text-xs font-normal opacity-70">{siteId}</span>
      </span>
      <span>
        <span className={`mr-1 inline-block h-2 w-2 rounded-full ${site?.online ? 'bg-green-500' : 'bg-red-500'}`} />
        {site ? (site.online ? '在線' : '離線') : 'Gateway 尚無此場館'}
        <span className="ml-1 text-xs opacity-70">最後連線 {tpe(site?.lastSeenAt)}</span>
      </span>
      {site && (
        <span className="text-xs">
          計畫 rev {site.planRev}
          {site.status && site.status.planRev !== site.planRev ? <b className="ml-1 text-amber-700">（場館仍在 rev {site.status.planRev ?? '—'}）</b> : '・已同步'}
        </span>
      )}
      {hwBad && <span className="text-xs font-semibold text-red-700">硬體異常：M-7045 {hw.modbus}・門禁 {hw.doorController}</span>}
      <span className="text-xs opacity-80">{sim ? `以下${what}的狀態與操作都來自網頁模擬器。` : `以下${what}的狀態為場館電腦實際回報。`}</span>
      <Link href="/admin/engineer_testmode" className="ml-auto text-xs underline">
        地端 IoT 工程測試
      </Link>
    </div>
  )
}
