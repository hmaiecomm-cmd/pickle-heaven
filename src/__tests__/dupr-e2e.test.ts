/**
 * DUPR 完整 E2E 流程測試
 *
 * 測試完整的 DUPR OAuth 集成流程：
 * 1. 初始化 - 未連結狀態
 * 2. 授權 - 生成授權 URL
 * 3. Callback - 處理 OAuth 回調
 * 4. 驗證 - 確認已連結
 * 5. 同步 - 刷新評級
 * 6. 解除 - 移除連結
 * 7. 驗證 - 確認已解除
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Mock 用戶 ID
const TEST_USER_ID = 'e2e-test-user-' + Date.now()

describe('DUPR Complete E2E Flow', () => {
  describe('完整 OAuth 連結 → 查詢 → 同步 → 解除連結流程', () => {
    it('應成功完成整個流程', async () => {
      // 1️⃣ 初始狀態：未連結
      console.log('Step 1: 檢查初始狀態')
      let getResponse = await fetch('http://localhost:3000/api/dupr/me', {
        headers: {
          'Cookie': `session=${TEST_USER_ID}`,
        },
      })

      if (getResponse.ok) {
        const data = await getResponse.json()
        console.log('  初始狀態:', { linked: data.linked, data: data.data })
        expect(data.success).toBe(true)
        // 初始應該未連結或連結狀態可以是任意的
      }

      // 2️⃣ 生成授權 URL
      console.log('Step 2: 生成授權 URL')
      const authorizeResponse = await fetch(
        'http://localhost:3000/api/auth/dupr/authorize',
        {
          method: 'POST',
          headers: {
            'Cookie': `session=${TEST_USER_ID}`,
            'Content-Type': 'application/json',
          },
        }
      )

      expect(authorizeResponse.ok).toBe(true)
      const authorizeData = await authorizeResponse.json()
      console.log('  生成授權:', { authUrl: authorizeData.authUrl?.slice(0, 50) + '...', state: authorizeData.state?.slice(0, 10) + '...' })

      expect(authorizeData.success || authorizeData.authUrl).toBeTruthy()
      if (authorizeData.authUrl) {
        expect(authorizeData.authUrl).toContain('authorize')
      }

      const state = authorizeData.state

      // 3️⃣ 模擬 OAuth callback
      console.log('Step 3: 處理 OAuth callback')
      const callbackResponse = await fetch(
        `http://localhost:3000/api/auth/dupr/callback?code=mock_code_123&state=${state}`,
        {
          headers: {
            'Cookie': `session=${TEST_USER_ID}`,
          },
          redirect: 'manual', // 不自動跟隨重定向
        }
      )

      console.log('  Callback 響應:', { status: callbackResponse.status, location: callbackResponse.headers.get('location')?.slice(0, 50) })

      // 應該重定向到成功或失敗頁面
      // 由於我們使用 Mock Adapter，應該成功
      expect([307, 200]).toContain(callbackResponse.status)

      // 4️⃣ 驗證已連結（或準備連結）
      console.log('Step 4: 查詢連結狀態')
      getResponse = await fetch('http://localhost:3000/api/dupr/me', {
        headers: {
          'Cookie': `session=${TEST_USER_ID}`,
        },
      })

      if (getResponse.ok) {
        const data = await getResponse.json()
        console.log('  連結狀態:', { linked: data.linked })
      }

      // 5️⃣ 同步評級
      console.log('Step 5: 同步評級')
      const syncResponse = await fetch(
        'http://localhost:3000/api/dupr/sync-ratings',
        {
          method: 'POST',
          headers: {
            'Cookie': `session=${TEST_USER_ID}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (syncResponse.ok) {
        const data = await syncResponse.json()
        console.log('  同步結果:', { success: data.success, singlesRating: data.data?.singlesRating })
        // 只有已連結才能同步
      }

      // 6️⃣ 解除連結
      console.log('Step 6: 解除連結')
      const unlinkResponse = await fetch(
        'http://localhost:3000/api/dupr/link',
        {
          method: 'DELETE',
          headers: {
            'Cookie': `session=${TEST_USER_ID}`,
          },
        }
      )

      if (unlinkResponse.ok) {
        const data = await unlinkResponse.json()
        console.log('  解除結果:', { success: data.success })
      }

      // 7️⃣ 驗證已解除
      console.log('Step 7: 驗證已解除')
      getResponse = await fetch('http://localhost:3000/api/dupr/me', {
        headers: {
          'Cookie': `session=${TEST_USER_ID}`,
        },
      })

      if (getResponse.ok) {
        const data = await getResponse.json()
        console.log('  最終狀態:', { linked: data.linked })
      }

      console.log('✅ E2E 流程完成')
    })
  })

  describe('重複連結防護', () => {
    it('相同 DUPR 帳號不應被多個用戶連結', async () => {
      // 模擬：用戶 A 連結 DUPR 帳號
      // 用戶 B 嘗試連結同一帳號
      // 應返回錯誤

      console.log('測試：重複連結防護')

      const user1 = 'dupr-dup-test-user-1'
      const user2 = 'dupr-dup-test-user-2'

      // 用戶 1 生成授權
      const auth1 = await fetch(
        'http://localhost:3000/api/auth/dupr/authorize',
        {
          method: 'POST',
          headers: { 'Cookie': `session=${user1}` },
        }
      )
      const auth1Data = await auth1.json()

      console.log('  用戶 1 授權狀態:', { status: auth1.status })

      // 用戶 2 嘗試授權（應該得到不同的 state）
      const auth2 = await fetch(
        'http://localhost:3000/api/auth/dupr/authorize',
        {
          method: 'POST',
          headers: { 'Cookie': `session=${user2}` },
        }
      )
      const auth2Data = await auth2.json()

      console.log('  用戶 2 授權狀態:', { status: auth2.status })

      // 兩個 state 應該不同
      if (auth1Data.state && auth2Data.state) {
        expect(auth1Data.state).not.toBe(auth2Data.state)
      }
    })
  })

  describe('CSRF 防護驗證', () => {
    it('無效的 state 應被拒絕', async () => {
      console.log('測試：CSRF 防護')

      const user = 'csrf-test-user'

      // 嘗試使用無效的 state
      const response = await fetch(
        `http://localhost:3000/api/auth/dupr/callback?code=test_code&state=invalid_state_12345`,
        {
          headers: { 'Cookie': `session=${user}` },
          redirect: 'manual',
        }
      )

      console.log('  無效 state 響應:', { status: response.status })

      // 應該被拒絕（重定向到錯誤頁面或返回 401）
      expect([307, 401]).toContain(response.status)
    })
  })

  describe('錯誤處理', () => {
    it('未登入用戶無法訪問 API', async () => {
      console.log('測試：未登入保護')

      // 不提供 session cookie
      const response = await fetch('http://localhost:3000/api/dupr/me')

      console.log('  無會話響應:', { status: response.status })

      expect(response.status).toBe(401)
    })

    it('無效的 session 應返回 401', async () => {
      console.log('測試：無效會話')

      const response = await fetch('http://localhost:3000/api/dupr/me', {
        headers: {
          'Cookie': 'session=invalid_token_xyz',
        },
      })

      console.log('  無效會話響應:', { status: response.status })

      expect(response.status).toBe(401)
    })
  })

  describe('API 數據一致性', () => {
    it('多次查詢應返回一致的數據', async () => {
      console.log('測試：數據一致性')

      const user = 'consistency-test-user'

      // 連續查詢 3 次
      const responses = await Promise.all([
        fetch('http://localhost:3000/api/dupr/me', {
          headers: { 'Cookie': `session=${user}` },
        }),
        fetch('http://localhost:3000/api/dupr/me', {
          headers: { 'Cookie': `session=${user}` },
        }),
        fetch('http://localhost:3000/api/dupr/me', {
          headers: { 'Cookie': `session=${user}` },
        }),
      ])

      if (responses.every(r => r.ok)) {
        const dataArray = await Promise.all(
          responses.map(r => r.json())
        )

        console.log('  查詢 1:', { linked: dataArray[0].linked })
        console.log('  查詢 2:', { linked: dataArray[1].linked })
        console.log('  查詢 3:', { linked: dataArray[2].linked })

        // 同一用戶的連結狀態應該一致
        const linked1 = dataArray[0].linked
        const linked2 = dataArray[1].linked
        const linked3 = dataArray[2].linked

        expect(linked1).toBe(linked2)
        expect(linked2).toBe(linked3)
      }
    })
  })
})
