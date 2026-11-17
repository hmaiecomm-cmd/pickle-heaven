'use client'

export function AutomationRules() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">自動化規則</h2>
      <ul className="mt-3 space-y-2 text-sm text-zinc-700">
        <li className="flex items-start gap-2">
          <span className="text-emerald-600 font-semibold">✓</span>
          <span>預約密碼開門</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-600 font-semibold">✓</span>
          <span>預約日前一天 LINE 通知</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-600 font-semibold">✓</span>
          <span>預約前兩小時 LINE 通知</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-600 font-semibold">✓</span>
          <span>取消預約後密碼失效</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-600 font-semibold">✓</span>
          <span>退款完成後密碼失效</span>
        </li>
      </ul>
    </section>
  )
}
