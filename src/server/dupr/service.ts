/**
 * DUPR 服務層 — 處理所有與 DUPR 相關的業務邏輯
 */

import { prisma } from '@/lib/db'
import { getDuprAdapter } from './adapter'
import { encryptToken, decryptToken, isEncryptedToken } from '@/lib/dupr-encryption'

export interface DuprLinkResult {
  success: boolean
  message: string
  data?: {
    playerId: string
    playerName: string
    singlesRating: number
    doublesRating: number
  }
}

/**
 * DUPR 服務類別
 */
export class DuprService {
  private adapter = getDuprAdapter()

  /**
   * 取得授權 URL（將用戶導向 DUPR 授權頁面）
   * @param userId 使用者 ID
   * @param state CSRF 防護狀態碼
   * @returns 授權 URL
   */
  getAuthorizationUrl(userId: string, state: string): string {
    return this.adapter.getAuthorizationUrl(state)
  }

  /**
   * 處理 OAuth callback — 交換授權碼為 Token 並保存
   * @param userId 使用者 ID
   * @param code DUPR 官方回傳的授權碼
   * @returns 連結結果
   */
  async handleOAuthCallback(userId: string, code: string): Promise<DuprLinkResult> {
    try {
      // 1. 交換授權碼為 Token
      const token = await this.adapter.exchangeCodeForToken(code)

      // 2. 取得球員信息
      const profile = await this.adapter.getPlayerProfile(token.accessToken)

      // 3. 檢查是否已連結其他帳號
      const existingLink = await prisma.duprPlayerLink.findFirst({
        where: {
          duprPlayerId: profile.playerId,
        },
      })

      if (existingLink && existingLink.userId !== userId) {
        return {
          success: false,
          message: '此 DUPR 帳號已連結到另一個用戶。請先解除連結。',
        }
      }

      // 4. 保存或更新連結
      const encryptedAccessToken = encryptToken(token.accessToken)
      const encryptedRefreshToken = token.refreshToken
        ? encryptToken(token.refreshToken)
        : null

      const expiresAt = new Date(Date.now() + token.expiresIn * 1000)

      const link = await prisma.duprPlayerLink.upsert({
        where: {
          userId: userId,
        },
        create: {
          userId,
          duprPlayerId: profile.playerId,
          playerName: profile.name,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: expiresAt,
          singlesRating: profile.singlesRating,
          doublesRating: profile.doublesRating,
          ratingUpdatedAt: new Date(),
          linkedAt: new Date(),
        },
        update: {
          duprPlayerId: profile.playerId,
          playerName: profile.name,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt: expiresAt,
          singlesRating: profile.singlesRating,
          doublesRating: profile.doublesRating,
          ratingUpdatedAt: new Date(),
          linkedAt: new Date(),
          unlinkedAt: null, // 清除之前的解除連結時間
        },
      })

      // 5. 記錄 API 日誌
      await this.logApiCall('POST /oauth/token', 200, 0, userId)

      return {
        success: true,
        message: '帳號連結成功',
        data: {
          playerId: profile.playerId,
          playerName: profile.name,
          singlesRating: profile.singlesRating,
          doublesRating: profile.doublesRating,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知錯誤'
      await this.logApiCall('POST /oauth/token', 400, 0, userId, message)
      return {
        success: false,
        message: `帳號連結失敗：${message}`,
      }
    }
  }

  /**
   * 查詢使用者的 DUPR 連結狀態
   * @param userId 使用者 ID
   * @returns 連結信息或 null
   */
  async getLink(userId: string) {
    const link = await prisma.duprPlayerLink.findUnique({
      where: { userId },
      select: {
        duprPlayerId: true,
        playerName: true,
        singlesRating: true,
        doublesRating: true,
        ratingUpdatedAt: true,
        linkedAt: true,
        unlinkedAt: true,
      },
    })

    if (!link || link.unlinkedAt) {
      return null // 未連結
    }

    return link
  }

  /**
   * 刷新評級（從 DUPR API 取得最新評級）
   * @param userId 使用者 ID
   * @returns 更新後的評級或錯誤
   */
  async refreshRating(userId: string): Promise<{ success: boolean; message: string; rating?: { singles: number; doubles: number } }> {
    try {
      const link = await prisma.duprPlayerLink.findUnique({
        where: { userId },
      })

      if (!link || link.unlinkedAt) {
        return {
          success: false,
          message: '帳號未連結',
        }
      }

      // 查詢最新評級
      const rating = await this.adapter.getPlayerRating(link.duprPlayerId)

      // 更新快取
      await prisma.duprPlayerLink.update({
        where: { userId },
        data: {
          singlesRating: rating.singlesRating,
          doublesRating: rating.doublesRating,
          ratingUpdatedAt: new Date(),
        },
      })

      await this.logApiCall('GET /players/{id}/rating', 200, 0, userId)

      return {
        success: true,
        message: '評級已更新',
        rating: {
          singles: rating.singlesRating,
          doubles: rating.doublesRating,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知錯誤'
      await this.logApiCall('GET /players/{id}/rating', 400, 0, userId, message)
      return {
        success: false,
        message: `評級刷新失敗：${message}`,
      }
    }
  }

  /**
   * 解除連結
   * @param userId 使用者 ID
   * @returns 解除連結結果
   */
  async unlinkAccount(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const link = await prisma.duprPlayerLink.findUnique({
        where: { userId },
      })

      if (!link) {
        return {
          success: false,
          message: '帳號未連結',
        }
      }

      // 撤銷授權（如果有有效的 Token）
      if (!link.unlinkedAt) {
        try {
          const token = isEncryptedToken(link.accessToken)
            ? decryptToken(link.accessToken)
            : link.accessToken
          await this.adapter.revokeAuthorization(token)
        } catch (e) {
          console.warn('[DUPR] 撤銷授權失敗（可能已過期）:', e)
        }
      }

      // 標記為已解除連結
      await prisma.duprPlayerLink.update({
        where: { userId },
        data: {
          unlinkedAt: new Date(),
        },
      })

      await this.logApiCall('DELETE /link', 200, 0, userId)

      return {
        success: true,
        message: '帳號已解除連結',
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知錯誤'
      await this.logApiCall('DELETE /link', 400, 0, userId, message)
      return {
        success: false,
        message: `解除連結失敗：${message}`,
      }
    }
  }

  /**
   * 記錄 API 呼叫（用於監控、除錯、限速）
   * @param endpoint API 端點
   * @param statusCode HTTP 狀態碼
   * @param duration 耗時（毫秒）
   * @param userId 使用者 ID（選填）
   * @param errorMsg 錯誤信息（選填）
   */
  private async logApiCall(
    endpoint: string,
    statusCode: number,
    duration: number,
    userId?: string,
    errorMsg?: string
  ): Promise<void> {
    try {
      await prisma.duprApiLog.create({
        data: {
          endpoint,
          method: endpoint.split(' ')[0] || 'GET',
          statusCode,
          duration,
          userId: userId || null,
          errorMsg,
        },
      })
    } catch (error) {
      console.error('[DUPR] 無法記錄 API 日誌:', error)
      // 不中斷主流程
    }
  }

  /**
   * 檢查 Token 是否需要刷新
   * @param userId 使用者 ID
   * @returns Token 是否已過期
   */
  async isTokenExpired(userId: string): Promise<boolean> {
    const link = await prisma.duprPlayerLink.findUnique({
      where: { userId },
      select: { tokenExpiresAt: true },
    })

    if (!link) return false

    return new Date() >= link.tokenExpiresAt
  }

  /**
   * 取得活躍連結數（用於統計）
   * @returns 連結數
   */
  async getActiveLinksCount(): Promise<number> {
    return await prisma.duprPlayerLink.count({
      where: {
        unlinkedAt: null, // 僅計算活躍連結
      },
    })
  }

  /**
   * 取得最近的 API 日誌
   * @param limit 限制數量
   * @returns 日誌列表
   */
  async getRecentApiLogs(limit: number = 100) {
    return await prisma.duprApiLog.findMany({
      orderBy: {
        requestAt: 'desc',
      },
      take: limit,
      select: {
        endpoint: true,
        statusCode: true,
        duration: true,
        requestAt: true,
        errorMsg: true,
      },
    })
  }

  /**
   * 同步評級（refreshRating 的別名）
   * @param userId 使用者 ID
   * @returns 同步結果（含 data 物件）
   */
  async syncRatings(userId: string): Promise<{ success: boolean; message: string; data?: { singlesRating: number; doublesRating: number; syncedAt: Date } }> {
    try {
      const link = await prisma.duprPlayerLink.findUnique({
        where: { userId },
      })

      if (!link || link.unlinkedAt) {
        return {
          success: false,
          message: '帳號未連結',
        }
      }

      // 查詢最新評級
      const rating = await this.adapter.getPlayerRating(link.duprPlayerId)

      // 更新快取
      const updated = await prisma.duprPlayerLink.update({
        where: { userId },
        data: {
          singlesRating: rating.singlesRating,
          doublesRating: rating.doublesRating,
          ratingUpdatedAt: new Date(),
        },
      })

      await this.logApiCall('POST /sync-ratings', 200, 0, userId)

      return {
        success: true,
        message: '評級已同步',
        data: {
          singlesRating: updated.singlesRating ?? 0,
          doublesRating: updated.doublesRating ?? 0,
          syncedAt: updated.ratingUpdatedAt ?? new Date(),
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知錯誤'
      await this.logApiCall('POST /sync-ratings', 400, 0, userId, message)
      return {
        success: false,
        message: `評級同步失敗：${message}`,
      }
    }
  }
}

// 匯出單例
export const duprService = new DuprService()
