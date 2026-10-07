'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'

export function LogoutButton() {
  const { logout } = useAuth()
  const router = useRouter()

  return (
    <Button
      variant="secondary"
      block
      onClick={async () => {
        await logout()
        router.push('/')
      }}
      className="text-muted"
    >
      <LogOut className="h-4 w-4" aria-hidden />
      登出
    </Button>
  )
}
