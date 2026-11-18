/**
 * 首頁行銷橫幕顯示組件
 * 在前台首頁展示活躍的行銷橫幕
 */

interface Banner {
  id: string
  title: string
  subtitle?: string | null
  imageAssetId?: string | null
  buttonText?: string | null
  buttonUrl?: string | null
}

export async function HomepageBanners() {
  // TODO: 連接到 API 或直接查詢數據庫
  // const banners = await fetchActiveBanners('HOMEPAGE')

  // 暫時返回空，等待後端實裝
  return (
    <div className="bg-white">
      {/* 橫幕區域 */}
      <div className="mx-auto max-w-screen-xl px-4 py-8">
        {/* 動態載入橫幕 */}
      </div>
    </div>
  )
}

/**
 * 首頁促銷卡片
 */
export async function PromotionCardsSection() {
  // TODO: 連接到 API 或直接查詢數據庫
  // const cards = await fetchActivePromotionCards('HOMEPAGE')

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto max-w-screen-xl px-4 py-8">
        {/* 動態載入宣傳卡片 */}
      </div>
    </div>
  )
}

/**
 * 首頁公告
 */
export async function HomepageAnnouncements() {
  // TODO: 連接到 API 或直接查詢數據庫
  // const announcements = await fetchActiveAnnouncements('HOMEPAGE')

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-screen-xl px-4 py-4">
        {/* 動態載入公告 */}
      </div>
    </div>
  )
}
