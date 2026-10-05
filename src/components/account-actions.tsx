'use client'

import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLiff } from '@/components/liff-provider'

export function LogoutButton() {
  const { logout } = useLiff()

  return (
    <Button variant="secondary" block onClick={logout} className="text-muted">
      <LogOut className="h-4 w-4" aria-hidden />
      登出
    </Button>
  )
}
