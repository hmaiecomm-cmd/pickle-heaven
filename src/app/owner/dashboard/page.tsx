'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout'
import { KPICard } from '@/components/common'
import { LoadingState } from '@/components/common/StatusBadge'
import { getFinancialSummary, getReservations } from '@/lib/api-service'
import type { FinancialSummary, Reservation } from '@/lib/models'
import { DollarSign, Calendar, TrendingUp, Users } from 'lucide-react'

export default function DashboardPage() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [summaryRes, reservationsRes] = await Promise.all([
          getFinancialSummary(period),
          getReservations(),
        ])
        if (summaryRes.success) setSummary(summaryRes.data)
        if (reservationsRes.success) setReservations(reservationsRes.data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [period])

  if (loading) return <LoadingState />

  const displaySummary = summary || {
    period: { from: new Date(), to: new Date() },
    grossRevenue: 0,
    expenses: 0,
    netRevenue: 0,
    operatingProfit: 0,
    profitMargin: 0,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pickleball Paradise 控制中心"
        action={
          <div className="flex gap-2">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === p ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {p === 'today' ? '今天' : p === 'week' ? '本週' : '本月'}
              </button>
            ))}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KPICard
          icon={<DollarSign className="h-5 w-5" />}
          label="營收"
          value={String(displaySummary.grossRevenue.toLocaleString())}
          unit="元"
          trend={{ value: 12, direction: 'up' }}
        />
        <KPICard
          icon={<Calendar className="h-5 w-5" />}
          label="預約數"
          value={String(reservations.length)}
          trend={{ value: 8, direction: 'up' }}
        />
        <KPICard
          icon={<Users className="h-5 w-5" />}
          label="球場使用率"
          value="72"
          unit="%"
          trend={{ value: -5, direction: 'down' }}
        />
        <KPICard
          icon={<DollarSign className="h-5 w-5" />}
          label="費用"
          value={String(displaySummary.expenses.toLocaleString())}
          unit="元"
        />
        <KPICard
          icon={<TrendingUp className="h-5 w-5" />}
          label="淨利"
          value={String(displaySummary.netRevenue.toLocaleString())}
          unit="元"
          trend={{ value: 5, direction: 'up' }}
        />
        <KPICard
          label="利潤率"
          value={String(displaySummary.profitMargin.toFixed(1))}
          unit="%"
          trend={{ value: 2, direction: 'up' }}
        />
      </div>

      {/* Recent Reservations */}
      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-6">
        <h2 className="mb-4 text-lg font-semibold">最近預約</h2>
        {reservations.length === 0 ? (
          <p className="text-center py-8 text-muted">沒有預約</p>
        ) : (
          <div className="space-y-2">
            {reservations.slice(0, 5).map((res) => (
              <div key={res.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 text-sm">
                <div>
                  <p className="font-medium">{res.bookingCode}</p>
                  <p className="text-xs text-muted">{res.member?.name}</p>
                </div>
                <span className="text-right text-sm font-mono">NT${res.totalAmount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
