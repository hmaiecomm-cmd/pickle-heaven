'use client'

import { useEffect } from 'react'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Admin page error', error)
  }, [error])

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
      <p className="text-xs font-semibold tracking-wide text-amber-700">頁面調整中</p>
      <h1 className="mt-2 text-xl font-semibold">這個後台頁面目前發生錯誤</h1>
      <p className="mt-2 text-sm">功能資料暫時無法載入。你可以先重試；若仍然發生，請把這個頁面交給開發者調整。</p>
      <button type="button" onClick={() => reset()} className="mt-4 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">重新載入</button>
    </div>
  )
}
