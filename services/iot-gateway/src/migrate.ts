import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

/** 依檔名順序執行 migrations/*.sql，已執行過的略過 */
const url = process.env.DATABASE_URL
if (!url) throw new Error('缺少 DATABASE_URL')
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
const sql = postgres(url, { max: 1, ssl: url.includes('sslmode=disable') ? false : { rejectUnauthorized: false } })

await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
const done = new Set((await sql`SELECT name FROM schema_migrations`).map((r) => r.name as string))
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  if (done.has(file)) continue
  console.log(`applying ${file}`)
  await sql.begin(async (tx) => {
    await tx.unsafe(readFileSync(join(dir, file), 'utf8'))
    await tx`INSERT INTO schema_migrations (name) VALUES (${file})`
  })
}
console.log('migrations up to date')
await sql.end()
