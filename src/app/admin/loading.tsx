export default function AdminLoading() {
  return (
    <div role="status" aria-label="載入中" className="animate-pulse space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-lg bg-[#e3e8dc]" />
        <div className="h-4 w-64 max-w-full rounded bg-[#eef1e9]" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl border border-[#e3e8dc] bg-white" />
        ))}
      </div>
      <div className="h-72 rounded-2xl border border-[#e3e8dc] bg-white" />
      <span className="sr-only">載入中…</span>
    </div>
  )
}
