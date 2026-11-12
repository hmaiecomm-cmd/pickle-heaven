/**
 * 小P 操作指南知識庫驗收（純邏輯 + 開發資料庫的場館設定）。
 *
 *   npx tsx -r ./scripts/stub-server-only.cjs --env-file=.env scripts/test-ai-guide.ts
 */
import { GUIDES, guideList, matchGuide, renderGuide } from '../src/server/ai-guide'

const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  check('知識庫含 12 題', GUIDES.length === 12 && guideList().length === 12)
  check('每題原句都能命中自己', GUIDES.every((g) => matchGuide(g.question)?.id === g.id), GUIDES.filter((g) => matchGuide(g.question)?.id !== g.id).map((g) => g.id).join(','))
  const variants: [string, string][] = [
    ['我要開一場新的球敘', 'new_session'],
    ['為什麼星期三晚上不能預約', 'slot_blocked'],
    ['怎麼設定每週重複的活動', 'weekly'],
    ['客人想改期怎麼辦', 'modify_booking'],
    ['有客人投訴要怎麼處理', 'complaint'],
    ['燈有沒有關', 'devices'],
    ['客人要怎麼買點數', 'topup_how'],
    ['客人付款了點數沒有增加', 'topup_missing'],
    ['報帳收據要怎麼上傳', 'expense'],
    ['我怎麼看不到營收', 'finance_hidden'],
    ['球場有幾面', 'courts'],
    ['要幫新同事開帳號', 'staff_account'],
  ]
  for (const [q, id] of variants) check(`「${q}」→ ${id}`, matchGuide(q)?.id === id, matchGuide(q)?.id ?? 'null')
  check('無關問題不亂配', matchGuide('今天天氣如何') === null)

  // 連結只給有權限的角色；未開放功能不給連結
  const staff = await renderGuide(GUIDES.find((g) => g.id === 'staff_account')!, 'FRONTDESK', 'main')
  const owner = await renderGuide(GUIDES.find((g) => g.id === 'staff_account')!, 'OWNER', 'main')
  const sLinks = (staff.cards[0] as { links: { href: string | null; state: string | null }[] }).links
  check('櫃台人員問建立帳號：有說明、無連結並標示沒有權限', staff.mode === 'guide' && staff.label === '操作指南' && sLinks[0].href === null && sLinks[0].state === '目前帳號沒有權限' && staff.sources.length === 0)
  check('擁有者同一題有連結', owner.sources[0]?.href === '/admin/settings/staff')
  const complaint = await renderGuide(GUIDES.find((g) => g.id === 'complaint')!, 'MANAGER', 'main')
  const cLinks = (complaint.cards[0] as { links: { label: string; href: string | null; state: string | null }[] }).links
  check('客訴：未開放功能標示「尚未開放」且不建立連結', cLinks.some((l) => l.state === '尚未開放' && l.href === null) && complaint.sources.every((s) => !s.href.includes('complaint')))

  // 即時查詢：球場數讀場館設定
  const courts = await renderGuide(GUIDES.find((g) => g.id === 'courts')!, 'FRONTDESK', 'main')
  check('球場數由場館設定即時查詢並標示', courts.mode === 'quick' && courts.label === '即時查詢' && /共 \d+ 面/.test(courts.reply) && Boolean(courts.queriedAt))
  const courtsDemo = await renderGuide(GUIDES.find((g) => g.id === 'courts')!, 'FRONTDESK', 'demo')
  check('展示資料範圍標示為展示範例', courtsDemo.label.startsWith('展示範例') && courtsDemo.demo)
  const finance = await renderGuide(GUIDES.find((g) => g.id === 'finance_hidden')!, 'FRONTDESK', 'main')
  check('櫃台人員問財務報表：說明看不到帳務，不給帳務連結', finance.reply.includes('櫃台人員看不到帳務') && finance.sources.every((s) => s.href !== '/admin/reports'))
}

main()
  .catch((err) => {
    console.error(err)
    results.push({ name: '執行', ok: false, detail: String(err) })
  })
  .finally(() => {
    const ok = results.filter((r) => r.ok).length
    console.log(`\n通過 ${ok}／${results.length}`)
    process.exit(ok === results.length ? 0 : 1)
  })
