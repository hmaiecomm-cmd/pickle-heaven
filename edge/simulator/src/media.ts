import { spawn, type ChildProcess } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CLIP_MAX_SECONDS, NVR_RETENTION_DAYS, type CameraDef, type MediaQuality, type NvrIndex, type NvrRecording } from '../../../packages/iot-contract/src/index'

/**
 * 模擬 NVR／IPCAM（6 支攝影機）：
 * - 即時：ffmpeg 即時產生測試畫面（攝影機名稱、台北時間、球場燈／預約／有人），切成 HLS 片段逐片上傳
 * - 錄影：NVR 保存 14 天（連續錄影＋位移事件，索引由種子決定，每次查詢結果一致），調閱時才用 ffmpeg 產生該時段畫面
 *
 * 實體 NVR 的做法相同：從 NVR 取 RTSP／錄影檔 → 轉成 HLS（H.264 / MPEG-TS）→ 依協定上傳。
 */

export const DEFAULT_SIM_CAMERAS: CameraDef[] = [
  { id: '01', name: 'Door outside' },
  { id: '02', name: 'Door inside' },
  { id: '03', name: 'Lounge' },
  { id: '04', name: 'Court A', court: 'A' },
  { id: '05', name: 'Pro Shop' },
  { id: '06', name: 'Court B', court: 'B' },
]

export function findFfmpeg(): string | null {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH
  const base = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Packages')
  try {
    for (const pkg of readdirSync(base).filter((d) => d.startsWith('Gyan.FFmpeg'))) {
      for (const build of readdirSync(join(base, pkg))) {
        const exe = join(base, pkg, build, 'bin', 'ffmpeg.exe')
        if (existsSync(exe)) return exe
      }
    }
  } catch {}
  return 'ffmpeg' // 交給 PATH；找不到會在啟動時報錯
}

const QUALITY: Record<MediaQuality, { size: string; rate: number; bitrate: string }> = {
  low: { size: '640x360', rate: 10, bitrate: '300k' },
  high: { size: '1280x720', rate: 15, bitrate: '1200k' },
}
const SEGMENT_SEC = 2

export interface Uploader {
  /** PUT /edge/v1/media/{session}/segments/{seq}?dur= */
  segment(session: string, seq: number, dur: number, data: Uint8Array): Promise<void>
  /** POST /edge/v1/media/{session}/end */
  end(session: string, segments: number, reason?: string): Promise<void>
}

/** 給畫面疊字用：每支攝影機目前的現場狀況 */
export type SceneFn = (camera: CameraDef) => string

interface Job {
  session: string
  camera: string
  kind: 'live' | 'clip'
  proc: ChildProcess | null
  dir: string
  uploaded: Set<string>
  seq: number
  until: number
  startedAt: number
  bytes: number
  ended: boolean
  error: string | null
  scene?: NodeJS.Timeout
  poll?: NodeJS.Timeout
}

export class MediaEngine {
  readonly jobs = new Map<string, Job>()
  readonly history: { session: string; camera: string; kind: 'live' | 'clip'; startedAt: number; endedAt: number; segments: number; bytes: number; reason: string }[] = []
  private root: string
  private font: string

  constructor(
    private readonly opts: {
      ffmpeg: string
      uploader: Uploader
      cameras: () => CameraDef[]
      scene: SceneFn
      now: () => number
      log?: (m: string) => void
    },
  ) {
    this.root = join(tmpdir(), `gh-sim-media-${process.pid}`)
    mkdirSync(this.root, { recursive: true })
    // drawtext 的 fontfile 路徑含「C:」在 Windows 很難跳脫，複製一份到工作目錄用相對路徑
    this.font = join(this.root, 'font.ttf')
    for (const f of ['C:/Windows/Fonts/consola.ttf', 'C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', '/usr/share/fonts/dejavu/DejaVuSansMono.ttf']) {
      if (existsSync(f)) {
        copyFileSync(f, this.font)
        break
      }
    }
  }

  private camera(id: string) {
    return this.opts.cameras().find((c) => c.id === id) ?? { id, name: `Camera ${id}` }
  }

