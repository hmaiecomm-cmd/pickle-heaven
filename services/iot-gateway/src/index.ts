import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadConfig } from './config'
import { MemoryRealtime, RedisRealtime } from './realtime'
import { MemoryStore } from './store/memory'
import { PostgresStore } from './store/postgres'
import { startWorkers } from './workers'

const cfg = loadConfig()
const store = cfg.store === 'postgres' ? new PostgresStore(cfg.databaseUrl!) : new MemoryStore()
const rt = cfg.store === 'postgres' ? new RedisRealtime(cfg.redisUrl!) : new MemoryRealtime()
const deps = { cfg, store, rt }
const app = createApp(deps)
const workers = startWorkers(deps)

const server = serve({ fetch: app.fetch, port: cfg.port }, (info) => {
  console.log(`[gateway] ${cfg.instanceId} listening on :${info.port} (store=${cfg.store})`)
})
// 長輪詢最長 25 秒；Node 預設 keep-alive / request timeout 要比它長
;(server as any).requestTimeout = (cfg.maxWaitSec + 15) * 1000
;(server as any).keepAliveTimeout = 65_000

async function shutdown(signal: string) {
  console.log(`[gateway] ${signal}, shutting down`)
  workers.stop()
  server.close()
  await rt.close()
  await store.close()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
