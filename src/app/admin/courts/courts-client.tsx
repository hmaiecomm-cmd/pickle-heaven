'use client'

import { useEffect, useMemo, useState } from 'react'
import { Camera, DoorClosed, Fan, Lightbulb, Plus, Users, Volume2, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, ErrorState, KPICard, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { getCourts, getDevices } from '@/lib/api-service'
import type { Court, Device, DeviceStatus } from '@/lib/models'

/** 球場（Phase 1I）。資料來自 mock api-service；狀態切換僅更新本機狀態。 */

type CourtStatus = Court['status']
const STATUS_META: Record<CourtStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  ACTIVE: { label: '營運中', variant: 'success' },
  MAINTENANCE: { label: '維護中', variant: 'warning' },
  INACTIVE: { label: '停用', variant: 'default' },
}
const DEVICE_LABEL: Record<DeviceStatus, string> = { ONLINE: '正常', OFFLINE: '離線', WARNING: '警告' }
const DEVICE_DOT: Record<DeviceStatus, string> = { ONLINE: 'bg-green-500', OFFLINE: 'bg-gray-400', WARNING: 'bg-amber-500' }
const TYPE_ICON: Record<Device['type'], React.ElementType> = { DOOR: DoorClosed, LIGHTS: Lightbulb, FANS: Fan, CAMERA: Camera, SPEAKER: Volume2 }

const fmtMoney = (n: number) => `NT$${n.toLocaleString()}`

export function CourtsClient() {
  const [courts, setCourts] = useState<Court[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, d] = await Promise.all([getCourts(), getDevices()])
      if (!c.success) throw new Error(c.error?.message ?? '無法載入球場')
      setCourts(c.data)
      setDevices(d.success ? d.data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const kpi = useMemo(
    () => ({
      total: courts.length,
      active: courts.filter((c) => c.status === 'ACTIVE').length,
      capacity: courts.filter((c) => c.status === 'ACTIVE').reduce((s, c) => s + c.capacity, 0),
      offline: courts.filter((c) => [c.lights, c.fans, c.door].some((s) => s !== 'ONLINE')).length,
    }),
    [courts],
  )

  /** Phase 1 僅更新本機狀態；Phase 2 改呼叫 API。 */
  const setStatus = (id: string, status: CourtStatus) => setCourts((list) => list.map((c) => (c.id === id ? { ...c, status } : c)))

  const editing = courts.find((c) => c.id === editingId) ?? null
  const panelClass = 'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]'

  return (
    <div className="space-y-6">
      <PageHeader
        title="球場"
        subtitle="球場狀態、容量、時租與設備"
        action={
          <Button size="sm" disabled title="Phase 2 實作">
            <Plus className="h-4 w-4" aria-hidden />
            新增球場
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<Users className="h-5 w-5" />} label="球場數" value={kpi.total} unit="面" />
        <KPICard icon={<Users className="h-5 w-5" />} label="營運中" value={kpi.active} unit="面" />
        <KPICard icon={<Users className="h-5 w-5" />} label="可容納" value={kpi.capacity} unit="人" />
        <KPICard icon={<Wrench className="h-5 w-5" />} label="設備異常" value={kpi.offline} unit="面" />
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState description={error} retry={load} />
      ) : courts.length === 0 ? (
        <div className={panelClass}>
          <EmptyState title="尚未建立球場" icon="🏟️" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courts.map((c) => {
            const courtDevices = devices.filter((d) => d.courtId === c.id)
            return (
              <section key={c.id} className={`p-4 ${panelClass} ${c.status === 'MAINTENANCE' ? 'border-amber-300 dark:border-amber-700' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{c.name}</h2>
                    <p className="mt-0.5 text-xs text-muted">容納 {c.capacity} 人　{fmtMoney(c.pricePerHour)} / 小時</p>
                  </div>
                  <StatusBadge status={STATUS_META[c.status].label} variant={STATUS_META[c.status].variant} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <DeviceCell icon={Lightbulb} label="照明" status={c.lights} />
                  <DeviceCell icon={Fan} label="風扇" status={c.fans} />
                  <DeviceCell icon={DoorClosed} label="門禁" status={c.door} />
                </div>

                {courtDevices.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs">
                    {courtDevices.map((d) => {
                      const Icon = TYPE_ICON[d.type]
                      return (
                        <li key={d.id} className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted">
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                            {d.name}
                            {d.lastAction && <span className="font-mono">{d.lastAction}</span>}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${DEVICE_DOT[d.status]}`} aria-hidden />
                            {DEVICE_LABEL[d.status]}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-3">
                  {c.status === 'ACTIVE' ? (
                    <Button size="sm" variant="secondary" onClick={() => setStatus(c.id, 'MAINTENANCE')}>
                      <Wrench className="h-4 w-4" aria-hidden />
                      設為維護中
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setStatus(c.id, 'ACTIVE')}>恢復營運</Button>
                  )}
                  {c.status !== 'INACTIVE' ? (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, 'INACTIVE')}>停用</Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(c.id)}>編輯</Button>
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* 編輯（佔位：欄位唯讀） */}
      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditingId(null)}>
        {editing && (
          <SheetContent title={`編輯 ${editing.name}`} description="Phase 2 實作儲存；目前欄位唯讀">
            <div className="space-y-4 text-sm">
              <Field label="名稱" htmlFor="court-name">
                <Input id="court-name" value={editing.name} readOnly />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="容納人數" htmlFor="court-cap">
                  <Input id="court-cap" value={editing.capacity} readOnly />
                </Field>
                <Field label="時租（NT$）" htmlFor="court-price">
                  <Input id="court-price" value={editing.pricePerHour} readOnly />
                </Field>
              </div>
              <div className="flex gap-2 border-t border-[rgb(var(--border))] pt-4">
                <Button size="sm" disabled title="Phase 2 實作">儲存</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>關閉</Button>
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  )
}

function DeviceCell({ icon: Icon, label, status }: { icon: React.ElementType; label: string; status: DeviceStatus }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-2.5 py-2">
      <Icon className="h-4 w-4 text-muted" aria-hidden />
      <span className="flex-1">{label}</span>
      <span className="flex items-center gap-1 text-muted">
        <span className={`h-2 w-2 rounded-full ${DEVICE_DOT[status]}`} aria-hidden />
        {DEVICE_LABEL[status]}
      </span>
    </div>
  )
}
