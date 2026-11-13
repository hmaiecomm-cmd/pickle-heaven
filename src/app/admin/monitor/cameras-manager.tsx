'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, PlugZap, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CAMERA_ZONES, PROTOCOL_LABEL, STREAM_PROTOCOLS, cameraTitle, type StreamProtocol } from '@/lib/camera-layout'
import type { CameraAdminView, CameraStorage } from '@/server/camera-service'
import { useToast } from '@/components/ui/toast'
import { CameraFrame } from '@/components/admin/monitor/camera-frame'
import { CameraPlan } from '@/components/admin/monitor/camera-plan'
import { testCameraAction, updateCameraAction } from './actions'

const VIEW_ROLES = [
  ['MANAGER', '管理員'],
  ['OPERATOR', '營運人員'],
  ['VIEWER', '只讀人員'],
] as const
type ViewRole = (typeof VIEW_ROLES)[number][0]

type Draft = {
  name: string
  zone: string
  x: number
  y: number
  facing: number
  coverage: string
  enabled: boolean
  protocol: StreamProtocol | null
  host: string
  port: string
  channel: string
  credentialEnv: string
  viewRoles: ViewRole[]
}

const toDraft = (c: CameraAdminView): Draft => ({
  name: c.name,
  zone: c.zone,
  x: c.x,
  y: c.y,
  facing: c.facing,
  coverage: c.coverage,
  enabled: c.enabled,
  protocol: c.protocol,
  host: c.host ?? '',
  port: c.port ? String(c.port) : '',
  channel: c.channel ?? '',
  credentialEnv: c.credentialEnv ?? '',
  viewRoles: c.viewRoles.filter((r): r is ViewRole => VIEW_ROLES.some(([k]) => k === r)),
})

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '—')

