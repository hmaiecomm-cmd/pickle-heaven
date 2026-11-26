'use client'
import type { ProductRecommendation } from './types'
export function ProductRecommendations({ products }: { products: ProductRecommendation[] }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6">
      <h2 className="text-lg font-bold text-[#1f3d2b] mb-4">空場產品推薦</h2>
      {products.map((p) => (
        <div key={p.id} className="mb-4 p-3 border rounded">
          <p className="font-semibold">{p.name}</p>
          <p className="text-xs text-muted">NT${p.suggestedPrice}</p>
        </div>
      ))}
    </section>
  )
}
