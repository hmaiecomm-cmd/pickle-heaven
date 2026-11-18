import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * 前台頁面預覽 API
 * GET /api/preview/HOMEPAGE?mode=desktop
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ pageType: string }> }
) {
  try {
    const { pageType } = await params
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'desktop'

    // 獲取頁面配置（待 Prisma Client 更新）
    const config = null

    // 獲取活躍內容
    const banners = await prisma.marketingBanner.findMany({
      where: {
        active: true,
        deletedAt: null,
        displayPages: { in: [pageType, 'ALL'] },
      },
      take: 3,
    })

    const promotionCards = await prisma.promotionCard.findMany({
      where: {
        active: true,
        deletedAt: null,
        displayPages: { in: [pageType, 'ALL'] },
      },
      take: 6,
    })

    const announcements = await prisma.announcement.findMany({
      where: {
        active: true,
        deletedAt: null,
        displayPages: { in: [pageType, 'ALL'] },
      },
      take: 3,
    })

    // 生成 HTML 預覽
    const html = generatePreviewHTML(
      {
        pageType,
        config,
        banners,
        promotionCards,
        announcements,
      },
      mode as 'desktop' | 'tablet' | 'mobile'
    )

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('[preview] 錯誤:', error)
    return new NextResponse('無法生成預覽', { status: 500 })
  }
}

function generatePreviewHTML(
  data: any,
  mode: 'desktop' | 'tablet' | 'mobile'
) {
  const widthClass =
    mode === 'desktop'
      ? 'max-w-full'
      : mode === 'tablet'
        ? 'max-w-2xl'
        : 'max-w-sm'

  return `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.pageType} 預覽</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #f3f4f6;
          padding: 20px;
        }
        .container {
          ${widthClass} margin: 0 auto;
          background: white;
        }
        .banner {
          width: 100%;
          height: 300px;
          background: linear-gradient(135deg, #2f7d3b 0%, #1f4d2b 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin-bottom: 20px;
          border-radius: 8px;
        }
        .section {
          padding: 20px;
          margin-bottom: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 15px;
          color: #1f2937;
        }
        .card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 15px;
        }
        .card {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
        }
        .card-image {
          width: 100%;
          height: 150px;
          background: #d1d5db;
          border-radius: 4px;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          font-size: 12px;
        }
        .announcement {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin-bottom: 10px;
          border-radius: 4px;
        }
        .footer {
          padding: 20px;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
          border-top: 1px solid #e5e7eb;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- 橫幕 -->
        ${
          data.banners.length > 0
            ? `<div class="banner">
            <div style="text-align: center;">
              <h2>${data.banners[0].title}</h2>
              <p style="font-size: 14px; margin-top: 10px; opacity: 0.9;">${data.banners[0].subtitle || '行銷橫幕'}</p>
            </div>
          </div>`
            : '<div class="banner"><p>行銷橫幕區域</p></div>'
        }

        <!-- 公告 -->
        ${
          data.announcements.length > 0
            ? `<div class="section">
            <div class="section-title">🔔 重要公告</div>
            ${data.announcements.map((a: any) => `<div class="announcement">${a.title}</div>`).join('')}
          </div>`
            : ''
        }

        <!-- 宣傳卡片 -->
        ${
          data.promotionCards.length > 0
            ? `<div class="section">
            <div class="section-title">✨ 推廣內容</div>
            <div class="card-grid">
              ${data.promotionCards
                .map(
                  (c: any) => `
                <div class="card">
                  <div class="card-image">圖片</div>
                  <strong>${c.title}</strong>
                  <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">${c.description || '卡片描述'}</p>
                </div>
              `
                )
                .join('')}
            </div>
          </div>`
            : ''
        }

        <!-- 活動區域 -->
        <div class="section">
          <div class="section-title">🎯 活動推薦</div>
          <div class="card-grid">
            <div class="card">
              <div class="card-image">活動圖片</div>
              <strong>活動 1</strong>
              <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">活動描述</p>
            </div>
            <div class="card">
              <div class="card-image">活動圖片</div>
              <strong>活動 2</strong>
              <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">活動描述</p>
            </div>
            <div class="card">
              <div class="card-image">活動圖片</div>
              <strong>活動 3</strong>
              <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">活動描述</p>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>✓ 使用真實資料預覽</p>
          <p style="margin-top: 10px; font-size: 11px; opacity: 0.7;">預覽模式：${mode === 'mobile' ? '📱 手機版' : mode === 'tablet' ? '📱 平板版' : '🖥️ 桌面版'}</p>
        </div>
      </div>
    </body>
    </html>
  `
}
