'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Camera, DoorClosed, Fan, Lightbulb, Plus, Users, Volume2, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, ErrorState, KPICard, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { createCourt, getCourts, getDevices, updateCourt, updateCourtStatus, type CourtInput } from '@/lib/api-service'
import type { Court, Device, DeviceStatus } from '@/lib/models'

/** 場地設定：營業時間與預約規則（children）、球場的新增、編輯與營運狀態。寫入資料庫並留下稽核紀錄。 */

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

const EMPTY: CourtInput = { name: '', capacity: 4, indoor: true, covered: false, surface: null }

export function CourtsClient({ canManage, children }: { canManage: boolean; children: ReactNode }) {
  const [courts, setCourts] = useState<Court[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<{ id: string | null; data: CourtInput } | null>(null)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

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
      offline: courts.filter((c) => [c.lights, c.fans, c.door].some((s) => s !== undefined && s !== 'ONLINE')).length,
    }),
    [courts],
  )

  const [busyId, setBusyId] = useState<string | null>(null)

  /** 寫入資料庫並留下稽核紀錄；非營運中的球場前台會停止開放預約。 */
  const setStatus = async (id: string, status: CourtStatus) => {
    const name = courts.find((c) => c.id === id)?.name ?? '球場'
    setBusyId(id)
    try {
      const res = await updateCourtStatus(id, status)
      if (!res.success) {
        toast(`${name} 狀態變更失敗：${res.error?.message ?? '未知錯誤'}`, 'error')
        return
      }
      setCourts((list) => list.map((c) => (c.id === id ? { ...c, status: res.data.status } : c)))
      toast(`${name} 已設為「${STATUS_META[status].label}」`, 'success')
    } finally {
      setBusyId(null)
    }
  }

  const openEdit = (c: Court) =>
    setForm({ id: c.id, data: { name: c.name, capacity: c.capacity, indoor: c.indoor ?? true, covered: c.covered ?? false, surface: c.surface ?? null, sortOrder: c.sortOrder } })
  const setField = <K extends keyof CourtInput>(k: K, v: CourtInput[K]) => setForm((f) => (f ? { ...f, data: { ...f.data, [k]: v } } : f))
  const saveForm = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = form.id ? await updateCourt(form.id, form.data) : await createCourt(form.data)
      if (!res.success) return toast(`儲存失敗：${res.error?.message ?? '未知錯誤'}`, 'error')
      toast(form.id ? '球場資料已更新' : `已新增「${form.data.name}」，前台立即可預約`, 'success')
      setForm(null)
      await load()
    } finally {
      setSaving(false)
    }
  }
  const panelClass = 'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]'

  return (
    <div className="space-y-6">
      <PageHeader
        title="場地設定"
        subtitle="營業時間、預約規則與球場"
        action={
          canManage ? (
            <Button size="sm" onClick={() => setForm({ id: null, data: EMPTY })}>
              <Plus className="h-4 w-4" aria-hidden />
              新增球場
            </Button>
          ) : undefined
        }
      />

      {children}

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
                    <p className="mt-0.5 text-xs text-muted">
                      {c.indoor === false ? (c.covered ? '室外・有雨棚' : '室外') : '室內'}
                      {c.surface ? `・${c.surface}` : ''}　容納 {c.capacity} 人　{fmtMoney(c.pricePerHour)} 起 / 小時
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap">
                    <StatusBadge status={STATUS_META[c.status].label} variant={STATUS_META[c.status].variant} />
                  </span>
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

                {canManage && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-3">
                  {c.status === 'ACTIVE' ? (
                    <Button size="sm" variant="secondary" loading={busyId === c.id} onClick={() => setStatus(c.id, 'MAINTENANCE')}>
                      <Wrench className="h-4 w-4" aria-hidden />
                      設為維護中
                    </Button>
                  ) : (
                    <Button size="sm" loading={busyId === c.id} onClick={() => setStatus(c.id, 'ACTIVE')}>恢復營運</Button>
                  )}
                  {c.status !== 'INACTIVE' ? (
                    <Button size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => setStatus(c.id, 'INACTIVE')}>停用</Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>編輯</Button>
                </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <Sheet open={form !== null} onOpenChange={(o) => !o && !saving && setForm(null)}>
        {form && (
          <SheetContent title={form.id ? `編輯 ${form.data.name || '球場'}` : '新增球場'} description={form.id ? '修改後前台立即生效' : '新增後前台立即開放預約，時租依「定價與會員折扣」的費率規則'}>
            <div className="space-y-4 text-sm">
              <Field label="名稱" htmlFor="court-name" required>
                <Input id="court-name" value={form.data.name} maxLength={30} onChange={(e) => setField('name', e.target.value)} placeholder="例如：C 場" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="容納人數" htmlFor="court-cap">
                  <Input id="court-cap" type="number" min={1} max={40} value={form.data.capacity} onChange={(e) => setField('capacity', Number(e.target.value))} />
                </Field>
                <Field label="排序" htmlFor="court-sort" hint="數字小的排前面">
                  <Input id="court-sort" type="number" min={0} max={999} value={form.data.sortOrder ?? ''} placeholder="自動" onChange={(e) => setField('sortOrder', e.target.value === '' ? undefined : Number(e.target.value))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="場地類型" htmlFor="court-indoor">
                  <select id="court-indoor" className="h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]" value={form.data.indoor ? 'in' : 'out'} onChange={(e) => setField('indoor', e.target.value === 'in')}>
                    <option value="in">室內</option>
                    <option value="out">室外</option>
                  </select>
                </Field>
                <Field label="地面材質" htmlFor="court-surface">
                  <Input id="court-surface" value={form.data.surface ?? ''} maxLength={30} onChange={(e) => setField('surface', e.target.value || null)} placeholder="例如：PU" />
                </Field>
              </div>
              {!form.data.indoor && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.data.covered} onChange={(e) => setField('covered', e.target.checked)} />
                  有雨棚
                </label>
              )}
              <div className="flex gap-2 border-t border-[rgb(var(--border))] pt-4">
                <Button size="sm" loading={saving} disabled={!form.data.name.trim()} onClick={saveForm}>
                  {form.id ? '儲存' : '新增'}
                </Button>
                <Button size="sm" variant="secondary" disabled={saving} onClick={() => setForm(null)}>取消</Button>
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  )
}

function DeviceCell({ icon: Icon, label, status }: { icon: React.ElementType; label: string; status?: DeviceStatus }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-2.5 py-2">
      <Icon className="h-4 w-4 text-muted" aria-hidden />
      <span className="flex-1">{label}</span>
      <span className="flex items-center gap-1 text-muted">
        <span className={`h-2 w-2 rounded-full ${status ? DEVICE_DOT[status] : 'bg-gray-300 dark:bg-gray-600'}`} aria-hidden />
        {status ? DEVICE_LABEL[status] : '未設定'}
      </span>
    </div>
  )
}
