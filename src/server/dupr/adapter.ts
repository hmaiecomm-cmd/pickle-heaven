/**
 * DUPR API Adapter — 抽象介面
 *
 * 定義與 DUPR 系統互動的統一介面。
 * 具體實裝由 mock-adapter.ts（開發） 或 official-adapter.ts（正式）提供。
 */

export interface DuprPlayerProfile {
  playerId: string
  name: string
  location?: string
  singlesRating: number
  doublesRating: number
  matchesPlayed?: number
  winPercentage?: number
}

export interface DuprOAuthToken {
  accessToken: string
  refreshToken?: string
  expiresIn: number // 秒
  tokenType: string
  scope?: string
}

export interface DuprOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  authEndpoint: string
  tokenEndpoint: string
}

export interface DuprMatchResult {
  matchId: string
  duprMatchId?: string // DUPR 官方 ID（正式 API 時）
  playersA: string[] // 隊伍 A 的 Player IDs
  playersB: string[] // 隊伍 B 的 Player IDs
  scoresA: number[] // 各局分數
  scoresB: number[] // 各局分數
  startTime: Date
  venue?: string
  submitted?: boolean
  duprStatus?: string // PENDING | APPROVED | REJECTED
}

export interface DuprPlayerStats {
  playerId: string
  name: string
  singlesRating: number
  doublesRating: number
  matchesThisMonth: number
  matchesThisYear: number
  ratingTrend?: 'up' | 'down' | 'stable'
}

/**
 * DUPR Adapter 抽象類別
 * 所有實裝（Mock 或 Official）都應繼承此類別
 */
export abstract class DuprAdapter {
  /**
   * 球員登入授權 — 取得授權 URL
   * @param state - 狀態碼（CSRF 保護）
   * @returns 用戶應重定向的授權 URL
   */
  abstract getAuthorizationUrl(state: string): string

  /**
   * 交換授權碼獲取 Token
   * @param code - DUPR 官方回傳的授權碼
   * @returns OAuth Token
   */
  abstract exchangeCodeForToken(code: string): Promise<DuprOAuthToken>

  /**
   * 刷新過期的 Token
   * @param refreshToken - 刷新令牌
   * @returns 新的 OAuth Token
   */
  abstract refreshToken(refreshToken: string): Promise<DuprOAuthToken>

  /**
   * 使用 Access Token 查詢球員信息
   * @param accessToken - 球員的 OAuth Access Token
   * @returns 球員基本信息
   */
  abstract getPlayerProfile(accessToken: string): Promise<DuprPlayerProfile>

  /**
   * 使用球員 ID 查詢評級（需要 API Key）
   * @param playerId - DUPR Player ID
   * @returns 評級信息
   */
  abstract getPlayerRating(playerId: string): Promise<{ singlesRating: number; doublesRating: number }>

  /**
   * 提交比賽結果（需要 API Key 和賽事授權）
   * @param match - 比賽信息
   * @returns 提交結果
   */
  abstract submitMatchResult(match: DuprMatchResult): Promise<{ success: boolean; duprMatchId?: string; error?: string }>

  /**
   * 查詢比賽結果（需要 API Key）
   * @param duprMatchId - DUPR 官方比賽 ID
   * @returns 比賽信息
   */
  abstract getMatchResult(duprMatchId: string): Promise<DuprMatchResult>

  /**
   * 撤銷授權（當球員解除連結時）
   * @param accessToken - 球員的 OAuth Access Token
   * @returns 撤銷結果
   */
  abstract revokeAuthorization(accessToken: string): Promise<boolean>

  /**
   * 驗證 Token 是否仍有效
   * @param accessToken - 要驗證的 Token
   * @returns Token 是否有效
   */
  abstract validateToken(accessToken: string): Promise<boolean>

  /**
   * 取得球員統計（如可用）
   * @param playerId - DUPR Player ID
   * @returns 統計信息
   */
  abstract getPlayerStats(playerId: string): Promise<DuprPlayerStats>
}

/**
 * Adapter 工廠 — 根據環境選擇具體實裝
 */
export function getDuprAdapter(): DuprAdapter {
  const env = process.env.DUPR_ADAPTER || 'mock'

  if (env === 'official' && process.env.DUPR_API_KEY) {
    // 動態導入正式 Adapter（生產環境）
    // return new OfficialDuprAdapter(...)
    throw new Error('Official DUPR Adapter 尚未實裝。請先取得官方 API 授權。')
  }

  // 預設使用 Mock Adapter（開發環境）
  const MockAdapter = require('./mock-adapter').MockDuprAdapter
  return new MockAdapter()
}
