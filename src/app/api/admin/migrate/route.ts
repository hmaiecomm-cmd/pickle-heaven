/**
 * 臨時 Migration 觸發端點（僅限開發/管理用途）
 * 生產環境部署後應刪除此端點
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { join } from 'node:path'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  // 基本身份驗證
  const authHeader = req.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET || 'dev-token'

  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  if (token !== expectedToken) {
    return Response.json({ error: 'Invalid token' }, { status: 403 })
  }

  try {
    const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env

    if (!TURSO_DATABASE_URL) {
      return Response.json(
        { error: 'Missing TURSO_DATABASE_URL environment variable' },
        { status: 500 }
      )
    }

    // 讀取所有 migration SQL 檔案
    const migrationsDir = join(process.cwd(), 'prisma', 'migrations')
    const migrations = [
      '20261124123219_add_feature_subscription_system',
      '20261125163117_add_payment_webhook_and_renewal_fields',
    ]

    const client = createClient({
      url: TURSO_DATABASE_URL,
      authToken: TURSO_AUTH_TOKEN
    })

    const results = []

    for (const migration of migrations) {
      try {
        const sqlPath = join(migrationsDir, migration, 'migration.sql')
        const sql = readFileSync(sqlPath, 'utf8')

        const statements = sql
          .split(';')
          .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
          .filter(Boolean)

        if (statements.length > 0) {
          await client.batch(statements, 'write')
          results.push({ migration, status: 'applied' })
        } else {
          results.push({ migration, status: 'empty' })
        }
      } catch (err) {
        results.push({
          migration,
          status: 'error',
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }

    // 驗證結果
    const { rows: tables } = await client.execute(
      "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name",
    )

    return Response.json({
      success: true,
      appliedMigrations: results.filter(r => r.status === 'applied'),
      failedMigrations: results.filter(r => r.status === 'error'),
      totalTables: tables.length,
      tableNames: tables.map((t: any) => t.name),
    })
  } catch (err) {
    return Response.json(
      {
        error: 'Migration failed',
        message: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    )
  }
}
