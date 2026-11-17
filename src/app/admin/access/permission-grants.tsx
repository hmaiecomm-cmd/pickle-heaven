'use client'

export function PermissionGrants() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">權限授權</h2>
      <p className="mt-2 text-xs text-muted">管理門禁管理員和相關人員的操作權限。</p>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg bg-zinc-50 p-3 text-sm">
          <p className="font-medium text-zinc-900">尚無已授權人員</p>
          <p className="mt-1 text-xs text-muted">目前沒有額外授權人員。系統管理員預設擁有所有門禁權限。</p>
        </div>
      </div>

      <div className="mt-3 text-xs text-muted space-y-1">
        <p><strong>可授權的權限：</strong></p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>門禁授權 - 建立和撤銷門禁授權</li>
          <li>遠端開門 - 一鍵強制開門</li>
          <li>門禁設備管理 - 編輯密碼設定和常開模式</li>
        </ul>
      </div>
    </section>
  )
}
