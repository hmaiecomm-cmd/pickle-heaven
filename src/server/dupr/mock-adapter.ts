/**
 * DUPR Mock Adapter — 開發與測試用
 *
 * 在官方 API 授權未取得前，使用此 Adapter 進行本機開發和測試。
 * 所有回傳值都是模擬數據，與真實 DUPR 系統無關。
 */

import {
  DuprAdapter,
  DuprPlayerProfile,
  DuprOAuthToken,
  DuprMatchResult,
  DuprPlayerStats,
} from './adapter'

/**
 * 模擬球員數據庫（開發用）
 */
const MOCK_PLAYERS: Record<string, DuprPlayerProfile> = {
  'DUPR_MOCK_001': {
    playerId: 'DUPR_MOCK_001',
    name: '張三',
    location: '台北市',
    singlesRating: 3.25,
    doublesRating: 3.40,
    matchesPlayed: 47,
    winPercentage: 0.55,
  },
  'DUPR_MOCK_002': {
    playerId: 'DUPR_MOCK_002',
    name: '李四',
    location: '新北市',
    singlesRating: 3.80,
    doublesRating: 3.65,
    matchesPlayed: 89,
    winPercentage: 0.62,
  },
  'DUPR_MOCK_003': {
    playerId: 'DUPR_MOCK_003',
    name: '王五',
    location: '台中市',
    singlesRating: 2.90,
    doublesRating: 3.10,
    matchesPlayed: 23,
    winPercentage: 0.48,
  },
}

/**
 * 模擬授權 Token 存儲（開發用，不安全，不可用於生產）
 */
const MOCK_TOKENS: Record<string, { accessToken: string; playerId: string; expiresAt: Date }> = {}

/**
 * Mock DUPR Adapter 實裝
 */
export class MockDuprAdapter extends DuprAdapter {
  private config = {
    authEndpoint: 'https://mock.dupr.local/oauth/authorize',
    tokenEndpoint: 'https://mock.dupr.local/oauth/token',
    clientId: 'mock_client_id',
    clientSecret: 'mock_client_secret',
    redirectUri: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  }

  async validateToken(accessToken: string): Promise<boolean> {
    // Mock：檢查 token 是否存在且未過期
    const token = Object.values(MOCK_TOKENS).find(t => t.accessToken === accessToken)
    if (!token) return false
    return token.expiresAt > new Date()
  }

