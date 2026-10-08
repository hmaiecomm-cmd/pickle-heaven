import 'server-only'
import { prisma } from '@/lib/db'
import { can, type AdminRole, type Permission } from '@/lib/admin-permissions'

/**
 * 小P 的「操作指南」知識庫：不依賴外部模型也能使用。
 * - 操作指南：固定說明，入口連到實際路由；尚未完成的功能標示「尚未開放」，不建立無效連結。
 * - 需要即時資料的題目（例如球場數）改由系統查詢並標示查詢時間。
 * - 連結只顯示登入者有權限開啟的頁面；AI 權限與操作人一致。
 */

export interface GuideLink {
  label: string
  href: string | null
  /** 需要的權限；沒有權限時仍顯示說明但不給連結 */
  permission?: Permission
  /** 功能尚未開放：顯示「尚未開放」而不是連結 */
  notOpen?: boolean
}

export interface GuideEntry {
  id: string
  question: string
  answer: string
  links: GuideLink[]
  patterns: RegExp[]
  /** 需要即時資料：由 renderGuide 查詢後填入 */
  live?: 'courts'
}

export const GUIDES: GuideEntry[] = [
  {
    id: 'new_session',
    question: '如何新增球敘活動？',
    answer: '到「活動管理 → 活動列表」按「新增活動」，填寫名稱、日期、時間、A／B 場地、價格及名額，按「預覽」確認沒有場地衝突後再發布。',
    links: [{ label: '新增活動', href: '/admin/activities/new', permission: 'activities' }, { label: '活動列表', href: '/admin/activities', permission: 'activities' }],
    patterns: [/新增.*(球敘|活動)/, /(球敘|活動).*(新增|建立|怎麼開)/, /建立.*活動/, /開.*(球敘|活動)/, /新的(球敘|活動)/],
  },
  {
    id: 'slot_blocked',
    question: '為什麼某個時段不能預約？',
    answer: '可能已有訂場、活動占用、清潔封場、付款暫留，或已超過預約期限。請到「預約行事曆」選擇場地與時間查看該時段的實際原因；未查到資料前不能斷定是哪一種。',
    links: [{ label: '預約行事曆', href: '/admin/schedule', permission: 'courts' }, { label: '清潔／維護排程', href: '/admin/maintenance', permission: 'courts.manage' }],
    patterns: [/(不能|無法|沒辦法).*(預約|訂)/, /時段.*(不能|無法|鎖|占用)/, /為什麼.*(預約|時段)/],
  },
  {
    id: 'weekly',
    question: '如何設定每週固定活動？',
    answer: '在活動編輯頁的「場次與場地」選擇週期安排，設定星期、時段、場地及結束日期，按「預覽」逐場檢查衝突後發布；每個日期會建立獨立場次。',
    links: [{ label: '新增每週活動', href: '/admin/activities/new?repeat=WEEKLY', permission: 'activities' }, { label: '場次與週期安排', href: '/admin/sessions', permission: 'activities.view' }],
    patterns: [/每週|每周|週期|固定活動|重複/],
  },
  {
    id: 'modify_booking',
    question: '如何修改客人的預約？',
    answer: '只有管理員與擁有者可以修改。先在「交易管理」開啟預約明細，取消或重新安排新日期、時間及場地並確認無衝突；涉及付款差額（退款或補款）時交由擁有者處理，不自行退款或補扣款。工作人員不能新增、改期或取消客人的預約。',
    links: [{ label: '交易管理', href: '/admin/bookings', permission: 'bookings' }, { label: '預約行事曆', href: '/admin/schedule', permission: 'courts' }],
    patterns: [/(修改|改期|更改|變更|取消).*(預約|訂單|訂場)/, /(預約|訂單).*(修改|改期|取消)/, /改期|改時間|換時段/],
  },
  {
    id: 'complaint',
    question: '工作人員如何處理客訴？',
    answer: '先在「人員管理」搜尋會員，或在「交易管理」找到預約，查看服務所需的資料；把客訴內容記在會員的「內部備註」並通知管理員處理。工作人員不能直接修改訂單、退款或調整點數。獨立的客訴單與指派功能尚未開放。',
    links: [{ label: '人員列表', href: '/admin/members', permission: 'members' }, { label: '交易管理', href: '/admin/bookings', permission: 'bookings' }, { label: '客訴單與指派', href: null, notOpen: true }],
    patterns: [/客訴|投訴|抱怨|申訴/],
  },
  {
    id: 'devices',
    question: '如何查看門是否關好、燈是否關閉？',
    answer: '到「場地即時監測」查看 A／B 場設備狀態及最後回報時間。目前設備尚未串接：門鎖、燈光與感測資料都會顯示「未串接」或「未知」，不能判定門已關或燈已關閉；請以現場確認為準。',
    links: [{ label: '場地即時監測', href: '/admin/monitor', permission: 'monitor' }, { label: '設備串接設定', href: '/admin/settings/devices', permission: 'settings' }],
    patterns: [/門.*(關|鎖)|燈.*(關|開)|設備|感測|監測/],
  },
  {
    id: 'topup_how',
    question: '客人如何購買點數？',
    answer: '客人登入前台會員中心，在會員總覽或「我的點數」按「儲值點數」，選擇方案、確認內容後付款；後端收到金流確認才會入帳。正式金流尚未接通前，前台會顯示「線上儲值尚未開放」，請改由櫃台處理。方案由擁有者在「設定管理 → 儲值方案」設定。',
    links: [{ label: '儲值方案設定', href: '/admin/settings/topup', permission: 'settings' }, { label: '儲值單', href: '/admin/topup', permission: 'finance' }],
    patterns: [/(購買|買|儲值).*(點數)/, /點數.*(購買|怎麼買|儲值)/, /儲值/],
  },
  {
    id: 'topup_missing',
    question: '付款了但點數沒增加怎麼辦？',
    answer: '先在「交易管理 → 儲值單」查看該筆狀態並轉交擁有者查核。狀態「付款確認中」時不要請客人再次付款；查明已收款而未入點（狀態「已收款，入帳失敗」）時，由擁有者按「補入點數」，系統會以可追蹤且不重複的方式補入。',
    links: [{ label: '儲值單', href: '/admin/topup', permission: 'finance' }, { label: '人員列表（查點數帳本）', href: '/admin/members', permission: 'members' }],
    patterns: [/(付款|付了|繳了).*(點數|沒有|未)/, /點數.*(沒|未).*(增加|入帳|到)/],
  },
  {
    id: 'expense',
    question: '如何登錄支出收據？',
    answer: '開啟「費用與收據」，按「拍照登錄」（手機會開相機）或「上傳收據」，預覽後填寫支出日期、類別、商家、金額與單據號碼，人工確認後提交，由擁有者審核。OCR 尚未串接，欄位需人工填寫。管理員與工作人員只看得到自己的申請。',
    links: [{ label: '費用與收據', href: '/admin/expenses', permission: 'expenses.own' }],
    patterns: [/收據|支出|費用|報帳|發票.*(登錄|上傳)/],
  },
  {
    id: 'finance_hidden',
    question: '為什麼我看不到財務報表？',
    answer: '完整帳務（營收、金流明細、退款、財務報表、匯出）只開放擁有者。管理員與工作人員依職務查看非財務營運資料（場地使用率、報到、名額）；AI、匯出與 API 套用同一套權限，不能透過我取得被限制的數據。',
    links: [{ label: '營運報表（含帳務）', href: '/admin/reports', permission: 'finance' }, { label: '場地使用率', href: '/admin/reports/utilization', permission: 'reports' }],
    patterns: [/財務|報表|營收|收入|看不到/],
  },
  {
    id: 'courts',
    question: '本館有幾面球場？',
    answer: '',
    links: [{ label: '場地與時段', href: '/admin/courts', permission: 'courts' }],
    patterns: [/幾面|幾個(球)?場|有哪些場地|場地有/],
    live: 'courts',
  },
  {
    id: 'staff_account',
    question: '如何建立工作人員帳號？',
    answer: '由擁有者到「設定管理 → 後台帳號與權限」新增，指定顯示名稱、登入帳號、初始密碼、角色（管理員或工作人員）及授權場館。對方首次登入後必須更換初始密碼。管理員不能自行新增帳號或修改自己的角色。',
    links: [{ label: '後台帳號與權限', href: '/admin/settings/staff', permission: 'staff' }],
    patterns: [/(建立|新增|開).*(帳號|工作人員|管理員)/, /帳號.*(建立|新增)/],
  },
]