  private args(job: Job, cam: CameraDef, startEpochSec: number, quality: MediaQuality, seconds: number, realtime: boolean) {
    const q = QUALITY[quality]
    // 疊字：台北時間（pts 由起點往上加）＋現場狀況（每秒更新的檔案）
    // 疊字字型只有英數，中文名稱改用球場／編號
    const label = /^[\x20-\x7e]*$/.test(cam.name) ? cam.name : cam.court ? `Court ${cam.court}` : `Camera ${cam.id}`
    writeFileSync(join(job.dir, 'title.txt'), `CAM${cam.id} ${label}  %{pts:gmtime:${Math.floor(startEpochSec + 8 * 3600)}}  ${job.kind === 'live' ? 'LIVE' : 'NVR'}`)
    writeFileSync(join(job.dir, 'scene.txt'), this.opts.scene(cam))
    const hasFont = existsSync(this.font)
    if (hasFont) copyFileSync(this.font, join(job.dir, 'font.ttf'))
    const font = hasFont ? 'fontfile=font.ttf:' : ''
    const vf = [
      `drawtext=${font}textfile=title.txt:x=12:y=12:fontsize=${quality === 'high' ? 30 : 20}:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6`,
      `drawtext=${font}textfile=scene.txt:reload=1:x=12:y=h-th-14:fontsize=${quality === 'high' ? 28 : 18}:fontcolor=yellow:box=1:boxcolor=black@0.6:boxborderw=6`,
    ].join(',')
    return [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      ...(realtime ? ['-re'] : []),
      '-f',
      'lavfi',
      '-i',
      `testsrc2=size=${q.size}:rate=${q.rate}`,
      '-t',
      String(seconds),
      '-vf',
      vf,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-tune',
      'zerolatency',
      '-pix_fmt',
      'yuv420p',
      '-g',
      String(q.rate * SEGMENT_SEC),
      '-keyint_min',
      String(q.rate * SEGMENT_SEC),
      '-sc_threshold',
      '0',
      '-b:v',
      q.bitrate,
      '-f',
      'hls',
      '-hls_time',
      String(SEGMENT_SEC),
      '-hls_list_size',
      '0',
      '-hls_segment_filename',
      'seg%d.ts',
      'index.m3u8',
    ]
  }

