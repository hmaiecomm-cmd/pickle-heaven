'use client'
import { Copy } from 'lucide-react'
import { useState } from 'react'
import type { MemberRecommendation } from './member-operations-types'

export function OperationMemberList({ members, title }: { members: MemberRecommendation[]; title: string }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  if (members.length === 0) {
    return <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center"><p className="text-sm">暫無符合條件的會員</p></div>
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white">
      <div className="border-b border-[#eef1e9] px-6 py-4">
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      <div className="divide-y divide-[#eef1e9]">
        {members.slice(0, 15).map(m => (
          <div key={m.userId} className="p-4 hover:bg-[#f9faf8]">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold">{m.name}</h3>
                <p className="text-sm text-muted mt-1">{m.suggestedAction}</p>
              </div>
              {m.lineMessageTemplate && (
                <button onClick={() => copyToClipboard(m.lineMessageTemplate || '', m.userId)} className="text-xs text-[#0369a1] hover:underline flex items-center gap-1">
                  <Copy className="h-3 w-3" /> 複製
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
