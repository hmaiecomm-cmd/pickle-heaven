import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="mt-4 text-lg font-semibold">找不到這個頁面</h1>
      <p className="mt-1.5 text-sm text-muted">頁面可能已被移除，或連結不正確。</p>
      <Button asChild className="mt-6">
        <Link href="/booking">回到場地預約</Link>
      </Button>
    </div>
  )
}
