/**
 * 門禁 API — 會話與狀態查詢
 *
 * 端點：
 * GET  /api/door/access/:accessSessionId — 查詢門禁會話
 * GET  /api/door/access/reservation/:resId — 查詢預約對應的門禁
 * POST /api/door/access/create — 建立門禁會話
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { DoorAccessService } from '@/server/door-access-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/door/access/:sessionId
 * 查詢特定門禁會話狀態
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session || !session.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    // 提取 sessionId 或 reservationId
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    const reservationId = url.searchParams.get('reservationId')

    if (sessionId) {
      // 查詢特定會話
      const accessSession = await db.accessSession.findUnique({
        where: { id: sessionId },
        include: {
          commands: {
            orderBy: { createdAt: 'desc' },
            take: 5, // 最近 5 條命令
          },
          accessLogs: {
            orderBy: { attemptAt: 'desc' },
            take: 10, // 最近 10 條通行記錄
          },
        },
      })

      if (!accessSession) {
        return NextResponse.json(
          { error: '會話不存在' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: accessSession,
      })
    }

    if (reservationId) {
      // 查詢預約對應的門禁會話
      const accessSession = await db.accessSession.findUnique({
        where: { reservationId },
        include: {
          commands: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          accessLogs: {
            orderBy: { attemptAt: 'desc' },
            take: 10,
          },
        },
      })

      if (!accessSession) {
        return NextResponse.json(
          { error: '該預約尚未配置門禁' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: accessSession,
      })
    }

    return NextResponse.json(
      { error: '必須提供 sessionId 或 reservationId' },
      { status: 400 }
    )
  } catch (error) {
    console.error('查詢門禁會話失敗:', error)
    return NextResponse.json(
      { error: '查詢失敗' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/door/access/create
 * 為預約建立門禁會話
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session || !session.user) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const body = await request.json()
    const { reservationId, bookingVersion = 1 } = body

    if (!reservationId) {
      return NextResponse.json(
        { error: '必須提供 reservationId' },
        { status: 400 }
      )
    }

    // 建立門禁會話
    const accessSession = await DoorAccessService.createAccessSessionFromBooking(
      reservationId,
      bookingVersion
    )

    // 檢查配額
    const quota = await DoorAccessService.checkCredentialQuota(
      accessSession.venueId,
      new Date().toISOString().split('T')[0], // YYYY-MM-DD
      accessSession.controllerMacId
    )

    if (!quota.canProvision) {
      return NextResponse.json(
        { error: quota.reason || '無法提供憑證' },
        { status: 400 }
      )
    }

    // 建立憑證命令
    const credential = {
      value: generatePin(6), // 生成 6 位 PIN
      hash: hashPin('PIN_VALUE'), // TODO: 實現正確的 hash
    }

    const command = await DoorAccessService.createProvisionCommand(
      accessSession,
      credential
    )

    // 發送 MQTT 命令
    await DoorAccessService.publishCredentialCommand(command)

    // 模擬命令執行
    if (process.env.CONTROL_ENVIRONMENT === 'simulation') {
      await DoorAccessService.simulateCommandExecution(command, 'success')
    }

    return NextResponse.json({
      success: true,
      data: {
        accessSessionId: accessSession.id,
        commandId: command.commandId,
        credentialHash: credential.hash,
        validFrom: accessSession.validFromUtc,
        validUntil: accessSession.validUntilUtc,
        message: '門禁會話已建立，密碼設定命令已發送',
      },
    })
  } catch (error) {
    console.error('建立門禁會話失敗:', error)
    return NextResponse.json(
      { error: (error as Error).message || '建立失敗' },
      { status: 500 }
    )
  }
}

/**
 * 簡單的 PIN 生成函數
 */
function generatePin(length: number = 6): string {
  let pin = ''
  for (let i = 0; i < length; i++) {
    pin += Math.floor(Math.random() * 10)
  }
  return pin
}

/**
 * 簡單的 PIN Hash 函數 (實際應使用 bcrypt)
 */
function hashPin(pin: string): string {
  // TODO: 實現使用 bcrypt 或其他密碼學雜湊函數
  // 此為暫時實現，實際應使用更安全的方式
  return Buffer.from(pin).toString('base64').slice(0, 32)
}
