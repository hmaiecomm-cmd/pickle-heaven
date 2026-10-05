'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Check, Plus, UserX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Field, Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import {
  adminAddPlayer,
  adminCancelSession,
  adminDeleteSession,
  adminDemote,
  adminLockSession,
  adminMarkAttendance,
  adminPromote,
  adminRemove,
  adminUpdateSession,
  type AdminResult,
} from '@/server/session-admin-actions'

/**
 * 主辦者的名單管理介面（規格 §14）。
 *
 * 所有動作都呼叫 server action，伺服器端會再做一次 requireAdmin 與規則檢查，
 * 因此這裡只負責呈現與回饋，不自行判斷權限。
 */

export type RosterRow = {
  registrationId: string
  name: string
  status: 'CONFIRMED' | 'WAITLISTED' | 'COMPLETED' | 'NO_SHOW'
  waitlistPosition: number | null
  addedByOrganizer: boolean
}

export type SessionSettings = {
  title: string
  capacity: number
  reservedCapacity: number
  price: number
  waitlistEnabled: boolean
  autoPromote: boolean
  allowPostLockReplacement: boolean
}

export function RosterClient({
  sessionId,
  confirmed,
  waitlist,
  settings,
  canLock,
  canCancel,
  isPast,
}: {
  sessionId: string
  confirmed: RosterRow[]
  waitlist: RosterRow[]
  settings: SessionSettings
  canLock: boolean
  canCancel: boolean
  isPast: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = React.useTransition()
  const [newName, setNewName] = React.useState('')
  const [form, setForm] = React.useState(settings)

  const run = (action: () => Promise<AdminResult>, onDone?: () => void) => {
    startTransition(async () => {
      const result = await action()
      toast(result.message, result.ok ? 'success' : 'error')
      if (result.ok) {
        onDone?.()
        router.refresh()
      }
    })
  }

  const renderRow = (row: RosterRow, index: number) => (
    <li key={row.registrationId} className="flex items-center gap-2 px-3 py-2">
      <span className="w-5 shrink-0 text-xs text-muted tabular-nums">
        {row.status === 'WAITLISTED' ? `#${row.waitlistPosition ?? index + 1}` : index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>

      {row.addedByOrganizer ? <Badge variant="outline">主辦加入</Badge> : null}
      {row.status === 'COMPLETED' ? <Badge variant="success">出席</Badge> : null}
      {row.status === 'NO_SHOW' ? <Badge variant="danger">未到</Badge> : null}

      <div className="flex shrink-0 items-center gap-1">
        {isPast && (row.status === 'CONFIRMED' || row.status === 'COMPLETED' || row.status === 'NO_SHOW') ? (
          <>
            <IconButton
              label="標記出席"
              disabled={pending}
              onClick={() => run(() => adminMarkAttendance(row.registrationId, true))}
            >
              <Check className="h-4 w-4" aria-hidden />
            </IconButton>
            <IconButton
              label="標記未到"
              disabled={pending}
              onClick={() => run(() => adminMarkAttendance(row.registrationId, false))}
            >
              <UserX className="h-4 w-4" aria-hidden />
            </IconButton>
          </>
        ) : null}

        {row.status === 'WAITLISTED' ? (
          <IconButton
            label="升為正取"
            disabled={pending}
            onClick={() => run(() => adminPromote(row.registrationId))}
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </IconButton>
        ) : null}

        {row.status === 'CONFIRMED' ? (
          <IconButton
            label="移到候補"
            disabled={pending}
            onClick={() => run(() => adminDemote(row.registrationId))}
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
          </IconButton>
        ) : null}

        <IconButton
          label="移出名單"
          disabled={pending}
          onClick={() => run(() => adminRemove(row.registrationId))}
        >
          <X className="h-4 w-4" aria-hidden />
        </IconButton>
      </div>
    </li>
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">
            正取名單
            <span className="ml-2 text-xs font-normal text-muted tabular-nums">
              {confirmed.length} 人
            </span>
          </h2>

          {confirmed.length > 0 ? (
            <ul className="divide-y divide-[rgb(var(--border))] rounded-xl surface-2">
              {confirmed.map(renderRow)}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted">還沒有人報名</p>
          )}

          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              run(
                () => adminAddPlayer(sessionId, newName),
                () => setNewName(''),
              )
            }}
          >
            <div className="flex-1">
              <Field label="手動加入球友" htmlFor="admin-add-player">
                <Input
                  id="admin-add-player"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="輸入姓名，可動用保留名額"
                />
              </Field>
            </div>
            <Button type="submit" loading={pending} disabled={!newName.trim()}>
              <Plus className="h-4 w-4" aria-hidden />
              加入
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">
            候補名單
            <span className="ml-2 text-xs font-normal text-muted tabular-nums">
              {waitlist.length} 人
            </span>
          </h2>
          {waitlist.length > 0 ? (
            <ul className="divide-y divide-[rgb(var(--border))] rounded-xl surface-2">
              {waitlist.map(renderRow)}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted">目前沒有候補</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-sm font-semibold">場次設定</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="名稱" htmlFor="s-title">
                <Input
                  id="s-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </Field>
            </div>
            <Field label="總容量" htmlFor="s-capacity">
              <Input
                id="s-capacity"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              />
            </Field>
            <Field label="保留名額" htmlFor="s-reserved">
              <Input
                id="s-reserved"
                type="number"
                min={0}
                value={form.reservedCapacity}
                onChange={(e) => setForm({ ...form, reservedCapacity: Number(e.target.value) })}
              />
            </Field>
            <div className="col-span-2">
              <Field label="價格" htmlFor="s-price">
                <Input
                  id="s-price"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-2">
            <Toggle
              label="開放候補"
              checked={form.waitlistEnabled}
              onChange={(v) => setForm({ ...form, waitlistEnabled: v })}
            />
            <Toggle
              label="自動遞補"
              checked={form.autoPromote}
              onChange={(v) => setForm({ ...form, autoPromote: v })}
            />
            <Toggle
              label="鎖定後仍可遞補"
              hint="有人逾時取消時，是否仍自動補人"
              checked={form.allowPostLockReplacement}
              onChange={(v) => setForm({ ...form, allowPostLockReplacement: v })}
            />
          </div>

          <Button block loading={pending} onClick={() => run(() => adminUpdateSession(sessionId, form))}>
            儲存設定
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">場次操作</h2>
          <Button
            variant="secondary"
            block
            disabled={!canLock || pending}
            onClick={() => run(() => adminLockSession(sessionId))}
          >
            立即鎖定並產生最終名單
          </Button>
          <Button
            variant="danger"
            block
            disabled={!canCancel || pending}
            onClick={() => {
              const reason = window.prompt('取消原因（可留空）') ?? ''
              run(() => adminCancelSession(sessionId, reason))
            }}
          >
            取消這場球敘
          </Button>
          <Button
            variant="ghost"
            block
            disabled={pending}
            onClick={() => {
              const players = confirmed.length + waitlist.length
              const warning =
                players > 0 ? `已有 ${players} 人報名，刪除後名單一併移除。
` : ''
              if (!window.confirm(`${warning}確定要刪除這場球敘嗎？此動作無法復原。`)) return
              startTransition(async () => {
                const result = await adminDeleteSession(sessionId)
                toast(result.message, result.ok ? 'success' : 'error')
                if (result.ok) router.push('/admin/sessions')
              })
            }}
          >
            刪除這場球敘
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:surface hover:text-[rgb(var(--fg))] disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-[rgb(var(--border))] accent-brand-600"
      />
      <span className="text-sm">
        {label}
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  )
}
