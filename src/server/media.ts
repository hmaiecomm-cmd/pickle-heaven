import 'server-only'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { prisma } from '@/lib/db'

/**
 * 活動封面圖片。
 *
 * 儲存位置：Turso 資料庫的 MediaAsset（壓縮後的 WebP 與縮圖），經 /media/[id] 公開讀取、長效快取。
 * 專案目前沒有其他可公開存取的檔案儲存服務；圖片不會只存在管理者電腦，也不依賴部署時的檔案系統。
 * 同一張原圖重複上傳會沿用同一筆（sha256），更換封面時只刪除「已沒有任何活動或場次使用」的圖片。
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_EDGE = 1600
const THUMB_WIDTH = 640

export class MediaError extends Error {}

export async function storeImage(file: File, actor: string) {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new MediaError('只接受 JPG、PNG、WebP 圖片')
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new MediaError('圖片超過 4 MB，請先縮小再上傳')
  if (file.size < 1024) throw new MediaError('圖片檔案不完整')

  const input = Buffer.from(await file.arrayBuffer())
  const sha256 = createHash('sha256').update(input).digest('hex')
  const existing = await prisma.mediaAsset.findUnique({
    where: { sha256 },
    select: { id: true, width: true, height: true },
  })
  if (existing) return { ...existing, reused: true, warning: sizeWarning(existing.width, existing.height) }

  let meta: sharp.Metadata
  try {
    meta = await sharp(input).metadata()
  } catch {
    throw new MediaError('無法讀取這張圖片，請確認檔案格式')
  }
  if (!meta.width || !meta.height) throw new MediaError('無法讀取圖片尺寸')
  if (meta.width * meta.height > 60_000_000) throw new MediaError('圖片像素過大')

  // rotate() 依 EXIF 轉正並移除 EXIF（含拍攝位置等個資）
  const full = await sharp(input)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true })
  const thumb = await sharp(input)
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer({ resolveWithObject: true })

  const asset = await prisma.mediaAsset.create({
    data: {
      mime: 'image/webp',
      width: full.info.width,
      height: full.info.height,
      sizeBytes: full.data.length,
      bytes: new Uint8Array(full.data),
      thumbBytes: new Uint8Array(thumb.data),
      thumbWidth: thumb.info.width,
      thumbHeight: thumb.info.height,
      sha256,
      originalName: file.name.slice(0, 120) || null,
      createdBy: actor,
    },
    select: { id: true, width: true, height: true },
  })
  await pruneOrphanAssets().catch(() => {})
  return { ...asset, reused: false, warning: sizeWarning(asset.width, asset.height) }
}

function sizeWarning(w: number, h: number): string | null {
  if (w < 1200 || h < 600) return `圖片只有 ${w}×${h}，在大螢幕上可能模糊，建議至少 1600×900`
  return null
}

/** 沒有任何活動或場次使用的圖片才刪除 */
export async function deleteAssetIfUnused(id: string | null | undefined): Promise<boolean> {
  if (!id) return false
  const [a, s] = await Promise.all([
    prisma.activity.count({ where: { coverAssetId: id } }),
    prisma.session.count({ where: { coverAssetId: id } }),
  ])
  if (a + s > 0) return false
  await prisma.mediaAsset.deleteMany({ where: { id } })
  return true
}

/** 上傳後超過一天仍未被使用的圖片（例如上傳後放棄儲存）清除 */
export async function pruneOrphanAssets(): Promise<number> {
  const res = await prisma.mediaAsset.deleteMany({
    where: {
      createdAt: { lt: new Date(Date.now() - 86_400_000) },
      activities: { none: {} },
      sessions: { none: {} },
    },
  })
  return res.count
}
