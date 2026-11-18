import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { pagePermission, getAdminContext } from '@/lib/admin-auth'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'
import { prisma } from '@/lib/db'
import { getLineAccountStatus } from '@/lib/line'
import { ACTIVITY_TYPE_LABEL, type ActivityTypeKey } from '@/lib/activity-shared'
import { MarketingOverviewCards } from './marketing-overview-cards'
import { ActivityManagementSection } from './activity-management-section'
import { MarketingContentBoard } from './marketing-content-board'
import { can } from '@/lib/admin-permissions'
import type { MarketingItem } from '@/lib/marketing-content'
import { PageManagementSection } from './page-management-section'
import { MarketingToolsSection } from './marketing-tools-section'

export const metadata: Metadata = { title: '活動與行銷設計' }
export const dynamic = 'force-dynamic'

export default async function MarketingPage() {
  if ((await pagePermission('activities')) === 'forbidden') return <Forbidden />
  const ctx = await getAdminContext()
  if (!ctx) return null

  // 获取活动统计数据、行销内容、页面配置和 LINE 设置
  const [activities, totalRegistrations, banners, promotionCards, announcements, pageConfigs, lineSettings] = await Promise.all([
    prisma.activity.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        coverAssetId: true,
        price: true,
        priceUnit: true,
        capacity: true,
        seriesStartDate: true,
        seriesEndDate: true,
        sessions: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sessionRegistration.aggregate({
      _count: true,
      where: { cancelledAt: null },
    }),
    prisma.marketingBanner.findMany({
      where: { deletedAt: null, ...(ctx.venueId ? { venueId: ctx.venueId } : {}) },
      orderBy: [{ updatedAt: 'desc' }],
    }),
    prisma.promotionCard.findMany({
      where: { deletedAt: null, ...(ctx.venueId ? { venueId: ctx.venueId } : {}) },
      orderBy: [{ updatedAt: 'desc' }],
    }),
    prisma.announcement.findMany({
      where: { deletedAt: null, ...(ctx.venueId ? { venueId: ctx.venueId } : {}) },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    }),
    // 页面配置查询将在重新生成 Prisma Client 后可用
    Promise.resolve([] as any[]),
    getLineAccountStatus(),
  ])

  // 整理活动统计
  const activityStats = {
    draft: activities.filter((a: { status: string }) => a.status === 'DRAFT').length,
    published: activities.filter((a: { status: string }) => a.status === 'PUBLISHED').length,
    ended: activities.filter((a: { status: string }) => a.status === 'ARCHIVED').length,
    total: activities.length,
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="活動與行銷設計"
        desc="管理前台活動與行銷內容"
        right={
          <Link
            href="/admin/marketing/activities/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            新增活動
          </Link>
        }
      />

      {/* 行銷總覽 */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-700">行銷總覽</h2>
        <MarketingOverviewCards stats={activityStats} totalRegistrations={totalRegistrations._count} />
      </section>

      {/* 活動管理 */}
      <section id="activities" className="scroll-mt-4">
        <h2 className="mb-4 text-sm font-semibold text-zinc-700">活動管理</h2>
        <ActivityManagementSection activities={activities} />
        <SourceNote source="活動資料表" basis="已發布與草稿活動" updatedAt={new Date()} className="mt-3" />
      </section>

      {/* 前台行銷設計：橫幅、宣傳卡片、公告（右側面板新增與編輯） */}
      <MarketingContentBoard
        banners={banners.map((b) => toItem({ ...b, description: b.subtitle, content: null }))}
        cards={promotionCards.map((c) => toItem({ ...c, content: null }))}
        announcements={announcements.map((a) => toItem({ ...a, description: null, buttonText: null, buttonUrl: null }))}
        canWrite={can(ctx.role, 'marketing')}
      />

      {/* 前台頁面管理 */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-zinc-700">前台頁面方向設定</h2>
          <p className="mt-1 text-xs text-muted">管理首頁、活動頁、會員專區等前台內容</p>
        </div>
        <PageManagementSection pages={pageConfigs} />
      </section>

      {/* 行銷工具 */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-zinc-700">行銷工具</h2>
          <p className="mt-1 text-xs text-muted">LINE 通知設定與推播行銷活動管理</p>
        </div>
        <MarketingToolsSection lineStatus={lineSettings} />
      </section>
    </div>
  )
}

function toItem(r: {
  id: string
  title: string
  description: string | null
  content: string | null
  imageAssetId: string | null
  buttonText: string | null
  buttonUrl: string | null
  startAt: Date | null
  endAt: Date | null
  active: boolean
  updatedAt: Date
}): MarketingItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    content: r.content,
    imageAssetId: r.imageAssetId,
    buttonText: r.buttonText,
    buttonUrl: r.buttonUrl,
    startAt: r.startAt?.toISOString() ?? null,
    endAt: r.endAt?.toISOString() ?? null,
    active: r.active,
    updatedAt: r.updatedAt.toISOString(),
  }
}
