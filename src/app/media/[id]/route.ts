import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * 公開讀取上傳的圖片。內容依雜湊去重、上傳後不再變動，因此可長效快取。
 * ?size=thumb 取縮圖（卡片用）。
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new Response('Not found', { status: 404 })
  const thumb = new URL(req.url).searchParams.get('size') === 'thumb'

  const asset = thumb
    ? await prisma.mediaAsset.findUnique({ where: { id }, select: { thumbBytes: true, mime: true } }).then((a) => a && { data: a.thumbBytes, mime: a.mime })
    : await prisma.mediaAsset.findUnique({ where: { id }, select: { bytes: true, mime: true } }).then((a) => a && { data: a.bytes, mime: a.mime })
  if (!asset) return new Response('Not found', { status: 404 })

  const data = asset.data
  return new Response(Buffer.from(data), {
    headers: {
      'Content-Type': asset.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
