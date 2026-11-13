/**
 * 由目前畫面產生截圖（PNG）並下載。Demo Mode 一律加上「示範影像」浮水印，避免被當成真實錄影。
 * 呼叫前必須先通過伺服器端的權限檢查（snapshotAction）。
 */
export async function downloadSnapshot(opts: { title: string; imageSrc: string | null; objectPosition?: string; stamp: string; fileName: string }) {
  const W = 1280
  const H = 720
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('瀏覽器不支援截圖')

  ctx.fillStyle = '#1d2620'
  ctx.fillRect(0, 0, W, H)
  if (opts.imageSrc) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('無法載入畫面'))
      i.src = opts.imageSrc!
    })
    // object-fit: cover 加上取景位置
    const scale = Math.max(W / img.width, H / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    const [px, py] = (opts.objectPosition ?? '50% 50%').split(' ').map((v) => parseFloat(v) / 100)
    ctx.drawImage(img, (W - dw) * (px || 0.5), (H - dh) * (py || 0.5), dw, dh)
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = '600 32px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('尚未連線・無影像', W / 2, H / 2)
    ctx.textAlign = 'left'
  }

  const grad = ctx.createLinearGradient(0, H - 130, 0, H)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.75)')
  ctx.fillStyle = grad
  ctx.fillRect(0, H - 130, W, 130)
  ctx.fillStyle = '#fff'
  ctx.font = '600 30px system-ui, sans-serif'
  ctx.fillText(opts.title, 28, H - 58)
  ctx.font = '22px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText(`示範影像・Demo Mode・非真實錄影｜${opts.stamp}`, 28, H - 24)

  ctx.fillStyle = 'rgba(251,191,36,0.95)'
  ctx.fillRect(24, 22, 150, 44)
  ctx.fillStyle = '#451a03'
  ctx.font = '700 24px system-ui, sans-serif'
  ctx.fillText('示範影像', 48, 52)

  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = opts.fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function toggleFullscreen(el: HTMLElement | null) {
  if (!el) return
  if (document.fullscreenElement) void document.exitFullscreen()
  else void el.requestFullscreen?.()
}

export const nowStamp = () => new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