  /** 讀 ffmpeg 產生的播放清單，上傳還沒上傳過的完整片段 */
  private async flush(job: Job, final: boolean) {
    const m3u8 = join(job.dir, 'index.m3u8')
    if (!existsSync(m3u8)) return
    const lines = readFileSync(m3u8, 'utf8').split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^#EXTINF:([\d.]+)/)
      if (!m) continue
      const file = lines[i + 1]?.trim()
      if (!file || job.uploaded.has(file)) continue
      const data = readFileSync(join(job.dir, file))
      job.uploaded.add(file)
      const seq = job.seq++
      try {
        await this.opts.uploader.segment(job.session, seq, Number(m[1]), data)
        job.bytes += data.length
      } catch (e) {
        const msg = (e as Error).message
        // 雲端說結束了（camera.stop 或逾時）就停
        if (/MEDIA_ENDED|409/.test(msg)) {
          await this.finish(job, 'CLOUD_ENDED', false)
          return
        }
        job.error = msg
        this.opts.log?.(`[media] ${job.session} #${seq} 上傳失敗：${msg}`)
      }
    }
    void final
  }

  private async finish(job: Job, reason: string, notify = true) {
    if (job.ended) return
    job.ended = true
    clearInterval(job.scene)
    clearInterval(job.poll)
    job.proc?.kill('SIGKILL')
    if (notify) await this.opts.uploader.end(job.session, job.seq, reason).catch((e) => (job.error = (e as Error).message))
    this.jobs.delete(job.session)
    this.history.unshift({ session: job.session, camera: job.camera, kind: job.kind, startedAt: job.startedAt, endedAt: Date.now(), segments: job.seq, bytes: job.bytes, reason })
    if (this.history.length > 50) this.history.length = 50
    setTimeout(() => rmSync(job.dir, { recursive: true, force: true }), 30_000).unref?.()
  }

  /** camera.live：開始或延長 */
  live(cameraId: string, session: string, seconds: number, quality: MediaQuality = 'low') {
    const existing = this.jobs.get(session)
    if (existing && !existing.ended) {
      existing.until = Date.now() + seconds * 1000
      return { extended: true }
    }
    const cam = this.camera(cameraId)
    const dir = join(this.root, session)
    mkdirSync(dir, { recursive: true })
    const job: Job = { session, camera: cam.id, kind: 'live', proc: null, dir, uploaded: new Set(), seq: 0, until: Date.now() + seconds * 1000, startedAt: Date.now(), bytes: 0, ended: false, error: null }
    // ffmpeg 產生最長上限的長度，實際由 until 決定何時停（才能延長）
    const args = this.args(job, cam, this.opts.now() / 1000, quality, 3600, true)
    job.proc = spawn(this.opts.ffmpeg, args, { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
    job.proc.stderr?.on('data', (d) => (job.error = String(d).trim().slice(0, 300)))
    job.proc.on('error', (e) => {
      job.error = `ffmpeg 無法啟動：${e.message}`
      void this.finish(job, 'FFMPEG_ERROR')
    })
    job.scene = setInterval(() => writeFileSync(join(dir, 'scene.txt'), this.opts.scene(cam)), 1_000)
    let busy = false
    job.poll = setInterval(async () => {
      if (busy) return
      busy = true
      try {
        await this.flush(job, false)
        if (!job.ended && Date.now() > job.until) await this.finish(job, 'TIMEOUT')
      } finally {
        busy = false
      }
    }, 500)
    this.jobs.set(session, job)
    return { extended: false }
  }

  stop(session: string) {
    const job = this.jobs.get(session)
    if (!job) return false
    void this.finish(job, 'STOPPED', false)
    return true
  }

  /** nvr.clip：產生指定時段的畫面並上傳（非即時，產生完逐片送出） */
  async clip(cameraId: string, session: string, from: string, to: string, quality: MediaQuality = 'low') {
    const start = Date.parse(from)
    const end = Date.parse(to)
    const oldest = this.opts.now() - NVR_RETENTION_DAYS * 86_400_000
    if (start < oldest) throw new Error(`超出 NVR 保存範圍（只保存 ${NVR_RETENTION_DAYS} 天）`)
    if (end > this.opts.now() + 5_000) throw new Error('不能調閱未來的時間')
    const seconds = Math.min(CLIP_MAX_SECONDS, Math.max(1, Math.round((end - start) / 1000)))
    const cam = this.camera(cameraId)
    const dir = join(this.root, session)
    mkdirSync(dir, { recursive: true })
    const job: Job = { session, camera: cam.id, kind: 'clip', proc: null, dir, uploaded: new Set(), seq: 0, until: 0, startedAt: Date.now(), bytes: 0, ended: false, error: null }
    this.jobs.set(session, job)
    const args = this.args(job, cam, start / 1000, quality, seconds, false)
    writeFileSync(join(dir, 'scene.txt'), `RECORDED  ${new Date(start + 8 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')} - ${new Date(end + 8 * 3600_000).toISOString().slice(11, 16)}`)
    void (async () => {
      const code = await new Promise<number>((resolve) => {
        job.proc = spawn(this.opts.ffmpeg, args, { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
        job.proc.stderr?.on('data', (d) => (job.error = String(d).trim().slice(0, 300)))
        job.proc.on('error', (e) => {
          job.error = `ffmpeg 無法啟動：${e.message}`
          resolve(-1)
        })
        job.proc.on('exit', (c) => resolve(c ?? -1))
      })
      if (code !== 0) return this.finish(job, `FAILED: ${job.error ?? `ffmpeg exit ${code}`}`)
      job.proc = null
      await this.flush(job, true)
      await this.finish(job, 'COMPLETED')
    })()
  }

  /** nvr.index：14 天的錄影索引（連續錄影每小時一段＋位移事件）。依日期與攝影機決定，每次結果相同 */
  index(cameras: string[] | undefined, from: string, to: string): NvrIndex {
    const now = this.opts.now()
    const oldest = Math.floor((now - NVR_RETENTION_DAYS * 86_400_000) / 3_600_000) * 3_600_000
    const lo = Math.max(Date.parse(from), oldest)
    const hi = Math.min(Date.parse(to), now)
    const ids = cameras?.length ? cameras : this.opts.cameras().map((c) => c.id)
    const recordings: NvrRecording[] = []
    const kbps = 300
    for (const cam of ids) {
      for (let h = Math.floor(lo / 3_600_000) * 3_600_000; h < hi; h += 3_600_000) {
        const s = Math.max(h, lo)
        const e = Math.min(h + 3_600_000, hi)
        if (e <= s) continue
        recordings.push({ camera: cam, start: new Date(s).toISOString(), end: new Date(e).toISOString(), kind: 'continuous', bytes: Math.round(((e - s) / 1000) * kbps * 125) })
        // 位移事件：營業時間（台北 08–22）內，每小時 0–2 段、各 1–4 分鐘
        const taipeiHour = new Date(h + 8 * 3600_000).getUTCHours()
        if (taipeiHour < 8 || taipeiHour >= 22) continue
        const seed = hash(`${cam}:${h}`)
        for (let k = 0; k < seed % 3; k++) {
          const ms = h + ((seed >>> (4 + k * 6)) % 55) * 60_000
          const len = (1 + ((seed >>> (10 + k * 5)) % 4)) * 60_000
          if (ms >= lo && ms + len <= hi) recordings.push({ camera: cam, start: new Date(ms).toISOString(), end: new Date(ms + len).toISOString(), kind: 'motion', bytes: Math.round((len / 1000) * kbps * 125) })
        }
      }
    }
    recordings.sort((a, b) => a.start.localeCompare(b.start) || a.camera.localeCompare(b.camera))
    const used = recordings.filter((r) => r.kind === 'continuous').reduce((n, r) => n + (r.bytes ?? 0), 0)
    return { from: new Date(lo).toISOString(), to: new Date(hi).toISOString(), oldest: new Date(oldest).toISOString(), recordings, disk: { usedBytes: used, totalBytes: 4 * 1024 ** 4 } }
  }

  summary() {
    return {
      active: [...this.jobs.values()].map((j) => ({ session: j.session, camera: j.camera, kind: j.kind, segments: j.seq, bytes: j.bytes, untilSec: j.kind === 'live' ? Math.max(0, Math.round((j.until - Date.now()) / 1000)) : null, error: j.error })),
      history: this.history.slice(0, 20),
    }
  }

  /** 本機預覽：模擬器網頁直接播 ffmpeg 產生的檔案 */
  localFile(session: string, file: string): Buffer | null {
    const job = this.jobs.get(session)
    if (!job || !/^(index\.m3u8|seg\d+\.ts)$/.test(file)) return null
    const p = join(job.dir, file)
    return existsSync(p) ? readFileSync(p) : null
  }

  stopAll() {
    for (const j of this.jobs.values()) void this.finish(j, 'SHUTDOWN', false)
  }
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