/** 依文字找最符合的指南（第一個命中的條目） */
export function matchGuide(text: string): GuideEntry | null {
  const t = text.replace(/\s/g, '')
  for (const g of GUIDES) {
    if (g.question.replace(/[？?]/g, '') === t.replace(/[？?]/g, '')) return g
  }
  return GUIDES.find((g) => g.patterns.some((p) => p.test(t))) ?? null
}

export interface GuideReply {
  reply: string
  cards: unknown[]
  sources: { label: string; href: string }[]
  queriedAt: string
  mode: 'guide' | 'quick'
  /** 顯示給使用者的標示：操作指南／即時查詢／展示範例 */
  label: string
  demo: boolean
}

/** 產生回覆：固定說明不查資料（操作指南）；需要即時資料的題目查系統並標示查詢時間 */
export async function renderGuide(entry: GuideEntry, role: AdminRole, tenant: 'main' | 'demo'): Promise<GuideReply> {
  const links = entry.links.map((l) => ({ label: l.label, href: l.notOpen ? null : l.permission && !can(role, l.permission) ? null : l.href, state: l.notOpen ? '尚未開放' : l.permission && !can(role, l.permission) ? '目前帳號沒有權限' : null }))
  const sources = links.filter((l): l is typeof l & { href: string } => Boolean(l.href)).map((l) => ({ label: l.label, href: l.href }))
  const at = new Date().toISOString()
  if (entry.live === 'courts') {
    const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { name: true } })
    const courts = await prisma.court.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { name: true } })
    const names = courts.map((c) => c.name).join('、')
    return {
      reply: courts.length === 0 ? `${venue?.name ?? '場館'}目前沒有啟用中的場地（依場館設定查詢）。` : `${venue?.name ?? '場館'}目前設定為 ${names}，共 ${courts.length} 面球場（依場館設定即時查詢，不含停用場地）。`,
      cards: [{ kind: 'guide', title: entry.question, links }],
      sources,
      queriedAt: at,
      mode: 'quick',
      label: tenant === 'demo' ? '展示範例（隔離示範資料）' : '即時查詢',
      demo: tenant === 'demo',
    }
  }
  return {
    reply: entry.answer,
    cards: [{ kind: 'guide', title: entry.question, links }],
    sources,
    queriedAt: at,
    mode: 'guide',
    label: '操作指南',
    demo: tenant === 'demo',
  }
}

/** 列出全部指南（供即時查詢不可用時顯示） */
export function guideList() {
  return GUIDES.map((g) => ({ id: g.id, question: g.question }))
}
