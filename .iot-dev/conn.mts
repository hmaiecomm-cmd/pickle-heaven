import { readFileSync } from 'node:fs'
import { PlatformClient } from '../edge/simulator/src/harness'

const s = JSON.parse(readFileSync(new URL('./secrets.json', import.meta.url), 'utf8'))
const p = new PlatformClient('http://127.0.0.1:8787', s.platformSecret)
const site = process.argv[2] ?? 'cloudtest-sim'
const c = await p.get(`/internal/v1/sites/${site}/connection`)
console.log(JSON.stringify({ online: c.online, ip: c.ip, simulated: c.simulated, ipHistory: c.ipHistory, heartbeats: c.heartbeats.slice(0, 4).map((h: any) => ({ at: h.at, ip: h.ip, gapMs: h.gapMs })) }, null, 1))
