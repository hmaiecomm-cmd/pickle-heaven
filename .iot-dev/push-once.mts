import { readFileSync } from 'node:fs'
const read = (f: string) => Object.fromEntries(readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const env = { ...read('.env.local'), ...read('.env.development.local') }
for (const k of ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'IOT_GATEWAY_URL', 'IOT_PLATFORM_SECRET', 'IOT_WEBHOOK_SECRET', 'SLOT_PASSWORD_SECRET']) if (env[k]) process.env[k] = env[k]
if (!process.env.TURSO_DATABASE_URL?.includes('-dev-')) throw new Error('not dev db')
const { prisma } = await import('@/lib/db')
const { pushSitePlan } = await import('@/server/iot/sync')
const v = await prisma.venue.findFirst({ where: { siteCode: { not: null } } })
console.log(await pushSitePlan(v!.id))