  getAuthorizationUrl(state: string): string {
    // Mock：構造授權 URL
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: `${this.config.redirectUri}/auth/dupr/callback`,
      response_type: 'code',
      scope: 'profile rating',
      state: state,
    })
    return `${this.config.authEndpoint}?${params.toString()}`
  }

  async exchangeCodeForToken(code: string): Promise<DuprOAuthToken> {
    // Mock：模擬交換授權碼為 Token
    console.log('[MOCK] 交換授權碼:', code)

    // 模擬延遲
    await new Promise(resolve => setTimeout(resolve, 200))

    // 模擬隨機選擇一個球員
    const playerIds = Object.keys(MOCK_PLAYERS)
    const randomPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)]

    const accessToken = `mock_access_${randomPlayerId}_${Date.now()}`
    const refreshToken = `mock_refresh_${randomPlayerId}_${Date.now()}`

    // 存儲到模擬數據庫
    MOCK_TOKENS[accessToken] = {
      accessToken,
      playerId: randomPlayerId,
      expiresAt: new Date(Date.now() + 3600000), // 1 小時後過期
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer',
      scope: 'profile rating',
    }
  }

  async refreshToken(refreshToken: string): Promise<DuprOAuthToken> {
    // Mock：模擬刷新 Token
    console.log('[MOCK] 刷新 Token:', refreshToken.substring(0, 20) + '...')

    // 模擬延遲
    await new Promise(resolve => setTimeout(resolve, 200))

    // 模擬新 Token（實際應從 refreshToken 中提取 playerId）
    const newAccessToken = `mock_access_refreshed_${Date.now()}`
    const newRefreshToken = `mock_refresh_refreshed_${Date.now()}`

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer',
    }
  }

  async getPlayerProfile(accessToken: string): Promise<DuprPlayerProfile> {
    // Mock：查詢球員信息
    console.log('[MOCK] 查詢球員信息，Token:', accessToken.substring(0, 20) + '...')

    // 驗證 Token
    if (!(await this.validateToken(accessToken))) {
      throw new Error('Token 已過期或無效')
    }

    // 從模擬存儲中取得 playerId
    const tokenData = Object.values(MOCK_TOKENS).find(t => t.accessToken === accessToken)
    if (!tokenData) {
      throw new Error('Token 找不到')
    }

    const player = MOCK_PLAYERS[tokenData.playerId]
    if (!player) {
      throw new Error('球員找不到')
    }

    // 模擬延遲
    await new Promise(resolve => setTimeout(resolve, 300))

    return player
  }

  async getPlayerRating(playerId: string): Promise<{ singlesRating: number; doublesRating: number }> {
    // Mock：查詢評級
    console.log('[MOCK] 查詢評級，Player ID:', playerId)

    const player = MOCK_PLAYERS[playerId]
    if (!player) {
      throw new Error('球員找不到')
    }

    // 模擬延遲
    await new Promise(resolve => setTimeout(resolve, 200))

    return {
      singlesRating: player.singlesRating,
      doublesRating: player.doublesRating,
    }
  }

  async submitMatchResult(match: DuprMatchResult): Promise<{ success: boolean; duprMatchId?: string; error?: string }> {
    // Mock：提交比賽結果
    console.log('[MOCK] 提交比賽結果:', {
      playersA: match.playersA,
      playersB: match.playersB,
      scoresA: match.scoresA,
      scoresB: match.scoresB,
    })

    // 驗證資料
    if (match.playersA.length !== 2 || match.playersB.length !== 2) {
      return {
        success: false,
        error: '雙打必須各隊 2 人',
      }
    }

    if (match.scoresA.length === 0 || match.scoresB.length === 0) {
      return {
        success: false,
        error: '至少需要 1 局成績',
      }
    }

    // 模擬延遲
    await new Promise(resolve => setTimeout(resolve, 500))

    // 模擬成功提交
    const duprMatchId = `MOCK_MATCH_${Date.now()}`
    console.log('[MOCK] 比賽已提交，ID:', duprMatchId)

    return {
      success: true,
      duprMatchId,
    }
  }

  async getMatchResult(duprMatchId: string): Promise<DuprMatchResult> {
    // Mock：查詢比賽結果
    console.log('[MOCK] 查詢比賽結果，Match ID:', duprMatchId)

    // 模擬延遲
    await new Promise(resolve => setTimeout(resolve, 300))

    // 模擬回傳
    return {
      matchId: duprMatchId,
      duprMatchId,
      playersA: ['DUPR_MOCK_001', 'DUPR_MOCK_002'],
      playersB: ['DUPR_MOCK_003', 'DUPR_MOCK_001'],
      scoresA: [11, 15],
      scoresB: [9, 11],
      startTime: new Date(),
      venue: '大新店森林匹克球',
      submitted: true,
      duprStatus: 'APPROVED',
    }
  }

  async revokeAuthorization(accessToken: string): Promise<boolean> {
    // Mock：撤銷授權
    console.log('[MOCK] 撤銷授權，Token:', accessToken.substring(0, 20) + '...')

    // 從模擬存儲中移除
    const token = Object.entries(MOCK_TOKENS).find(([_, t]) => t.accessToken === accessToken)
    if (token) {
      delete MOCK_TOKENS[token[0]]
    }

    // 模擬延遲
    await new Promise(resolve => setTimeout(resolve, 200))

    return true
  }

  async getPlayerStats(playerId: string): Promise<DuprPlayerStats> {
    // Mock：查詢球員統計
    console.log('[MOCK] 查詢球員統計，Player ID:', playerId)

    const player = MOCK_PLAYERS[playerId]
    if (!player) {
      throw new Error('球員找不到')
    }

    // 模擬延遲
    await new Promise(resolve => setTimeout(resolve, 300))

    return {
      playerId,
      name: player.name,
      singlesRating: player.singlesRating,
      doublesRating: player.doublesRating,
      matchesThisMonth: Math.floor(Math.random() * 10),
      matchesThisYear: player.matchesPlayed || 0,
      ratingTrend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
    }
  }
}

/**
 * 便利函數：取得 Mock Adapter 實例
 */
export function getMockDuprAdapter(): MockDuprAdapter {
  return new MockDuprAdapter()
}