/** 攝影機管理（需 camera.manage）：名稱、區域、平面圖位置、串流來源、連線測試、觀看權限、啟用 */
export function CamerasManager({ cameras, storage }: { cameras: CameraAdminView[]; storage: CameraStorage }) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedId, setSelectedId] = React.useState<string>(cameras[0]?.id ?? '01')
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>(() => Object.fromEntries(cameras.map((c) => [c.id, toDraft(c)])))
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [tests, setTests] = React.useState<Record<string, { result: string; at: string }>>({})

  const cam = cameras.find((c) => c.id === selectedId)!
  const d = drafts[selectedId]
  const dirty = (id: string) => JSON.stringify(drafts[id]) !== JSON.stringify(toDraft(cameras.find((c) => c.id === id)!))
  const set = (patch: Partial<Draft>) => setDrafts((all) => ({ ...all, [selectedId]: { ...all[selectedId], ...patch } }))
  const locked = storage === 'unavailable'

  const save = async () => {
    setSaving(true)
    const r = await updateCameraAction(selectedId, {
      ...d,
      port: d.port ? Number(d.port) : null,
    })
    setSaving(false)
    if (!r.ok) return toast(r.error, 'error')
    setDrafts((all) => ({ ...all, [selectedId]: toDraft(r.data) }))
    toast(`已儲存 ${cameraTitle(selectedId, r.data.name)}`, 'success')
    router.refresh()
  }

  const test = async () => {
    setTesting(true)
    const r = await testCameraAction(selectedId)
    setTesting(false)
    if (!r.ok) return toast(r.error, 'error')
    setTests((t) => ({ ...t, [selectedId]: { result: r.data.result, at: r.data.testedAt } }))
  }

  const lastTest = tests[selectedId] ?? (cam.lastTestResult ? { result: cam.lastTestResult, at: cam.lastTestAt ?? '' } : null)
  const preview = { ...cam, name: d.name, enabled: d.enabled, state: d.enabled ? ('NOT_CONNECTED' as const) : ('DISABLED' as const) }

  return (
    <div className="space-y-3">
      {locked && (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          此環境的資料庫尚未建立「攝影機設定」資料表，目前顯示預設值，無法儲存修改。
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* 攝影機清單 */}
        <nav aria-label="攝影機清單" className="grid grid-cols-2 gap-2 self-start sm:grid-cols-3 lg:grid-cols-1">
          {cameras.map((c) => {
            const sel = c.id === selectedId
            const dd = drafts[c.id]
            return (
              <button
                key={c.id}
                type="button"
                aria-current={sel ? 'true' : undefined}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-left transition-colors',
                  sel ? 'border-[#2f7d3b] shadow-[0_0_0_3px_rgba(124,179,66,0.2)]' : 'border-zinc-200 hover:border-zinc-300',
                )}
              >
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold', sel ? 'bg-[#2f7d3b] text-white' : 'bg-zinc-100 text-zinc-700')}>{c.id}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{dd.name || '（未命名）'}</span>
                  <span className={cn('block text-[11px]', dd.enabled ? 'text-zinc-500' : 'text-red-600')}>
                    {dd.enabled ? '啟用・未連線' : '已停用'}
                    {dirty(c.id) && <span className="ml-1 font-semibold text-amber-700">未儲存</span>}
                  </span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="min-w-0 space-y-4">
          {/* 基本資料 */}
          <Card title={`${cameraTitle(cam.id, d.name || '（未命名）')}`}>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="攝影機名稱">
                  <input value={d.name} maxLength={30} onChange={(e) => set({ name: e.target.value })} disabled={locked} className={inputCls} />
                </Field>
                <Field label="區域">
                  <select value={d.zone} onChange={(e) => set({ zone: e.target.value })} disabled={locked} className={inputCls}>
                    {CAMERA_ZONES.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="拍攝範圍說明" className="sm:col-span-2">
                  <input value={d.coverage} maxLength={60} onChange={(e) => set({ coverage: e.target.value })} disabled={locked} className={inputCls} />
                </Field>
                <label className="flex items-center gap-3 sm:col-span-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={d.enabled}
                    disabled={locked}
                    onClick={() => set({ enabled: !d.enabled })}
                    className={cn('relative h-7 w-12 rounded-full transition-colors disabled:opacity-50', d.enabled ? 'bg-[#2f7d3b]' : 'bg-zinc-300')}
                  >
                    <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', d.enabled ? 'left-[22px]' : 'left-0.5')} />
                  </button>
                  <span className="text-sm">{d.enabled ? '啟用' : '停用'}（停用後仍顯示在清單，但不會連線）</span>
                </label>
              </div>
              <div className="overflow-hidden rounded-xl">
                <CameraFrame camera={preview} variant="thumb" />
              </div>
            </div>
          </Card>

          {/* 平面圖位置 */}
          <Card title="平面圖位置" desc="選取攝影機後，點平面圖上的位置即可移動；拍攝方向用下方滑桿調整。">
            <CameraPlan
              cameras={cameras.map((c) => ({ id: c.id, name: drafts[c.id].name, x: drafts[c.id].x, y: drafts[c.id].y, facing: drafts[c.id].facing, enabled: drafts[c.id].enabled }))}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onPlace={locked ? undefined : (x, y) => set({ x, y })}
              label="攝影機位置設定平面圖"
            />
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="text-muted">
                座標 x {d.x}・y {d.y}
              </span>
              <label className="flex items-center gap-2">
                <span className="text-muted">拍攝方向</span>
                <input type="range" min={0} max={359} value={d.facing} onChange={(e) => set({ facing: Number(e.target.value) })} disabled={locked} className="w-40 accent-[#2f7d3b]" />
                <span className="w-10 text-right tabular-nums">{d.facing}°</span>
              </label>
            </div>
          </Card>

          {/* 串流來源 */}
          <Card title="串流來源" desc="帳號密碼不存在資料庫，也不會傳到瀏覽器；請由系統管理者把密碼設定在伺服器環境變數，這裡只填變數名稱。">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="類型">
                <select value={d.protocol ?? ''} onChange={(e) => set({ protocol: (e.target.value || null) as StreamProtocol | null })} disabled={locked} className={inputCls}>
                  <option value="">未設定</option>
                  {STREAM_PROTOCOLS.map((p) => (
                    <option key={p} value={p}>
                      {PROTOCOL_LABEL[p]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="主機（IP 或網域）">
                <input value={d.host} placeholder="例如 192.168.1.20" onChange={(e) => set({ host: e.target.value })} disabled={locked} className={inputCls} />
              </Field>
              <Field label="連接埠">
                <input value={d.port} inputMode="numeric" placeholder="例如 554" onChange={(e) => set({ port: e.target.value.replace(/\D/g, '').slice(0, 5) })} disabled={locked} className={inputCls} />
              </Field>
              <Field label="NVR 通道／串流路徑">
                <input value={d.channel} placeholder="例如 101" onChange={(e) => set({ channel: e.target.value })} disabled={locked} className={inputCls} />
              </Field>
              <Field label="憑證環境變數名稱" className="sm:col-span-2">
                <input value={d.credentialEnv} placeholder="例如 CAMERA_03_PASSWORD" onChange={(e) => set({ credentialEnv: e.target.value.toUpperCase() })} disabled={locked} className={cn(inputCls, 'font-mono')} />
              </Field>
              <div className="flex items-end sm:col-span-2">
                <p className="flex items-center gap-1.5 text-xs">
                  <KeyRound className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                  {cam.credentialEnv ? (cam.credentialPresent ? <span className="text-emerald-700">伺服器已設定此憑證（內容不顯示）</span> : <span className="text-amber-700">伺服器尚未設定此環境變數</span>) : <span className="text-muted">尚未指定憑證</span>}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
              <button type="button" onClick={test} disabled={testing || dirty(selectedId)} className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50">
                <PlugZap className="h-4 w-4" aria-hidden />
                {testing ? '測試中…' : '連線測試'}
              </button>
              <p className="min-w-0 flex-1 text-xs text-zinc-600" data-testid="test-result">
                {dirty(selectedId) ? '請先儲存，再測試連線。' : lastTest ? `${fmt(lastTest.at)}：${lastTest.result}` : '尚未測試'}
              </p>
            </div>
          </Card>

          {/* 觀看權限 */}
          <Card title="觀看權限" desc="擁有者一律可看。未勾選的角色看不到這支攝影機的即時影像與回放（伺服器端也會檢查）。">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-500">擁有者（固定）</span>
              {VIEW_ROLES.map(([key, label]) => {
                const on = d.viewRoles.includes(key)
                return (
                  <label key={key} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', on ? 'border-[#2f7d3b] bg-[#f1f8ec]' : 'border-zinc-200')}>
                    <input type="checkbox" checked={on} disabled={locked} onChange={() => set({ viewRoles: on ? d.viewRoles.filter((r) => r !== key) : [...d.viewRoles, key] })} className="accent-[#2f7d3b]" />
                    {label}
                  </label>
                )
              })}
            </div>
          </Card>

          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-2px_10px_rgba(16,24,16,0.06)] backdrop-blur">
            <p className="mr-auto text-[11px] text-muted">最後修改：{cam.updatedBy ? `${cam.updatedBy.replace(/^admin:/, '')}・${fmt(cam.updatedAt)}` : '尚未修改（使用預設值）'}</p>
            <button type="button" onClick={() => setDrafts((all) => ({ ...all, [selectedId]: toDraft(cam) }))} disabled={!dirty(selectedId) || saving} className="h-10 rounded-lg border border-zinc-200 px-4 text-sm disabled:opacity-40">
              還原
            </button>
            <button type="button" onClick={save} disabled={locked || !dirty(selectedId) || saving} className="flex h-10 items-center gap-1.5 rounded-lg bg-[#2f7d3b] px-4 text-sm font-semibold text-white hover:bg-[#276a32] disabled:opacity-40">
              <Save className="h-4 w-4" aria-hidden />
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm disabled:bg-zinc-50 disabled:text-zinc-400'

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-[11px] text-muted">{desc}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block text-xs', className)}>
      <span className="mb-1 block font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}
