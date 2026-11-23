import { serve } from '@hono/node-server'
import type { AddressInfo } from 'node:net'
import { createApp } from './app'
import type { GatewayConfig } from './config'
import { MemoryRealtime } from './realtime'
import { MemoryStore } from './store/memory'
import { startWorkers } from './workers'

/** 在同一個行程裡啟動記憶體版 Gateway（模擬器與測試用） */
export async function startEmbeddedGateway(overrides: Partial<GatewayConfig> = {}) {
  const cfg: GatewayConfig = {
    port: 0,
    store: 'memory',
    siteMasterKey: 'sim-master-key-sim-master-key-0000',
    platformSecret: 'sim-platform-secret',
    dataKey: Buffer.alloc(32, 7).toString('base64'),
    maxWaitSec: 25,
    offlineAfterSec: 90,
    defaultCommandTtlSec: 30,
    redeliverAfterSec: 20,
    rateLimitPerMin: 100_000,
    instanceId: 'embedded',
    ...overrides,
  }
  const store = new MemoryStore()
  const rt = new MemoryRealtime()
  const deps = { cfg, store, rt }
  const app = createApp(deps)
  const workers = startWorkers(deps)
  const server = serve({ fetch: app.fetch, port: cfg.port })
  await new Promise<void>((r) => (server.listening ? r() : server.once('listening', () => r())))
  const port = (server.address() as AddressInfo).port
  return {
    url: `http://127.0.0.1:${port}`,
    cfg,
    store,
    workers,
    async close() {
      workers.stop()
      await rt.close()
      await new Promise((r) => server.close(() => r(null)))
      ;(server as any).closeAllConnections?.()
    },
  }
}
