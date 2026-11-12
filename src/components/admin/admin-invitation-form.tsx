'use client'

import { useState } from 'react'
import { Mail, Plus, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

export interface AdminInvitationFormProps {
  onSubmit?: (data: { email: string; role: string }) => Promise<boolean>
}

const ROLES = [
  { id: 'OWNER', label: '擁有者', color: 'red' },
  { id: 'MANAGER', label: '經理', color: 'blue' },
  { id: 'STAFF', label: '現場人員', color: 'green' },
  { id: 'FINANCE', label: '財務', color: 'orange' },
  { id: 'MAINTENANCE', label: '設備維護', color: 'purple' },
]

export function AdminInvitationForm({ onSubmit }: AdminInvitationFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('STAFF')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setStatus('idle')

    try {
      if (onSubmit) {
        const success = await onSubmit({ email, role })
        if (success) {
          setStatus('success')
          setMessage('邀請已發送')
          setEmail('')
          setRole('STAFF')
          setTimeout(() => setStatus('idle'), 3000)
        } else {
          setStatus('error')
          setMessage('發送邀請失敗，請重試')
        }
      } else {
        // Mock 模式
        console.log('Would send invitation:', { email, role })
        setStatus('success')
        setMessage('邀請已發送')
        setEmail('')
        setRole('STAFF')
        setTimeout(() => setStatus('idle'), 3000)
      }
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '發送失敗')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-zinc-900 mb-2">
          Email 地址
        </label>
        <input
          id="email"
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-semibold text-zinc-900 mb-2">
          角色
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {status !== 'idle' && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
            status === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {status === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !email}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            發送中...
          </>
        ) : (
          <>
            <Mail className="w-4 h-4" />
            發送邀請
          </>
        )}
      </button>
    </form>
  )
}
