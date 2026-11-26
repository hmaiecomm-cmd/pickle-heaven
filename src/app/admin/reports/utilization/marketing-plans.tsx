'use client'
import type { MarketingPlan } from './types'
export function MarketingPlans({ plans }: { plans: MarketingPlan[] }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6">
      <h2 className="text-lg font-bold text-[#1f3d2b] mb-4">收益行銷方案</h2>
      {plans.map((p) => (
        <div key={p.id} className="mb-4 p-3 border rounded">
          <p className="font-semibold">{p.name}</p>
          <p className="text-xs text-green-600">NT${p.netRevenue}</p>
        </div>
      ))}
    </section>
  )
}
