import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { brand, contact, HOME_IMAGES_HAVE_CONCEPT, images, legal, SHOW_PENDING, social } from '@/config/site'
import { ntd } from '@/lib/utils'
import type { HomeData } from '@/server/home-data'
import { CourtLines, Eyebrow, Pending, Photo } from './parts'

/* ================================================================
 * 首屏主視覺
 * 桌機：左側深紫文字欄，右側大照片（人物在照片中段，文字不會蓋到）。
 * 手機：照片在上、品牌與標題緊接在下，第一屏就看得到預約按鈕。
 * ================================================================ */
export function HeroSection({ data }: { data: HomeData }) {
  const facts = [
    data.venue && { k: '線上可預約', v: data.venue.openLabel },
    data.venue && { k: '每個時段', v: `${data.venue.slotMinutes} 分鐘` },
    data.minPrice != null && { k: '場地費', v: `${ntd(data.minPrice)} 起` },
  ].filter(Boolean) as { k: string; v: string }[]

  return (
    <section id="top" aria-labelledby="hero-title" className="hp-on-dark relative isolate overflow-hidden bg-hp-deep text-white">
      <div className="lg:grid lg:min-h-[min(100svh,60rem)] lg:grid-cols-12">
        <div className="relative h-[44svh] min-h-[17rem] overflow-hidden lg:col-span-8 lg:col-start-5 lg:row-start-1 lg:h-auto">
          <Image
            src={images.hero.src}
            alt={images.hero.alt}
            fill
            priority
            sizes="(min-width: 1024px) 67vw, 100vw"
            className="origin-[50%_22%] scale-[1.16] object-cover object-[50%_30%]"
          />
          {/* 只在照片邊緣加深紫漸層，確保導覽列與標題可讀，不改變照片本身色調 */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-hp-deep/75 to-transparent" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-hp-deep to-transparent lg:hidden" />
          <div aria-hidden className="absolute inset-y-0 left-0 hidden w-48 bg-gradient-to-r from-hp-deep to-transparent lg:block" />
        </div>

        <div className="relative z-10 px-[var(--hp-gutter)] pb-14 pt-1 lg:col-span-6 lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:justify-end lg:pb-24 lg:pt-36">
          <CourtLines className="absolute -left-10 top-10 hidden h-[30rem] w-[14rem] -rotate-12 text-white/[0.07] lg:block" />
          <div className="relative max-w-[40rem]">
            <Eyebrow className="hp-reveal font-display text-white/85">{brand.englishName}</Eyebrow>
            <h1 id="hero-title" className="hp-display hp-reveal mt-5 [--hp-delay:60ms]">
              在森林裡，
              <br />
              打出你的節奏。
            </h1>
            <p className="hp-lead hp-reveal mt-6 max-w-[34rem] text-white/85 [--hp-delay:120ms]">
              來大新店森林匹克球，享受揮拍的暢快，也享受相聚的時光。
            </p>
            <div className="hp-reveal mt-9 flex flex-wrap gap-3 [--hp-delay:180ms]">
              <Link href="/booking" className="hp-btn hp-btn-primary">
                預約場地
              </Link>
              <Link href="#coaching" className="hp-btn hp-btn-outline-light">
                探索課程
              </Link>
            </div>
            {facts.length > 0 && (
              <dl className="hp-reveal mt-12 grid max-w-[30rem] grid-cols-3 gap-4 border-t border-white/15 pt-6 [--hp-delay:240ms]">
                {facts.map((f) => (
                  <div key={f.k}>
                    <dt className="text-xs text-white/60">{f.k}</dt>
                    <dd className="mt-1 font-display text-[0.95rem] font-semibold tabular sm:text-base">{f.v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ================================================================
 * 玩法與方案：紫色主卡（球友集合）＋ 暖白外框卡（場地預約），視覺重量刻意不同
 * ================================================================ */
export function PlansSection({ data }: { data: HomeData }) {
  return (
    <section id="play" aria-labelledby="play-title" className="hp-section bg-hp-cream">
      <div className="hp-container">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Eyebrow index="01" className="hp-reveal text-hp-purple">
              PLAY
            </Eyebrow>
            <h2 id="play-title" className="hp-h2 hp-reveal mt-4">
              今天，你想怎麼玩？
            </h2>
          </div>
          <p className="hp-lead hp-reveal text-hp-ink/75 lg:col-span-4 lg:col-start-9 lg:pb-2">揪朋友一起開打，或加入一場新的相遇。</p>
        </div>

        <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-12 lg:gap-8">
          {/* 球友集合：主卡 */}
          <article className="hp-on-dark hp-reveal relative isolate overflow-hidden rounded-[var(--hp-radius-lg)] bg-hp-purple p-7 text-white sm:p-10 lg:col-span-7 lg:p-12">
            <CourtLines className="absolute -right-16 -top-24 -z-10 h-[34rem] w-[15rem] rotate-[28deg] text-white/[0.13]" />
            <p className="font-display text-sm font-semibold tracking-[0.2em] text-white/75">OPEN PLAY</p>
            <h3 className="mt-3 text-[clamp(1.9rem,3.6vw,2.9rem)] font-extrabold leading-tight">
              球友集合
            </h3>
            <p className="mt-4 max-w-[28rem] leading-relaxed text-white/85">
              不用自己湊齊人數。報名一個場次，就能和不同的球友輪流上場，打完再約下一場。
            </p>

            <div className="mt-8">
              <p className="text-sm font-semibold text-white/70">近期場次</p>
              {data.sessions.length > 0 ? (
                <ul className="mt-3 divide-y divide-white/15 border-y border-white/15">
                  {data.sessions.map((s) => (
                    <li key={s.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 py-4">
                      <span className="font-display text-lg font-bold tabular">{s.dateLabel}</span>
                      <span className="min-w-0 truncate text-[0.95rem] text-white/90">
                        {s.timeLabel}
                        <span className="hidden sm:inline">・{s.title}</span>
                      </span>
                      <span className="text-right font-display font-semibold tabular">{ntd(s.price)}</span>
                      <span className="col-span-3 text-xs text-white/70">{s.statusLabel}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border-y border-white/15 py-5 text-white/85">近期場次整理中，開放報名後會公布在活動頁。</p>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/sessions" className="hp-btn hp-btn-light">
                {data.sessions.length > 0 ? '查看全部場次' : '前往活動頁'}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </article>

          {/* 場地預約：外框資訊卡，往下錯位 */}
          <article className="hp-reveal relative rounded-[var(--hp-radius-lg)] border-[1.5px] border-hp-ink/85 bg-hp-cream p-7 [--hp-delay:120ms] sm:p-10 lg:col-span-5 lg:mt-20 lg:p-11">
            <p className="font-display text-sm font-semibold tracking-[0.2em] text-hp-purple">COURT BOOKING</p>
            <h3 className="mt-3 text-[clamp(1.9rem,3.6vw,2.9rem)] font-extrabold leading-tight">你的主場</h3>
            <p className="mt-4 leading-relaxed text-hp-ink/75">自己揪好球友，選日期、挑時段，線上完成場地預約與付款。</p>

            {data.prices.length > 0 ? (
              <>
                <p className="mt-8 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold tabular text-hp-purple">{ntd(data.minPrice ?? 0)}</span>
                  <span className="text-sm text-hp-ink/70">起／每時段{data.venue ? ` ${data.venue.slotMinutes} 分鐘` : ''}</span>
                </p>
                <table className="mt-6 w-full text-sm">
                  <caption className="sr-only">場地費率</caption>
                  <tbody className="divide-y divide-hp-ink/10">
                    {data.prices.map((p) => (
                      <tr key={p.label + p.timeLabel}>
                        <th scope="row" className="py-2.5 text-left font-semibold">{p.label}</th>
                        <td className="py-2.5 text-hp-ink/70 tabular">{p.timeLabel}</td>
                        <td className="py-2.5 text-right font-display font-semibold tabular">{ntd(p.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-4 text-xs leading-relaxed text-hp-ink/60">
                  依日期與時段計價，實際金額以預約頁顯示為準。
                  {data.venue && `開放預約未來 ${data.venue.bookAheadDays} 天內的時段。`}
                </p>
              </>
            ) : (
              <p className="mt-8 text-hp-ink/75">費率與可預約時段請在預約頁查看。</p>
            )}

            <div className="mt-8">
              <Link href="/booking" className="hp-btn hp-btn-primary w-full sm:w-auto">
                {data.prices.length > 0 ? '預約場地' : '查看方案'}
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

/* ================================================================
 * 教練與課程：有教練資料時用橫向人物卡；沒有就只放精簡的練習節奏介紹，不放虛構人物
 * ================================================================ */
const PRACTICE_STEPS = [
  { n: '01', t: '第一次拿拍', d: '從握拍、發球與基本規則開始，先把球穩穩送過網。' },
  { n: '02', t: '穩定來回', d: '練習底線抽球與網前小球，讓每一次來回都更長、更從容。' },
  { n: '03', t: '雙打默契', d: '站位、輪轉與第三拍的選擇，和搭檔打出屬於你們的節奏。' },
]

export function CoachingSection({ data }: { data: HomeData }) {
  const hasCoaches = data.coaches.length > 0
  return (
    <section id="coaching" aria-labelledby="coaching-title" className="hp-section relative overflow-hidden bg-hp-lilac">
      <CourtLines className="absolute -bottom-40 -left-24 h-[40rem] w-[18rem] -rotate-[20deg] text-hp-purple/[0.12]" />
      <div className="hp-container relative grid gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <Eyebrow index="02" className="hp-reveal text-hp-purple">
              COACHING
            </Eyebrow>
            <h2 id="coaching-title" className="hp-h2 hp-reveal mt-4">
              第一球，
              <br />
              到下一個突破。
            </h2>
            <p className="hp-lead hp-reveal mt-6 max-w-[26rem] text-hp-ink/75">找到適合你的練習節奏，讓每次上場都有新收穫。</p>
            {!hasCoaches && (
              <div className="hp-reveal mt-8 max-w-[26rem] rounded-[var(--hp-radius-md)] bg-hp-cream p-6">
                <p className="inline-flex items-center gap-2 rounded-full bg-hp-deep px-3 py-1 text-xs font-bold text-white">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-hp-lilac" />
                  課程籌備中
                </p>
                <p className="mt-4 leading-relaxed text-hp-ink/80">
                  教練課程正在規劃，開課時間、教練與費用確定後會在這裡公布。想先熟悉場地，可以從球友集合開始。
                </p>
                <Link href="/sessions" className="hp-btn hp-btn-outline hp-btn-sm mt-5">
                  先參加球友集合
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7">
          {hasCoaches ? (
            <ul className="space-y-6">
              {data.coaches.map((c, i) => (
                <li
                  key={c.id}
                  className="hp-reveal grid overflow-hidden rounded-[var(--hp-radius-lg)] bg-hp-cream sm:grid-cols-[13rem_1fr]"
                  style={{ ['--hp-delay' as string]: `${i * 80}ms` }}
                >
                  {/* 教練尚無照片欄位：以姓名字卡呈現，不放假照片 */}
                  <div className="hp-on-dark relative grid min-h-[11rem] place-items-center overflow-hidden bg-hp-deep text-white">
                    <CourtLines className="absolute inset-y-4 left-1/2 h-[calc(100%-2rem)] -translate-x-1/2 text-white/15" />
                    <span className="relative text-6xl font-extrabold">{c.name.slice(0, 1)}</span>
                    {SHOW_PENDING && <span className="hp-pending absolute bottom-3 left-3 text-white">照片待補</span>}
                  </div>
                  <div className="p-6 sm:p-8">
                    <h3 className="hp-h3">{c.name}</h3>
                    {c.specialties.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2" aria-label="專長">
                        {c.specialties.map((s) => (
                          <li key={s} className="rounded-full bg-hp-lilac px-3 py-1 text-sm font-semibold text-hp-deep">
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                    {c.bio && <p className="mt-4 leading-relaxed text-hp-ink/75">{c.bio}</p>}
                    <dl className="mt-5 grid gap-2 text-sm">
                      <div className="flex gap-3">
                        <dt className="w-16 shrink-0 text-hp-ink/60">適合對象</dt>
                        <dd>
                          <Pending />
                        </dd>
                      </div>
                      {c.hourlyRate > 0 && (
                        <div className="flex gap-3">
                          <dt className="w-16 shrink-0 text-hp-ink/60">課程費用</dt>
                          <dd className="font-display font-semibold tabular">{ntd(c.hourlyRate)}／小時</dd>
                        </div>
                      )}
                    </dl>
                    <p className="mt-6 inline-flex rounded-full border border-hp-ink/25 px-3 py-1 text-xs font-semibold text-hp-ink/70">
                      線上報名課程尚未開放
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ol className="border-t-[1.5px] border-hp-ink/80">
              {PRACTICE_STEPS.map((s, i) => (
                <li
                  key={s.n}
                  className="hp-reveal grid grid-cols-[4.5rem_1fr] gap-4 border-b border-hp-ink/15 py-8 sm:grid-cols-[7rem_1fr] sm:py-10"
                  style={{ ['--hp-delay' as string]: `${i * 90}ms` }}
                >
                  <span className="font-display text-4xl font-extrabold leading-none text-hp-purple tabular sm:text-6xl">{s.n}</span>
                  <div>
                    <h3 className="hp-h3">{s.t}</h3>
                    <p className="mt-2 max-w-[30rem] leading-relaxed text-hp-ink/75">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}

/* ================================================================
 * 品牌與場館故事：一張主照片＋兩張細節照片錯位
 * ================================================================ */
export function StorySection() {
  return (
    <section id="story" aria-labelledby="story-title" className="hp-section bg-hp-cream">
      <div className="hp-container grid gap-10 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-0">
        <Photo
          image={images.forestCourt}
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="hp-reveal lg:col-span-7 lg:row-span-2"
          frameClassName="aspect-[4/3] lg:aspect-[5/6]"
        />

        <div className="lg:col-span-5 lg:pt-6">
          <Eyebrow index="03" className="hp-reveal text-hp-purple">
            OUR STORY
          </Eyebrow>
          <h2 id="story-title" className="hp-h2 hp-reveal mt-4">
            森林裡的球場，
            <br />
            生活裡的主場。
          </h2>
          <p className="hp-lead hp-reveal mt-6 text-hp-ink/80">
            揮拍、交流，也讓自己慢下來。大新店森林匹克球，希望讓每一次相聚，都成為你期待再次上場的理由。
          </p>
        </div>

        <div className="grid grid-cols-2 items-start gap-4 sm:gap-6 lg:col-span-5 lg:self-end">
          <Photo
            image={images.lounge}
            sizes="(min-width: 1024px) 20vw, 50vw"
            className="hp-reveal"
            frameClassName="aspect-[4/5]"
          />
          <Photo
            image={images.entrance}
            sizes="(min-width: 1024px) 20vw, 50vw"
            className="hp-reveal mt-12 [--hp-delay:120ms] sm:mt-20"
            frameClassName="aspect-[3/4]"
          />
        </div>
      </div>
    </section>
  )
}

/* ================================================================
 * 交通資訊：只顯示已確認資料。缺漏欄位預覽時標「待補」，正式環境隱藏
 * ================================================================ */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

function contactHref(phone: string | null): { href: string; label: string; external: boolean } | null {
  if (contact.lineUrl) return { href: contact.lineUrl, label: '聯絡我們', external: true }
  if (phone) return { href: telHref(phone), label: '聯絡我們', external: false }
  if (contact.email) return { href: `mailto:${contact.email}`, label: '聯絡我們', external: false }
  return null
}

function navigationHref(address: string | null): string | null {
  if (contact.mapUrl) return contact.mapUrl
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  return null
}

export function VisitSection({ data }: { data: HomeData }) {
  const address = data.venue?.address ?? null
  const phone = data.venue?.phone ?? null
  const contactLink = contactHref(phone)
  const navHref = navigationHref(address)
  const contactText = [phone, contact.email].filter(Boolean).join('　')

  const rows: { k: string; v: React.ReactNode | null }[] = [
    { k: '場館名稱', v: brand.name },
    { k: '地址', v: address },
    { k: '線上可預約時段', v: data.venue ? `每日 ${data.venue.openLabel}` : null },
    { k: '交通方式', v: contact.transport },
    { k: '停車資訊', v: contact.parking },
    {
      k: '聯絡方式',
      v: contactText || (contact.lineUrl ? 'LINE 官方帳號' : null),
    },
  ]
  const shown = rows.filter((r) => r.v || SHOW_PENDING)
  const missingCore = !address

  return (
    <section id="visit" aria-labelledby="visit-title" className="hp-section bg-hp-lilac">
      <div className="hp-container">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-8">
          <Photo
            image={images.exterior}
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="hp-reveal lg:col-span-5"
            frameClassName="aspect-[4/3] lg:aspect-[4/5]"
            imgClassName="object-[66%_50%]"
          />

          <div className="lg:col-span-6 lg:col-start-7">
            <Eyebrow index="04" className="hp-reveal text-hp-purple">
              VISIT
            </Eyebrow>
            <h2 id="visit-title" className="hp-h2 hp-reveal mt-4">
              下一站，
              <br />
              大新店森林匹克球。
            </h2>

            <dl className="hp-reveal mt-10 border-t-[1.5px] border-hp-ink/80">
              {shown.map((r) => (
                <div key={r.k} className="grid gap-1 border-b border-hp-ink/15 py-4 sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <dt className="text-sm font-semibold text-hp-ink/60">{r.k}</dt>
                  <dd className="font-semibold">{r.v ?? <Pending />}</dd>
                </div>
              ))}
            </dl>
            {missingCore && !SHOW_PENDING && (
              <p className="mt-4 text-sm text-hp-ink/70">詳細地址與交通方式整理中，將盡快公布。</p>
            )}

            {(navHref || contactLink || SHOW_PENDING) && (
              <div className="hp-reveal mt-8 flex flex-wrap items-center gap-3">
                {navHref ? (
                  <a href={navHref} target="_blank" rel="noopener noreferrer" className="hp-btn hp-btn-primary">
                    開啟導航
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </a>
                ) : (
                  <Pending>「開啟導航」待補地址或地圖連結</Pending>
                )}
                {contactLink ? (
                  <a
                    href={contactLink.href}
                    {...(contactLink.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="hp-btn hp-btn-outline"
                  >
                    {contactLink.label}
                  </a>
                ) : (
                  <Pending>「聯絡我們」待補電話或 LINE</Pending>
                )}
              </div>
            )}
          </div>
        </div>

        {contact.mapEmbedUrl ? (
          <div className="hp-reveal mt-14 overflow-hidden rounded-[var(--hp-radius-lg)]">
            <iframe
              src={contact.mapEmbedUrl}
              title={`${brand.name} 地圖`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[22rem] w-full border-0"
            />
          </div>
        ) : (
          SHOW_PENDING && (
            <div className="mt-14 grid h-48 place-items-center rounded-[var(--hp-radius-lg)] border-[1.5px] border-dashed border-hp-ink/30 text-center text-sm text-hp-ink/60">
              <p>
                地圖待補
                <br />
                提供 Google 地圖嵌入網址後，這裡會顯示地圖
              </p>
            </div>
          )
        )}
      </div>
    </section>
  )
}

/* ================================================================
 * 底部預約邀請：深紫底、大字，右側只露出部分場館照片
 * ================================================================ */
export function InviteSection() {
  return (
    <section id="invite" aria-labelledby="invite-title" className="hp-on-dark relative isolate overflow-hidden bg-hp-deep text-white">
      <div className="lg:grid lg:min-h-[34rem] lg:grid-cols-12">
        <div className="relative h-56 overflow-hidden sm:h-72 lg:order-2 lg:col-span-4 lg:col-start-9 lg:h-auto">
          <Image
            src={images.hero.src}
            alt=""
            fill
            sizes="(min-width: 1024px) 34vw, 100vw"
            className="origin-[85%_10%] scale-[1.35] object-cover object-[85%_20%]"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-hp-deep via-transparent to-transparent lg:bg-gradient-to-r lg:via-transparent" />
        </div>
        <div className="relative px-[var(--hp-gutter)] py-16 lg:col-span-8 lg:flex lg:flex-col lg:justify-center lg:py-24">
          <CourtLines className="absolute right-0 top-1/2 hidden h-[26rem] w-[12rem] -translate-y-1/2 rotate-90 text-white/[0.08] lg:block" />
          <div className="relative mx-auto w-full max-w-[52rem] lg:mx-0 lg:ml-auto lg:mr-12">
            <h2 id="invite-title" className="hp-display hp-reveal">
              下一場，
              <br />
              約在森林裡。
            </h2>
            <p className="hp-lead hp-reveal mt-6 max-w-[30rem] text-white/85 [--hp-delay:80ms]">
              帶上想動一動的心情，來一場屬於你的匹克球時光。
            </p>
            <div className="hp-reveal mt-9 flex flex-wrap gap-3 [--hp-delay:160ms]">
              <Link href="/booking" className="hp-btn hp-btn-primary">
                預約開打
              </Link>
              <Link href="/sessions" className="hp-btn hp-btn-outline-light">
                看看近期活動
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ================================================================
 * 頁尾：官方 logo 放在與 logo 原檔同色的底塊上，延伸到邊緣，不會出現框線
 * ================================================================ */
const FOOTER_EXPLORE = [
  { href: '/booking', label: '場地預約' },
  { href: '/sessions', label: '活動與球友集合' },
  { href: '/#coaching', label: '課程體驗' },
  { href: '/#story', label: '關於我們' },
  { href: '/#visit', label: '交通資訊' },
]
const FOOTER_MEMBER = [
  { href: '/account', label: '會員中心' },
  { href: '/bookings', label: '我的預約' },
  { href: '/cart', label: '購物車' },
]

function FooterList({ title, items }: { title: string; items: { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-white/60">{title}</h3>
      <ul className="mt-4 space-y-1">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="hp-focus inline-flex min-h-10 items-center rounded text-[0.95rem] hover:text-hp-lilac hover:underline">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function HomeFooter({ data }: { data: HomeData }) {
  const year = new Date().getFullYear()
  const address = data.venue?.address
  const phone = data.venue?.phone
  const contactItems = [
    address && { label: address },
    phone && { label: phone, href: telHref(phone) },
    contact.email && { label: contact.email, href: `mailto:${contact.email}` },
    contact.lineUrl && { label: 'LINE 官方帳號', href: contact.lineUrl },
  ].filter(Boolean) as { label: string; href?: string }[]
  const legalLinks = [
    legal.termsUrl && { href: legal.termsUrl, label: '服務條款' },
    legal.privacyUrl && { href: legal.privacyUrl, label: '隱私權政策' },
  ].filter(Boolean) as { href: string; label: string }[]

  return (
    <footer id="site-footer" className="hp-on-dark bg-hp-deep text-white">
      <div className="lg:grid lg:grid-cols-12">
        <div className="flex items-center justify-center bg-hp-logo px-8 py-12 lg:col-span-4 lg:py-16">
          <Image
            src={images.logo.src}
            alt={images.logo.alt}
            width={images.logo.width}
            height={images.logo.height}
            sizes="(min-width: 1024px) 26vw, 80vw"
            className="h-auto w-full max-w-[22rem]"
          />
        </div>

        <div className="px-[var(--hp-gutter)] py-12 lg:col-span-8 lg:px-14 lg:py-16">
          <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-4">
            <FooterList title="探索" items={FOOTER_EXPLORE} />
            <FooterList title="會員" items={FOOTER_MEMBER} />
            <div>
              <h3 className="text-sm font-bold text-white/60">聯絡我們</h3>
              <ul className="mt-4 space-y-2 text-[0.95rem]">
                {contactItems.length > 0
                  ? contactItems.map((c) => (
                      <li key={c.label}>
                        {c.href ? (
                          <a href={c.href} className="hp-link">
                            {c.label}
                          </a>
                        ) : (
                          c.label
                        )}
                      </li>
                    ))
                  : SHOW_PENDING && (
                      <li>
                        <Pending>電話、LINE、Email 待補</Pending>
                      </li>
                    )}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white/60">社群</h3>
              <ul className="mt-4 space-y-2 text-[0.95rem]">
                {social.length > 0
                  ? social.map((s) => (
                      <li key={s.href}>
                        <a href={s.href} target="_blank" rel="noopener noreferrer" className="hp-link">
                          {s.label}
                        </a>
                      </li>
                    ))
                  : SHOW_PENDING && (
                      <li>
                        <Pending>社群連結待補</Pending>
                      </li>
                    )}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-white/15 pt-6 text-sm text-white/65 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p>
              © {year} {brand.name}
              {legal.company && `・${legal.company}`}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {legalLinks.map((l) => (
                <a key={l.href} href={l.href} className="hp-link">
                  {l.label}
                </a>
              ))}
              {legalLinks.length === 0 && <Pending>服務條款與隱私權政策待補</Pending>}
            </div>
          </div>
          {HOME_IMAGES_HAVE_CONCEPT && (
            <p className="mt-4 text-xs text-white/50">網站部分圖片為情境示意，實際場地以現場為準。</p>
          )}
        </div>
      </div>
    </footer>
  )
}
