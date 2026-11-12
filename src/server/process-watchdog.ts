/**
 * Process Watchdog — Claude Code 進程自動保活
 *
 * 功能：
 * 1. 監控 Claude Code 進程的運行狀態
 * 2. 進程意外終止時自動重啟
 * 3. 進程崩潰時記錄日誌和告警
 * 4. 防止多重啟動（mutex 機制）
 */

import 'server-only'
import { spawn, exec } from 'child_process'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

interface ProcessHealth {
  processId: number | null
  status: 'RUNNING' | 'STOPPED' | 'CRASHED' | 'ERROR'
  lastChecked: Date
  uptime: number // 秒
  restartCount: number
  lastRestartTime?: Date
  message: string
}

/**
 * Process Watchdog 狀態追蹤
 */
const processWatchdogState = {
  claudeCodeProcess: null as any,
  processId: null as number | null,
  restartCount: 0,
  lastRestartTime: new Date(),
  isRestarting: false,
  crashHistory: [] as Array<{ timestamp: Date; reason: string }>,
}

/**
 * 進程監控配置
 */
const PROCESS_CONFIG = {
  PROCESS_NAME: 'claude', // Claude Code 進程名稱
  CHECK_INTERVAL_SECONDS: 10, // 每 10 秒檢查一次
  RESTART_DELAY_SECONDS: 3, // 重啟延遲
  MAX_RESTART_ATTEMPTS: 5, // 最多重啟次數
  RESTART_WINDOW_SECONDS: 300, // 時間窗口（5 分鐘內最多 5 次重啟）
  CRASH_LOG_MAX_SIZE: 100, // 保存最近 100 次崩潰
}

/**
 * 啟動進程 Watchdog（在應用啟動時調用）
 */
export async function startProcessWatchdog() {
  console.log('[Process-Watchdog] 啟動進程監控服務...')

  // 定期檢查進程狀態
  setInterval(async () => {
    await checkAndRestoreProcess()
  }, PROCESS_CONFIG.CHECK_INTERVAL_SECONDS * 1000)

  // 嘗試連接到現有的 Claude Code 進程
  const claudeCodePid = await getClaudeCodeProcessId()
  if (claudeCodePid) {
    processWatchdogState.processId = claudeCodePid
    console.log(`[Process-Watchdog] 偵測到 Claude Code 進程: PID ${claudeCodePid}`)
  }

  console.log('[Process-Watchdog] 進程監控服務已啟動')
}

/**
 * 檢查並恢復進程
 */
export async function checkAndRestoreProcess(): Promise<ProcessHealth> {
  try {
    const health = await checkProcessHealth()

    // 進程正常
    if (health.status === 'RUNNING') {
      return health
    }

    // 進程已停止或崩潰 — 嘗試重啟
    if (health.status === 'STOPPED' || health.status === 'CRASHED') {
      console.warn(`[Process-Watchdog] Claude Code 進程異常 (${health.status}): ${health.message}`)

      // 檢查是否超過重啟限制
      if (shouldRestartProcess()) {
        await restartClaudeCodeProcess(health.status === 'CRASHED' ? '進程崩潰' : '進程停止')
      } else {
        console.error('[Process-Watchdog] 重啟次數過多，停止重啟以避免無限迴圈')
      }
    }

    // 如果是錯誤狀態，生成告警
    if (health.status === 'ERROR') {
      await createProcessAlert(health.message)
    }

    return health
  } catch (error) {
    console.error('[Process-Watchdog] 檢查失敗:', error)
    return {
      processId: null,
      status: 'ERROR',
      lastChecked: new Date(),
      uptime: 0,
      restartCount: processWatchdogState.restartCount,
      message: `檢查失敗: ${error}`,
    }
  }
}

/**
 * 檢查進程健康狀態
 */
async function checkProcessHealth(): Promise<ProcessHealth> {
  try {
    const isRunning = await isProcessRunning()

    if (isRunning) {
      const uptime = processWatchdogState.processId ? Math.floor(Date.now() / 1000) : 0
      return {
        processId: processWatchdogState.processId,
        status: 'RUNNING',
        lastChecked: new Date(),
        uptime,
        restartCount: processWatchdogState.restartCount,
        message: 'Claude Code 進程正常運行',
      }
    } else {
      // 進程未運行
      if (processWatchdogState.processId === null) {
        // 從未啟動過
        return {
          processId: null,
          status: 'STOPPED',
          lastChecked: new Date(),
          uptime: 0,
          restartCount: processWatchdogState.restartCount,
          message: 'Claude Code 進程未啟動',
        }
      } else {
        // 進程曾經運行但現在已停止
        processWatchdogState.crashHistory.push({
          timestamp: new Date(),
          reason: '進程意外終止',
        })

        // 保留最近的崩潰記錄
        if (processWatchdogState.crashHistory.length > PROCESS_CONFIG.CRASH_LOG_MAX_SIZE) {
          processWatchdogState.crashHistory.shift()
        }

        return {
          processId: processWatchdogState.processId,
          status: 'CRASHED',
          lastChecked: new Date(),
          uptime: 0,
          restartCount: processWatchdogState.restartCount,
          message: 'Claude Code 進程已崩潰',
        }
      }
    }
  } catch (error) {
    return {
      processId: null,
      status: 'ERROR',
      lastChecked: new Date(),
      uptime: 0,
      restartCount: processWatchdogState.restartCount,
      message: `健康檢查失敗: ${error}`,
    }
  }
}

/**
 * 檢查進程是否正在運行
 */
