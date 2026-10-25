import type { Metadata } from 'next'
import Link from 'next/link'
import { brand, contact, legal } from '@/config/site'

const TITLE = '蒐集、處理及利用個人資料法定告知事項'
const PLATFORM = '顧好 AI 智慧場館平台'

export const metadata: Metadata = { title: TITLE, robots: { index: true, follow: true } }

const PDPA_URL = 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=I0050021'

/**
 * 依《個人資料保護法》第八條、第九條所為之告知事項。
 * 【】內為正式使用前須由營運方確認填寫的內容，頁面上以醒目底色標示；
 * 公司名稱與信箱於 config/site.ts 設定後會自動帶入。
 */
export default function PrivacyPage() {
  const company = legal.company ? <>{legal.company}</> : <Fill>營運公司完整登記名稱</Fill>
  const email = contact.email ? <>{contact.email}</> : <Fill>電子郵件</Fill>

  return (
    <article className="prose-ph mx-auto max-w-3xl py-4">
      <p className="text-sm font-semibold text-muted">{brand.name}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{TITLE}</h1>
      <p className="mt-1 text-xs text-muted">
        版本日期：<Fill>民國○年○月○日</Fill>
      </p>

      <div className="mt-5 space-y-2 text-sm leading-relaxed">
        <p>
          「{PLATFORM}」（以下簡稱本平台）由{company}（以下簡稱本公司）經營。本公司為提供會員服務、場館預約、交易管理及相關服務，於實際業務所必要的範圍內蒐集、處理及利用您的個人資料，依《個人資料保護法》第八條及第九條等規定，告知下列事項。
        </p>
        <p>
          本告知事項係說明本公司如何處理您的個人資料，不代表您概括同意所有資料利用方式；依法須另行取得同意者，本公司將另行辦理。
          <a href={PDPA_URL} target="_blank" rel="noopener noreferrer" className="ml-1 text-xs underline underline-offset-2">
            法規依據
          </a>
        </p>
      </div>

      <Section title="第一條　蒐集個人資料之機關名稱及聯絡方式">
        <ol className="list-none space-y-1 !pl-0">
          <li>一、公司名稱：{company}。</li>
          <li>二、平台名稱：{PLATFORM}。</li>
          <li>三、公司地址：<Fill>地址</Fill>。</li>
          <li>四、個人資料權利申請及客服信箱：{email}。</li>
          <li>五、客服電話或線上申請管道：<Fill>電話／網址</Fill>。</li>
        </ol>
        <p>
          合作場館若以其自身名義決定蒐集目的及利用方式，應由該場館另行提供告知事項。本公司如僅受場館委託處理資料，將依委託範圍及指示辦理，並協助轉交您的權利申請。
        </p>
      </Section>

      <Section title="第二條　蒐集之目的及業務特定項目">
        <p>
          本公司依您實際使用的功能，於下列目的必要範圍內處理個人資料。所列代碼係依主管機關公告之「個人資料保護法之特定目的及個人資料之類別」編排；列示代碼本身不構成蒐集或利用資料的法律授權。
        </p>
        <h3 className="pt-2 font-semibold">一、共通特定目的</h3>
        <Table
          head={['代碼', '特定目的名稱', '本平台適用事項']}
          rows={[
            ['069', '契約、類似契約或其他法律關係事務', '建立及履行平台服務契約、處理預約與取消事項'],
            ['090', '消費者、客戶管理與服務', '會員管理、服務聯繫、客服及預約通知'],
            ['091', '消費者保護', '消費申訴、交易爭議及權益保障'],
            ['135', '資（通）訊服務', '提供線上平台及相關資訊功能'],
            ['136', '資（通）訊與資料庫管理', '帳號與資料維護、備份及系統管理'],
            ['137', '資通安全與管理', '身分驗證、權限控管及異常使用防護'],
          ]}
        />
        <h3 className="pt-2 font-semibold">二、業務特定目的及對應資料類別</h3>
        <p>下表資料類別的名稱及具體內容，詳見第三條。</p>
        <Table
          head={['業務項目', '業務內容', '適用特定目的代碼', '對應個人資料類別']}
          rows={[
            ['會員註冊及登入', '建立會員、第三方帳號登入、帳號驗證及權限管理', '069、090、135、136、137', 'C001、C073'],
            ['場地預約及使用管理', '查詢與預訂時段、訂單管理、取消及使用通知', '069、090、148；運動場館另適用143', 'C001、C091、C102'],
            ['付款、退款及帳務', '處理交易結果、退款、收據與帳務核對', '069、104、129、148', 'C001、C091、C093、C102；實際取得退款帳戶等資料時另含C002'],
            ['會員優惠及折價券', '發放與核銷會員權益、點數、折價券及優惠資格', '069、090、148', 'C001、C091、C093'],
            ['客服及消費爭議處理', '回覆詢問、處理申訴、查核交易紀錄', '069、090、091', 'C001、C091、C093、C102；無法歸入其他類別之客服信件另含C132'],
            ['系統維運及安全管理', '登入查核、異常交易偵測、操作紀錄及安全維護', '135、136、137', 'C001、C073；涉及交易查核時另含C091、C093'],
            ['法定保存及依法配合事項', '履行具體法定義務、提供依法應交付之紀錄', '063；會計事項另適用129', '依各該義務所必要的資料類別為限'],
            [<Optional key="o">活動報名及運動課程</Optional>, '活動、競賽、課程預約及參與管理', '069、090、142、143、148', 'C001、C091；實際收集年齡、興趣或學習紀錄時另含C011、C035、C057'],
            [<Optional key="o">門禁及進出管理</Optional>, '核驗使用資格、記錄進出時間', '116、137', 'C001、C073、C091'],
            [<Optional key="o">人工智慧客服及服務推薦</Optional>, '回覆服務問題、依使用紀錄提供場地或時段建議', '090、135；涉及統計分析時另適用157', 'C001、C091；實際分析興趣時另含C035，無法歸類之對話內容另含C132'],
            [<Optional key="o">行銷及滿意度調查</Optional>, '優惠訊息、活動推廣、問卷及服務改善分析', '040、157', 'C001、C035、C091；實際收集年齡等描述資料時另含C011'],
          ]}
        />
        <h3 className="pt-2 font-semibold">三、上表業務特定目的代碼名稱</h3>
        <ul>
          <li>040：行銷（包含金控共同行銷業務）。本平台僅適用其中與自身服務有關的行銷。</li>
          <li>063：非公務機關依法定義務所進行個人資料之蒐集處理及利用。</li>
          <li>104：帳務管理及債權交易業務。本平台僅適用實際帳務管理事項。</li>
          <li>116：場所進出安全管理。</li>
          <li>129：會計與相關服務。</li>
          <li>142：運動、競技活動。</li>
          <li>143：運動休閒業務。</li>
          <li>148：網路購物及其他電子商務服務。</li>
          <li>157：調查、統計與研究分析。</li>
        </ul>
      </Section>

      <Section title="第三條　個人資料之類別">
        <p>本公司依實際服務需要，蒐集下列資料中的必要項目，不因列入本條即要求您全部提供。</p>
        <Table
          head={['類別代碼及名稱', '本平台可能處理的具體資料']}
          rows={[
            ['C001 辨識個人者', '姓名、暱稱、電話、電子郵件、會員帳號、第三方登入識別碼、經授權取得的頭像，以及可連結至個人的網路位址或裝置識別資料'],
            ['C002 辨識財務者', '辦理退款或核帳所需的銀行帳戶名稱、帳號，或實際由金流業者回傳且具財務辨識性的資料'],
            ['C011 個人描述', <><Optional>選用</Optional>年齡、出生年月日等與活動資格或服務需要直接相關的資料</>],
            ['C035 休閒活動及興趣', <><Optional>選用</Optional>自行填寫或由使用紀錄分析的運動偏好、場地與時段偏好</>],
            ['C057 學生（員）、應考人紀錄', <><Optional>選用</Optional>課程參與、學習進度及評量紀錄</>],
            ['C073 安全細節', '驗證資料、密碼雜湊值、授權等級及帳號安全設定'],
            ['C091 資料主體所取得之財貨或服務', '預約場館、日期、時段、服務項目、訂單、取消紀錄及優惠使用紀錄'],
            ['C093 財務交易', '交易金額、支付方式、付款狀態、交易識別碼及退款紀錄'],
            ['C102 約定或契約', '服務申請、預約約定、契約版本及相關確認紀錄'],
            ['C132 未分類之資料', '無法歸入前述類別的客服信件、意見回饋或對話內容；不作為擴張蒐集範圍的概括項目'],
          ]}
        />
        <p>
          付款資料的實際流向及本公司保存範圍為：<Fill>填寫金流業者名稱、本公司接收的欄位及是否直接接觸信用卡資料</Fill>。
        </p>
        <p>
          本告知事項不包含人臉辨識、指紋辨識或以可辨識個人的影像進行人工智慧分析。若提供此類功能，將另行說明必要性、資料項目、利用範圍及保存期間。
        </p>
        <p>
          病歷、醫療、基因、性生活、健康檢查及犯罪前科資料，亦不列為一般會員或預約服務的蒐集項目；如特定服務確有需要，應另依個資法第六條辦理。
        </p>
      </Section>

      <Section title="第四條　個人資料之來源">
        <ol className="list-none space-y-1 !pl-0">
          <li>一、您註冊、預約、付款、申請退款、聯繫客服或參與活動時直接提供的資料。</li>
          <li>二、您使用本平台時產生的登入、預約、交易及操作紀錄。</li>
          <li>三、您使用第三方登入服務時，由<Fill>實際登入服務提供者名稱</Fill>於授權範圍內提供的帳號識別及基本資料。</li>
          <li>四、由<Fill>實際金流服務提供者名稱</Fill>於履行交易所必要範圍內提供的付款或退款結果。</li>
          <li>五、由您使用的合作場館<Fill>場館名稱或名單連結</Fill>依法提供的預約、報到或使用紀錄。</li>
        </ol>
        <p>
          非由您直接提供的資料，本公司將依法於處理或利用前，或首次利用時併同告知具體來源及相關事項；符合法定免告知情形者，依其規定辦理。
        </p>
      </Section>

      <Section title="第五條　個人資料利用之期間">
        <p>本公司依資料用途分別設定保存期限：</p>
        <Table
          head={['資料項目', '保存期間']}
          rows={[
            ['會員基本資料', <>會員關係存續期間；終止後<Fill>期間</Fill>內完成刪除或去識別化，但仍有合法保存必要者除外</>],
            ['預約、交易及退款紀錄', <>自交易完成或取消日起<Fill>期間</Fill>；依法須保存之會計或交易憑證，依適用法令辦理</>],
            ['客服及申訴紀錄', <>自案件結案日起<Fill>期間</Fill></>],
            ['系統、安全及登入紀錄', <>自紀錄產生日起<Fill>期間</Fill></>],
            [<Optional key="o">門禁進出紀錄</Optional>, <>自紀錄產生日起<Fill>期間</Fill></>],
            [<Optional key="o">人工智慧客服對話</Optional>, <>自對話結束日起<Fill>期間</Fill></>],
            [<Optional key="o">行銷資料</Optional>, '行銷目的存續且具合法利用依據期間；您拒絕後停止行銷利用，得保留避免再次聯繫所必要的最少紀錄'],
          ]}
        />
        <p>
          發生爭議或有法定保存義務時，僅於處理該事項必要的範圍及期間內保留資料，並限制其他利用。保存原因消失後，依法刪除、停止處理或利用。
        </p>
        <p>
          備份資料依<Fill>備份輪替及刪除期限</Fill>處理；備份還原時，應同步落實已受理的刪除或停止利用要求。
        </p>
      </Section>

      <Section title="第六條　個人資料利用之地區、對象及方式">
        <h3 className="font-semibold">一、利用地區</h3>
        <p>
          中華民國境內，以及提供本平台必要服務的境外處理地區：
          <Fill>依實際雲端主機、資料庫、備份、通訊及人工智慧服務部署情形，逐項填寫國家或地區</Fill>。
        </p>
        <p>涉及境外處理時，應提供下列資訊：</p>
        <Table
          head={['服務用途', '業者名稱', '處理或儲存國家／地區']}
          rows={[
            ['平台主機與資料庫', <Fill key="a">填寫</Fill>, <Fill key="b">填寫</Fill>],
            ['帳號登入及通知', <Fill key="a">填寫</Fill>, <Fill key="b">填寫</Fill>],
            ['付款及退款', <Fill key="a">填寫</Fill>, <Fill key="b">填寫</Fill>],
            [<Optional key="o">人工智慧服務</Optional>, <Fill key="a">填寫</Fill>, <Fill key="b">填寫</Fill>],
          ]}
        />
        <h3 className="pt-2 font-semibold">二、利用對象</h3>
        <ol className="list-none space-y-1 !pl-0">
          <li>（一）本公司經授權執行業務的人員。</li>
          <li>（二）您實際預約或使用的場館，限履行該筆預約、核驗使用資格及處理相關服務所必要的資料。</li>
          <li>（三）受本公司委託的系統、雲端、資料庫、客服、通訊及其他服務業者，限委託目的及必要範圍。</li>
          <li>（四）辦理您所選付款或退款方式的金流服務業者及金融機構。</li>
          <li>（五）依法有權要求提供資料的機關，限其合法要求範圍。</li>
          <li>（六）經另行向您告知並依法取得同意的特定對象。</li>
        </ol>
        <p>合作場館及服務業者不因參與本平台，即得取得全部會員資料或自行用於行銷。</p>
        <h3 className="pt-2 font-semibold">三、利用方式</h3>
        <p>
          於前述目的範圍內，以電子系統或人工方式辦理身分核驗、資料建檔、預約管理、交易核對、服務通知、客服處理、資訊安全維護及必要統計。
        </p>
      </Section>

      <Section title={<>第七條　人工智慧功能之資料處理<Optional>選用</Optional></>}>
        <ol className="list-none space-y-1 !pl-0">
          <li>
            一、本平台使用人工智慧的具體功能為：<Fill>填寫，例如預約問題回覆、場地推薦</Fill>，使用的資料為：<Fill>填寫實際欄位</Fill>。
          </li>
          <li>
            二、向人工智慧服務業者傳送資料前，本公司將移除與該功能無關的身分及交易資訊，並於可行範圍內採取遮蔽或去識別措施。
          </li>
          <li>
            三、本範本採取以下利用限制：本公司及受託業者不得將可辨識您的個人資料，用於通用人工智慧模型訓練。若未來擬辦理不同目的的模型訓練，應先另行確認法律依據並完成必要告知及同意程序。
          </li>
          <li>
            四、對人工智慧回覆或推薦有疑問時，您可透過<Fill>人工客服管道</Fill>要求協助。涉及收費、退款或帳號使用權益的爭議，可提出人工覆核申請。
          </li>
        </ol>
      </Section>

      <Section title="第八條　當事人得行使之權利及方式">
        <p>您可依法向本公司提出資料查閱、取得副本、補正、停止蒐集或使用，以及刪除等申請，相關權利不因使用本平台而預先放棄。</p>
        <p>
          申請請寄送至<Fill>個資權利申請信箱</Fill>，或透過<Fill>線上申請網址／郵寄地址</Fill>辦理。本公司將以必要且適當的方式確認申請人身分；由代理人申請時，應提供必要的代理權限證明。
        </p>
        <p>
          查閱或副本申請，原則上於十五日內決定是否准許；其他依個資法第十一條提出的請求，原則上於三十日內決定。必要延長時，將依法書面告知原因。查閱及副本如需收取必要成本，將事先說明。
        </p>
        <p>依法有不予提供、繼續保存或繼續處理的例外事由時，本公司將說明理由及範圍，不以本條排除您的法定權利。</p>
      </Section>

      <Section title="第九條　不提供個人資料對權益之影響">
        <ol className="list-none space-y-1 !pl-0">
          <li>一、您得選擇是否提供個人資料。若未提供註冊、驗證、預約、付款或退款所必要的資料，本公司可能無法完成相應服務。</li>
          <li>二、拒絕提供選填的興趣、問卷、行銷或個人化推薦資料，不影響基本會員及預約服務；僅可能無法提供相關加值功能。</li>
          <li>
            三、如申請刪除或停止處理履行既有預約所必要的資料，可能影響通知、核驗或服務履行。本公司將說明具體影響，並協助處理尚未完成的交易及退款事項。
          </li>
        </ol>
      </Section>

      <Section title={<>第十條　行銷選擇<Optional>選用</Optional></>}>
        <p>
          本公司僅於具合法依據的範圍內，利用您的資料提供優惠或活動訊息。首次行銷時，將提供免費、便利的拒絕方式；您可隨時透過<Fill>退訂方式或客服管道</Fill>拒絕行銷，本公司收到後將停止相關利用。
        </p>
        <p>拒絕行銷不影響預約確認、付款結果、取消通知及必要安全通知的接收。</p>
        <p>本公司不因您接受本告知事項，即視為您同意合作場館或其他第三人自行向您行銷。</p>
      </Section>

      <Section title="第十一條　告知事項之更新">
        <p>
          本公司調整資料處理事項時，將更新版本日期，並以平台公告或適當方式通知。若涉及新增目的、資料項目、利用對象或其他依法應另行告知或取得同意的事項，將於實施前完成必要程序，不僅以公告更新取代。
        </p>
      </Section>

      <p className="mt-8 text-xs text-muted">
        另請參閱 <Link href="/terms" className="underline underline-offset-2">服務條款</Link>。
      </p>
    </article>
  )
}

/** 尚待營運方填寫的內容：醒目底色標示，避免正式上線時遺漏 */
function Fill({ children }: { children: React.ReactNode }) {
  return <mark className="rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">【{children}】</mark>
}

/** 選用項目標記；未提供該功能時應整段刪除 */
function Optional({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="mr-1 inline-block rounded border border-[rgb(var(--border))] px-1 text-[11px] font-normal text-muted">選用</span>
      {children === '選用' ? null : children}
    </>
  )
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-7 space-y-2 text-sm leading-relaxed [&_ul>li]:ml-5 [&_ul>li]:list-disc [&_ul]:space-y-1">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[32rem] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[rgb(var(--border))]">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-2 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-[rgb(var(--border))] align-top">
              {cells.map((c, j) => (
                <td key={j} className="px-2 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
