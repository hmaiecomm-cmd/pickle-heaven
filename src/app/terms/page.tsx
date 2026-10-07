import type { Metadata } from 'next'
import Link from 'next/link'
import { brand, legal } from '@/config/site'

export const metadata: Metadata = { title: '服務條款', robots: { index: true, follow: true } }

const UPDATED = '2026 年 10 月 7 日'

/** 服務條款：預約、付款、取消退款與帳號使用規範；退款比例以場館公告為準 */
export default function TermsPage() {
  const operator = legal.company ?? brand.name
  return (
    <article className="mx-auto max-w-2xl py-4">
      <h1 className="text-2xl font-bold tracking-tight">服務條款</h1>
      <p className="mt-1 text-xs text-muted">最後更新：{UPDATED}</p>

      <Section title="一、服務內容">
        <p>「{brand.name}」網站（以下稱「本站」）由 {operator} 提供場地預約、活動報名與線上付款服務。使用本站即表示您同意本條款。</p>
      </Section>

      <Section title="二、帳號">
        <ul>
          <li>本站以 Google 帳號登入，您應妥善保管自己的 Google 帳號；以您帳號完成的預約與付款視為您本人的行為。</li>
          <li>請提供正確的姓名與手機號碼，以便到場報到與場館聯絡。</li>
          <li>違反場館規定、惡意佔用時段或重複未到場者，場館得限制其預約或報名權限。</li>
        </ul>
      </Section>

      <Section title="三、預約與付款">
        <ul>
          <li>加入購物車的時段僅為暫時保留，保留時間到期未完成付款即自動釋放。</li>
          <li>預約於付款完成後成立；付款以本站顯示的金額與時段為準。</li>
          <li>已開始或已超過預約截止時間的時段無法線上預約。</li>
          <li>活動報名以完成付款為準，名額依報名順序分配；候補者於有名額時依序遞補。</li>
        </ul>
      </Section>

      <Section title="四、取消與退款">
        <ul>
          <li>取消政策與退款比例以預約頁及訂單詳情所載之場館公告為準，不同時間取消適用不同比例。</li>
          <li>退款依原付款方式或以本站點數回補；點數可於下次預約折抵。</li>
          <li>因天候或場館因素無法提供場地時，場館將主動聯絡並安排改期或全額退款。</li>
        </ul>
      </Section>

      <Section title="五、場館使用">
        <p>請遵守場館公告的入場、鞋類與安全規定。於場館內發生之人身或財物損害，依場館現場規定與相關法令處理。</p>
      </Section>

      <Section title="六、條款變更">
        <p>本站得視需要修訂本條款，修訂後公布於本頁即生效。重大變更將於網站明顯處公告。</p>
      </Section>

      <p className="mt-8 text-xs text-muted">
        個人資料的處理方式請見 <Link href="/privacy" className="underline underline-offset-2">隱私權政策</Link>。
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