async function isProcessRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    if (processWatchdogState.processId === null) {
      resolve(false)
      return
    }

    // 在 Windows 上使用 tasklist 檢查進程
    exec(`tasklist /FI "PID eq ${processWatchdogState.processId}"`, (error, stdout) => {
      if (error) {
        resolve(false)
        return
      }

      // 檢查 stdout 中是否包含 PID
      const isRunning = stdout.includes(processWatchdogState.processId?.toString() || '')
      resolve(isRunning)
    })
  })
}

/**
 * 獲取 Claude Code 進程 ID
 */
async function getClaudeCodeProcessId(): Promise<number | null> {
  return new Promise((resolve) => {
    // 在 Windows 上搜索 claude 或 node 進程
    exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', (error, stdout) => {
      if (error) {
        resolve(null)
        return
      }

      const lines = stdout.split('\n').filter((line) => line.trim())
      for (const line of lines) {
        const parts = line.split(',').map((p) => p.trim().replace(/"/g, ''))
        if (parts[0] && parts[1]) {
          // 返回第一個 node.exe 進程（假設是 Claude Code）
          const pid = parseInt(parts[1])
          if (!isNaN(pid)) {
            resolve(pid)
            return
          }
        }
      }

      resolve(null)
    })
  })
}

/**
 * 決定是否應該重啟進程
 */
function shouldRestartProcess(): boolean {
  // 檢查是否正在重啟
  if (processWatchdogState.isRestarting) {
    return false
  }

  // 檢查重啟次數是否超過限制
  if (processWatchdogState.restartCount >= PROCESS_CONFIG.MAX_RESTART_ATTEMPTS) {
    // 檢查是否已超出時間窗口
    const timeSinceLastRestart = Date.now() - processWatchdogState.lastRestartTime.getTime()
    if (timeSinceLastRestart > PROCESS_CONFIG.RESTART_WINDOW_SECONDS * 1000) {
      // 時間窗口已過，重置計數
      processWatchdogState.restartCount = 0
      return true
    }
    return false
  }

  return true
}

/**
 * 重啟 Claude Code 進程
 */
async function restartClaudeCodeProcess(reason: string) {
  if (processWatchdogState.isRestarting) {
    console.log('[Process-Watchdog] 已在重啟中，跳過此次重啟')
    return
  }

  processWatchdogState.isRestarting = true

  try {
    console.log(`[Process-Watchdog] 開始重啟 Claude Code 進程... (原因: ${reason})`)

    // 等待重啟延遲
    await sleep(PROCESS_CONFIG.RESTART_DELAY_SECONDS * 1000)

    // 嘗試啟動 Claude Code
    const startCommand = buildStartCommand()
    console.log(`[Process-Watchdog] 執行命令: ${startCommand}`)

    exec(startCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('[Process-Watchdog] 重啟失敗:', error)
        processWatchdogState.crashHistory.push({
          timestamp: new Date(),
          reason: `重啟失敗: ${error.message}`,
        })
      } else {
        console.log('[Process-Watchdog] Claude Code 已重啟')
        processWatchdogState.lastRestartTime = new Date()
        processWatchdogState.restartCount += 1
      }
    })

    // 等待進程啟動
    await sleep(2000)

    // 重新檢測進程 ID
    const newPid = await getClaudeCodeProcessId()
    if (newPid) {
      processWatchdogState.processId = newPid
      console.log(`[Process-Watchdog] Claude Code 進程已啟動 (PID: ${newPid})`)
    }
  } catch (error) {
    console.error('[Process-Watchdog] 重啟過程出錯:', error)
  } finally {
    processWatchdogState.isRestarting = false
  }
}

/**
 * 構建啟動命令
 */
function buildStartCommand(): string {
  // 這會在 PowerShell 中執行 Claude Code
  // 確保使用完整路徑或已添加到 PATH
  return 'start "" "claude code"'
}

/**
 * 睡眠函式
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 建立進程告警
 */
async function createProcessAlert(message: string): Promise<void> {
  try {
    const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true } })
    if (!venue) return
    await prisma.watchdogAlert.create({
      data: {
        venueId: venue.id,
        alertType: "PROCESS_CRASH",
        severity: 'ERROR',
        title: '【ERROR】Claude Code 進程崩潰',
        description: message,
        detectionSource: 'PROCESS_WATCHDOG',
        detectionCount: 1,
        status: 'OPEN',
      },
    })
  } catch (error) {
    console.error('[Process-Watchdog] 建立告警失敗:', error)
  }
}

/**
 * 取得進程 Watchdog 狀態
 */
export async function getProcessWatchdogStatus(): Promise<ProcessHealth> {
  return await checkProcessHealth()
}

/**
 * 取得進程崩潰歷史
 */
export function getProcessCrashHistory(): Array<{ timestamp: Date; reason: string }> {
  return processWatchdogState.crashHistory
}

/**
 * 手動重啟進程
 */
export async function manualRestartProcess(reason?: string): Promise<boolean> {
  await restartClaudeCodeProcess(reason || '手動重啟')
  return true
}

/**
 * 取得進程狀態摘要
 */
export function getProcessStatusSummary() {
  return {
    processId: processWatchdogState.processId,
    restartCount: processWatchdogState.restartCount,
    lastRestartTime: processWatchdogState.lastRestartTime,
    isRestarting: processWatchdogState.isRestarting,
    crashHistoryCount: processWatchdogState.crashHistory.length,
    recentCrashes: processWatchdogState.crashHistory.slice(-5),
  }
}
