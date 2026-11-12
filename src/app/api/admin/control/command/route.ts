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
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { publishCircuitCommand } from '@/server/mqtt-service'
import { randomUUID } from 'crypto'
import { addMinutes } from '@/lib/time'

export async function POST(req: NextRequest) {
  // 驗證管理員權限
  const ctx = await pagePermission('control')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { circuitNumber, targetState, reason } = body

    // 驗證輸入
    if (!circuitNumber || !targetState || !reason) {
      return NextResponse.json(
        { error: '缺少必要欄位: circuitNumber, targetState, reason' },
        { status: 400 },
      )
    }

    if (!['ON', 'OFF'].includes(targetState)) {
      return NextResponse.json(
        { error: '無效的目標狀態' },
        { status: 400 },
      )
    }

    // 查詢迴路
    const circuit = await prisma.circuit.findUnique({
      where: { circuitNumber },
      include: { venue: { include: { deviceAdapters: true } } },
    })

    if (!circuit) {
      return NextResponse.json(
        { error: `迴路 ${circuitNumber} 不存在` },
        { status: 404 },
      )
    }

    // 檢查迴路是否啟用
    if (!circuit.enabled) {
      return NextResponse.json(
        { error: `迴路 ${circuitNumber} 已停用` },
        { status: 400 },
      )
    }

    // 檢查是否允許遠端控制
    if (!circuit.remoteControlEnabled) {
      return NextResponse.json(
        { error: `迴路 ${circuitNumber} 不允許遠端控制（24 小時供電）` },
        { status: 400 },
      )
    }

    // 建立控制命令
    const commandId = randomUUID()
    const command = await prisma.controlCommand.create({
      data: {
        commandId,
        circuitId: circuit.id,
        source: 'MANUAL_OVERRIDE',
        targetState: targetState as 'ON' | 'OFF',
        status: 'PENDING',
        requestedBy: ctx.username,
        expiresAt: addMinutes(new Date(), 5), // 命令 5 分鐘有效
        simulated: true,
      },
    })

    // 發佈到 MQTT（如果設備已連接）
    if (circuit.venue.deviceAdapters.length > 0) {
      const adapter = circuit.venue.deviceAdapters[0]
      const mapping = circuit.deviceMapping as any

      if (mapping && adapter.enabled) {
        const onValue = mapping.onValue
        const offValue = mapping.offValue
        const value = targetState === 'ON' ? onValue : offValue

        await publishCircuitCommand(
          commandId,
          adapter.macId,
          mapping.channel,
          value,
          adapter.mqttControlTopic,
        )
      }
    }

    // 記錄事件
    await prisma.controlEvent.create({
      data: {
        eventId: randomUUID(),
        venueId: circuit.venueId,
        circuitId: circuit.id,
        commandId: command.id,
        userId: ctx.username,
        eventType: 'MANUAL_OVERRIDE',
        severity: 'WARNING', // 人工操作標記為 WARNING 便於審計
        environment: 'SIMULATION',
        title: `迴路 ${circuitNumber} 被手動${targetState === 'ON' ? '開啟' : '關閉'}`,
        description: `操作者: ${ctx.username}, 原因: ${reason}`,
        data: {
          circuitNumber,
          targetState,
          reason,
          operator: ctx.username,
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        commandId: command.id,
        message: `迴路 ${circuitNumber} 已發送${targetState === 'ON' ? '開啟' : '關閉'}命令`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[API] 發送控制命令失敗:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 },
    )
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
