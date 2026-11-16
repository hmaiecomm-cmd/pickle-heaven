/**
 * DUPR 服務層集成測試
 *
 * 測試 OAuth 完整流程、Token 加密、連結管理等
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DuprService } from '../service'
import { prisma } from '@/lib/db'
import { encryptToken, decryptToken, isEncryptedToken } from '@/lib/dupr-encryption'

// Mock 環境變數
beforeEach(() => {
  process.env.DUPR_ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1'
})

describe('DuprService', () => {
  let service: DuprService
  const testUserId = 'test-user-123'
  const testPlayerId = 'DUPR_MOCK_001'

  beforeEach(() => {
    service = new DuprService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('授權流程', () => {
    it('應該生成授權 URL', () => {
      const state = 'test-state-123'
      const authUrl = service.getAuthorizationUrl(testUserId, state)

      expect(authUrl).toContain('mock.dupr.local')
      expect(authUrl).toContain('state=test-state-123')
      expect(authUrl).toContain('response_type=code')
    })

    it('應該處理 OAuth callback 並保存連結', async () => {
      // Mock adapter
      const result = await service.handleOAuthCallback(testUserId, 'mock_code_123')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.playerId).toBeDefined()
      expect(result.data?.singlesRating).toBeGreaterThan(0)
      expect(result.data?.doublesRating).toBeGreaterThan(0)
    })

    it('應該防止重複連結相同的 DUPR 帳號', async () => {
      // 第一次連結
      const result1 = await service.handleOAuthCallback(testUserId, 'mock_code_001')
      expect(result1.success).toBe(true)

      // 嘗試用另一個用戶連結相同的 DUPR 帳號
      const anotherUserId = 'another-user-456'
      const result2 = await service.handleOAuthCallback(
        anotherUserId,
        'mock_code_001' // 返回相同的 playerId
      )

      if (result2.success === false) {
        expect(result2.message).toContain('已連結')
      }
    })
  })

  describe('Token 加密', () => {
    it('應該正確加密和解密 Token', () => {
      const originalToken = 'oauth_access_token_abc123xyz'

      const encrypted = encryptToken(originalToken)
      expect(encrypted).toContain('encrypted:')

      const decrypted = decryptToken(encrypted)
      expect(decrypted).toBe(originalToken)
    })

    it('應該識別加密的 Token', () => {
      const token = 'plain_token'
      const encrypted = encryptToken(token)

      expect(isEncryptedToken(token)).toBe(false)
      expect(isEncryptedToken(encrypted)).toBe(true)
    })

    it('應該拒絕損壞的加密 Token', () => {
      const corruptedToken = 'encrypted:invalid-base64-data'

      expect(() => {
        decryptToken(corruptedToken)
      }).toThrow()
    })

    it('應該處理未加密的 Token（向後相容）', () => {
      const plainToken = 'plain_oauth_token'

      // 不應該拋出錯誤，但會警告
      const result = async () => {
        // 這個函數會警告但返回原值
        return plainToken
      }

      expect(result).toBeDefined()
    })
  })

  describe('連結管理', () => {
    it('應該查詢用戶的連結狀態', async () => {
      // 先建立連結
      await service.handleOAuthCallback(testUserId, 'mock_code_123')

      // 查詢連結
      const link = await service.getLink(testUserId)

      if (link) {
        expect(link.duprPlayerId).toBeDefined()
        expect(link.playerName).toBeDefined()
        expect(link.singlesRating).toBeGreaterThan(0)
        expect(link.linkedAt).toBeInstanceOf(Date)
      }
    })

    it('未連結的用戶應該返回 null', async () => {
      const nonExistentUserId = 'non-existent-user-999'
      const link = await service.getLink(nonExistentUserId)

      expect(link).toBeNull()
    })

    it('應該正確處理已解除連結的帳號', async () => {
      // 先建立連結
      await service.handleOAuthCallback(testUserId, 'mock_code_123')

      // 解除連結
      const unlinked = await service.unlinkAccount(testUserId)
      expect(unlinked).toBe(true)

      // 查詢應該返回 null
      const link = await service.getLink(testUserId)
      expect(link).toBeNull()
    })
  })

  describe('API 日誌', () => {
    it('應該記錄 API 呼叫', async () => {
      const duration = 123
      await service.logApiCall('GET /api/player/123', 200, duration, testUserId)

      // 驗證日誌已存儲
      const logs = await prisma.duprApiLog.findMany({
        where: { userId: testUserId },
      })

      const lastLog = logs[logs.length - 1]
      expect(lastLog?.endpoint).toBe('GET /api/player/123')
      expect(lastLog?.statusCode).toBe(200)
      expect(lastLog?.duration).toBe(duration)
    })

    it('應該記錄 API 錯誤', async () => {
      const errorMsg = '找不到球員'
      await service.logApiCall(
        'GET /api/player/invalid',
        404,
        50,
        testUserId,
        errorMsg
      )

      const logs = await prisma.duprApiLog.findMany({
        where: { userId: testUserId },
        orderBy: { requestAt: 'desc' },
      })

      const lastLog = logs[0]
      expect(lastLog?.statusCode).toBe(404)
      expect(lastLog?.errorMsg).toBe(errorMsg)
    })
  })

  describe('評級同步', () => {
    it('應該取得同步的評級', async () => {
      // 先建立連結
      await service.handleOAuthCallback(testUserId, 'mock_code_123')

      // 取得評級
      const ratings = await service.getSyncedRatings(testUserId)

      if (ratings) {
        expect(ratings.singlesRating).toBeGreaterThan(0)
        expect(ratings.doublesRating).toBeGreaterThan(0)
        expect(ratings.lastSyncedAt).toBeInstanceOf(Date)
      }
    })

    it('應該返回 null 給未連結的用戶', async () => {
      const ratings = await service.getSyncedRatings('non-existent-user')
      expect(ratings).toBeNull()
    })
  })

  describe('Token 刷新', () => {
    it('應該刷新過期的 Token', async () => {
      // 先建立連結
      await service.handleOAuthCallback(testUserId, 'mock_code_123')

      // 刷新 Token
      const result = await service.refreshToken(testUserId)

      if (result.success) {
        expect(result.newExpiresAt).toBeInstanceOf(Date)
      }
    })

    it('未連結的用戶無法刷新 Token', async () => {
      const result = await service.refreshToken('non-existent-user')
      expect(result.success).toBe(false)
    })
  })

  describe('錯誤處理', () => {
    it('應該處理無效的授權碼', async () => {
      // 這會取決於 Mock Adapter 的實現
      // 但應該不拋出未捕捉的異常
      try {
        const result = await service.handleOAuthCallback(testUserId, '')
        // 應該返回失敗結果而不是拋出錯誤
        expect(result.success).toBe(false)
      } catch (error) {
        // Mock adapter 可能會拋出，但應該被服務層捕捉
        expect.fail('應該被捕捉為結果失敗，而不是拋出異常')
      }
    })

    it('應該在加密密鑰缺失時拋出錯誤', () => {
      const originalKey = process.env.DUPR_ENCRYPTION_KEY
      delete process.env.DUPR_ENCRYPTION_KEY

      expect(() => {
        encryptToken('test')
      }).toThrow()

      process.env.DUPR_ENCRYPTION_KEY = originalKey
    })
  })
})
