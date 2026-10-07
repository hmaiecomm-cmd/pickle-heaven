import type { Metadata } from 'next'
import { brand, images, SITE_URL } from '@/config/site'
import { getHomeData } from '@/server/home-data'
import { displayFont } from '@/components/home/fonts'
import { MobileBookingBar } from '@/components/home/mobile-cta'
import { RevealRoot } from '@/components/home/reveal-root'
import {
  CoachingSection,
  HeroSection,
  HomeFooter,
  InviteSection,
  PlansSection,
  StorySection,
  VisitSection,
} from '@/components/home/sections'
import '@/components/home/home.css'

// 場次、費率即時讀資料庫
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: `${brand.name}｜${brand.englishName}` },
  description: brand.description,
  alternates: { canonical: '/' },
  openGraph: {
    title: `${brand.name}｜${brand.tagline}`,
    description: brand.description,
    url: '/',
    siteName: brand.name,
    locale: 'zh_TW',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: images.logo.alt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${brand.name}｜${brand.tagline}`,
    description: brand.description,
    images: ['/og-image.jpg'],
  },
}

export default async function HomePage() {
  const data = await getHomeData()

  // 結構化資料：只放已確認的欄位
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: brand.name,
    alternateName: brand.englishName,
    description: brand.description,
    url: SITE_URL,
    logo: `${SITE_URL}${images.logo.src}`,
    image: `${SITE_URL}${images.logo.src}`,
    ...(data.venue?.address ? { address: data.venue.address } : {}),
    ...(data.venue?.phone ? { telephone: data.venue.phone } : {}),
  }

  return (
    <RevealRoot className={`hp-page ${displayFont.variable} min-h-dvh`}>
      <a
        href="#play"
        className="sr-only z-[60] rounded-full bg-hp-purple px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        跳到主要內容
      </a>
      <main>
        <HeroSection data={data} />
        <PlansSection data={data} />
        <CoachingSection data={data} />
        <StorySection />
        <VisitSection data={data} />
        <InviteSection />
      </main>
      <HomeFooter data={data} />
      <MobileBookingBar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </RevealRoot>
  )
}
