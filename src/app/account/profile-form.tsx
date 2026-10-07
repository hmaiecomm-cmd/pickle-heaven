'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { updateProfile } from '@/server/account-actions'

export function ProfileForm({ displayName, phone }: { displayName: string; phone: string | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = React.useState(displayName)
  const [tel, setTel] = React.useState(phone ?? '')
  const [saving, setSaving] = React.useState(false)
  const dirty = name !== displayName || tel !== (phone ?? '')

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
          const res = await updateProfile({ displayName: name, phone: tel })
          if (!res.ok) return toast(res.error, 'error')
          toast('已更新個人資料', 'success')
          router.refresh()
        } finally {
          setSaving(false)
        }
      }}
    >
      <Field label="顯示名稱" htmlFor="pf-name" hint="預約與活動名單上顯示的名字">
        <Input id="pf-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      <Field label="手機號碼" htmlFor="pf-phone" hint="場館聯絡與到場報到使用，例：0912345678">
        <Input id="pf-phone" value={tel} inputMode="tel" maxLength={20} onChange={(e) => setTel(e.target.value)} autoComplete="tel" />
      </Field>
      <Button type="submit" size="sm" disabled={!dirty} loading={saving}>
        儲存
      </Button>
    </form>
  )
}
