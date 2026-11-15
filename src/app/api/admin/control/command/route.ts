/**
 * 管理員 API：發送電力控制命令
 *
 * POST /api/admin/control/command
 *
 * 請求體:
 * {
 *   circuitNumber: "01",     // 迴路編號
 *   targetState: "ON",       // 目標狀態
 *   reason: "手動測試",      // 操作原因（記錄於審計日誌）
 *   idempotencyKey: "...",  // 選填，同一個值只會建立一筆指令
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { CircuitCommandError, sendManualCircuitCommand } from '@/server/circuit-control'

/** 與後台「控制中心」共用同一套檢查：24 小時／預留迴路防護、遠端控制開關、設備串接狀態、操作原因。 */
export async function POST(req: NextRequest) {
  const ctx = await pagePermission('device.control')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as { circuitNumber?: unknown; targetState?: unknown; reason?: unknown; idempotencyKey?: unknown } | null
  const { circuitNumber, targetState, reason, idempotencyKey } = body ?? {}
  if (typeof circuitNumber !== 'string' || typeof targetState !== 'string' || typeof reason !== 'string' || !reason.trim()) {
    return NextResponse.json({ error: '缺少必要欄位: circuitNumber, targetState, reason' }, { status: 400 })
  }

  try {
    const command = await sendManualCircuitCommand({
      circuitNumber,
      targetState,
      reason,
      idempotencyKey: typeof idempotencyKey === 'string' && idempotencyKey ? idempotencyKey : `api-${randomUUID()}`,
      actor: `admin:${ctx.username}`,
    })
    return NextResponse.json(
      {
        success: true,
        commandId: command.id,
        status: command.status,
        simulated: command.simulated,
        message: `迴路 ${circuitNumber} 已${targetState === 'ON' ? '開啟' : '關閉'}（模擬）`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof CircuitCommandError) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    console.error('[API] 發送控制命令失敗:', error)
    return NextResponse.json({ success: false, error: '系統忙碌中，請稍後再試' }, { status: 500 })
  }
}

/**
 * GET 路由：查詢最近的命令歷史
 */
export async function GET(req: NextRequest) {
  const ctx = await pagePermission('monitor')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const limit = req.nextUrl.searchParams.get('limit') || '20'
    const commands = await prisma.controlCommand.findMany({
      where: { source: 'MANUAL_OVERRIDE' },
      include: { circuit: true },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    })

    return NextResponse.json(
      {
        success: true,
        data: commands.map((cmd) => ({
          id: cmd.id,
          commandId: cmd.commandId,
          circuit: cmd.circuit.name,
          targetState: cmd.targetState,
          status: cmd.status,
          requestedBy: cmd.requestedBy,
          createdAt: cmd.createdAt.toISOString(),
        })),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[API] 查詢命令歷史失敗:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 },
    )
  }
}
