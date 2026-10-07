import type { Metadata } from 'next'
import Link from 'next/link'
import { brand, contact, legal } from '@/config/site'

export const metadata: Metadata = { title: '隱私權政策', robots: { index: true, follow: true } }

const UPDATED = '2026 年 10 月 7 日'

/** 隱私權政策：說明本站因預約與登入所蒐集的資料與用途 */
export default function PrivacyPage() {
  const operator = legal.company ?? brand.name
  return (
    <article className="prose-ph mx-auto max-w-2xl py-4">
      <h1 className="text-2xl font-bold tracking-tight">隱私權政策</h1>
      <p className="mt-1 text-xs text-muted">最後更新：{UPDATED}</p>

      <Section title="一、適用範圍">
        <p>本政策適用於「{brand.name}」場地預約網站（以下稱「本站」）。本站由 {operator} 營運，提供場地預約、活動報名與付款服務。</p>
      </Section>

      <Section title="二、我們蒐集的資料">
        <ul>
          <li><strong>Google 登入資料</strong>：您以 Google 帳號登入時，本站只會取得 Google 提供的帳號識別碼、顯示名稱、頭像與電子郵件。本站不會取得、也不會儲存您的 Google 密碼。</li>
          <li><strong>聯絡資料</strong>：預約時填寫的姓名與手機號碼，用於到場報到與場館聯絡。</li>
          <li><strong>預約與交易資料</strong>：預約的場地、時段、活動報名、訂單金額、付款狀態與發票資訊。信用卡號由合作的金流服務商處理，本站不儲存完整卡號。</li>
          <li><strong>技術資料</strong>：為維持登入狀態與購物車，本站會使用必要的 Cookie；不使用第三方廣告追蹤。</li>
        </ul>
      </Section>

      <Section title="三、資料用途">
        <ul>
          <li>建立與管理您的會員帳號、預約、活動報名與訂單。</li>
          <li>處理付款、退款、點數與發票。</li>
          <li>傳送與預約相關的通知（例如預約成立、取消、候補遞補）。</li>
          <li>維護服務安全、防止濫用與處理爭議。</li>
        </ul>
        <p>本站不會將您的個人資料出售或提供給與服務無關的第三方。</p>
      </Section>

      <Section title="四、資料分享對象">
        <p>僅在提供服務所必要時，與下列對象分享最少限度的資料：Google（登入驗證）、金流服務商（付款與退款）、電子發票服務商（如有開立）。</p>
      </Section>

      <Section title="五、資料保存與刪除">
        <p>帳號資料於您使用本站期間保存；交易與發票資料依相關法令規定保存。您可於「我的帳戶」修改顯示名稱與手機號碼，或聯絡場館申請刪除帳號；法令要求保留的交易紀錄除外。</p>
      </Section>

      <Section title="六、您的權利">
        <p>您可以隨時查詢、更正您的個人資料，或要求停止使用、刪除。請透過場館櫃台或下方聯絡方式提出申請。</p>
      </Section>

      <Section title="七、聯絡我們">
        <p>
          對本政策有任何疑問，請聯絡 {operator}
          {contact.email ? <>（{contact.email}）</> : null}，或至場館櫃台洽詢。
        </p>
      </Section>

      <p className="mt-8 text-xs text-muted">
        另請參閱 <Link href="/terms" className="underline underline-offset-2">服務條款</Link>。
      </p>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 space-y-2 text-sm leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}
