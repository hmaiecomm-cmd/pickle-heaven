/**
 * Mock DUPR Adapter 測試
 *
 * 驗證 Mock Adapter 的基本功能
 * （實際測試應在 Jest 或類似測試框架中執行）
 */

import { MockDuprAdapter } from '../mock-adapter'

/**
 * 簡化的測試函數（可用於 npm run verify:* 腳本）
 */
export async function testMockDuprAdapter() {
  const adapter = new MockDuprAdapter()
  const results: { test: string; status: 'PASS' | 'FAIL'; message?: string }[] = []

  try {
    // Test 1: getAuthorizationUrl
    try {
      const authUrl = adapter.getAuthorizationUrl('test_state')
      if (authUrl.includes('mock.dupr.local') && authUrl.includes('test_state')) {
        results.push({ test: 'getAuthorizationUrl', status: 'PASS' })
      } else {
        results.push({ test: 'getAuthorizationUrl', status: 'FAIL', message: '返回的授權 URL 格式不正確' })
      }
    } catch (e) {
      results.push({ test: 'getAuthorizationUrl', status: 'FAIL', message: (e as Error).message })
    }

    // Test 2: exchangeCodeForToken
    try {
      const token = await adapter.exchangeCodeForToken('mock_code')
      if (token.accessToken && token.refreshToken && token.expiresIn > 0) {
        results.push({ test: 'exchangeCodeForToken', status: 'PASS' })
      } else {
        results.push({ test: 'exchangeCodeForToken', status: 'FAIL', message: 'Token 格式不正確' })
      }
    } catch (e) {
      results.push({ test: 'exchangeCodeForToken', status: 'FAIL', message: (e as Error).message })
    }

    // Test 3: validateToken
    try {
      const token = await adapter.exchangeCodeForToken('mock_code_2')
      const isValid = await adapter.validateToken(token.accessToken)
      if (isValid) {
        results.push({ test: 'validateToken (valid)', status: 'PASS' })
      } else {
        results.push({ test: 'validateToken (valid)', status: 'FAIL', message: '應該驗證為有效' })
      }
    } catch (e) {
      results.push({ test: 'validateToken (valid)', status: 'FAIL', message: (e as Error).message })
    }

    // Test 4: validateToken (invalid)
    try {
      const isValid = await adapter.validateToken('invalid_token')
      if (!isValid) {
        results.push({ test: 'validateToken (invalid)', status: 'PASS' })
      } else {
        results.push({ test: 'validateToken (invalid)', status: 'FAIL', message: '應該驗證為無效' })
      }
    } catch (e) {
      results.push({ test: 'validateToken (invalid)', status: 'FAIL', message: (e as Error).message })
    }

    // Test 5: getPlayerProfile
    try {
      const token = await adapter.exchangeCodeForToken('mock_code_3')
      const profile = await adapter.getPlayerProfile(token.accessToken)
      if (profile.playerId && profile.name && typeof profile.singlesRating === 'number') {
        results.push({ test: 'getPlayerProfile', status: 'PASS' })
      } else {
        results.push({ test: 'getPlayerProfile', status: 'FAIL', message: '球員信息格式不正確' })
      }
    } catch (e) {
      results.push({ test: 'getPlayerProfile', status: 'FAIL', message: (e as Error).message })
    }

    // Test 6: getPlayerRating
    try {
      const rating = await adapter.getPlayerRating('DUPR_MOCK_001')
      if (typeof rating.singlesRating === 'number' && typeof rating.doublesRating === 'number') {
        results.push({ test: 'getPlayerRating', status: 'PASS' })
      } else {
        results.push({ test: 'getPlayerRating', status: 'FAIL', message: '評級格式不正確' })
      }
    } catch (e) {
      results.push({ test: 'getPlayerRating', status: 'FAIL', message: (e as Error).message })
    }

    // Test 7: submitMatchResult
    try {
      const result = await adapter.submitMatchResult({
        matchId: 'test_match_1',
        playersA: ['DUPR_MOCK_001', 'DUPR_MOCK_002'],
        playersB: ['DUPR_MOCK_003', 'DUPR_MOCK_001'],
        scoresA: [11],
        scoresB: [9],
        startTime: new Date(),
      })
      if (result.success && result.duprMatchId) {
        results.push({ test: 'submitMatchResult', status: 'PASS' })
      } else {
        results.push({ test: 'submitMatchResult', status: 'FAIL', message: '提交結果不符預期' })
      }
    } catch (e) {
      results.push({ test: 'submitMatchResult', status: 'FAIL', message: (e as Error).message })
    }

    // Test 8: submitMatchResult (invalid)
    try {
      const result = await adapter.submitMatchResult({
        matchId: 'test_match_invalid',
        playersA: ['DUPR_MOCK_001'], // 只有 1 人，應該失敗
        playersB: ['DUPR_MOCK_002', 'DUPR_MOCK_003'],
        scoresA: [11],
        scoresB: [9],
        startTime: new Date(),
      })
      if (!result.success) {
        results.push({ test: 'submitMatchResult (validation)', status: 'PASS' })
      } else {
        results.push({ test: 'submitMatchResult (validation)', status: 'FAIL', message: '應該拒絕無效的隊伍' })
      }
    } catch (e) {
      results.push({ test: 'submitMatchResult (validation)', status: 'FAIL', message: (e as Error).message })
    }

    // Test 9: getPlayerStats
    try {
      const stats = await adapter.getPlayerStats('DUPR_MOCK_001')
      if (stats.playerId && stats.name && typeof stats.singlesRating === 'number') {
        results.push({ test: 'getPlayerStats', status: 'PASS' })
      } else {
        results.push({ test: 'getPlayerStats', status: 'FAIL', message: '統計信息格式不正確' })
      }
    } catch (e) {
      results.push({ test: 'getPlayerStats', status: 'FAIL', message: (e as Error).message })
    }

    // Test 10: revokeAuthorization
    try {
      const token = await adapter.exchangeCodeForToken('mock_code_4')
      const revoked = await adapter.revokeAuthorization(token.accessToken)
      const isValid = await adapter.validateToken(token.accessToken)
      if (revoked && !isValid) {
        results.push({ test: 'revokeAuthorization', status: 'PASS' })
      } else {
        results.push({ test: 'revokeAuthorization', status: 'FAIL', message: 'Token 應該被撤銷' })
      }
    } catch (e) {
      results.push({ test: 'revokeAuthorization', status: 'FAIL', message: (e as Error).message })
    }
  } catch (e) {
    console.error('[TEST ERROR]', e)
  }

  // 列印結果
  console.log('\n=== Mock DUPR Adapter 測試結果 ===')
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length

  results.forEach(r => {
    const emoji = r.status === 'PASS' ? '✅' : '❌'
    console.log(`${emoji} ${r.test}${r.message ? ': ' + r.message : ''}`)
  })

  console.log(`\n總計：${passed} 通過，${failed} 失敗（共 ${results.length} 個測試）`)
  console.log('================================\n')

  return failed === 0
}

// 如果直接執行此文件
if (require.main === module) {
  testMockDuprAdapter().then(success => {
    process.exit(success ? 0 : 1)
  })
}
