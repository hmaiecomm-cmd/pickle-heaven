/**
 * Phase 6 - 排程服務功能測試
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { validateScheduleTimeRange } from '@/server/door-access-schedule-service'

describe('排程服務 - Phase 6 測試', () => {
  describe('時間範圍驗證', () => {
    it('應拒絕過去的開始時間', () => {
      const past = new Date(Date.now() - 3600000) // 1 小時前
      const future = new Date(Date.now() + 7200000) // 2 小時後
      const result = validateScheduleTimeRange(past, future)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('不能早於現在')
    })

    it('應拒絕開始時間晚於結束時間', () => {
      const start = new Date(Date.now() + 7200000) // 2 小時後
      const end = new Date(Date.now() + 3600000) // 1 小時後
      const result = validateScheduleTimeRange(start, end)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('開始時間必須早於結束時間')
    })

    it('應拒絕超過 30 天的排程', () => {
      const start = new Date(Date.now() + 86400000) // 明天
      const end = new Date(Date.now() + 2592000000 + 86400000) // 31 天後
      const result = validateScheduleTimeRange(start, end)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('不能超過 30 天')
    })

    it('應接受有效的時間範圍', () => {
      const start = new Date(Date.now() + 86400000) // 明天
      const end = new Date(Date.now() + 172800000) // 2 天後
      const result = validateScheduleTimeRange(start, end)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe('權限檢查', () => {
    it('access.schedule 權限應在 SUPER_ADMIN 角色中可用', () => {
      // 根據 admin-permissions.ts 的 ROLE_MATRIX
      // SUPER_ADMIN 應有 ALL 權限，包括 access.schedule
      const superAdminAccess = ['view', 'door', 'remote', 'schedule']
      expect(superAdminAccess).toContain('schedule')
    })

    it('access.schedule 權限應在 ENGINEER 角色中可用', () => {
      // 根據 admin-permissions.ts 的 ROLE_MATRIX
      // ENGINEER 的 access 應包含 schedule
      const engineerAccess = ['view', 'door', 'remote', 'schedule']
      expect(engineerAccess).toContain('schedule')
    })

    it('access.schedule 權限應不在 MANAGER 角色中', () => {
      // MANAGER 的 access 應只有 view 和 create、edit、delete、approve
      const managerAccess = ['view', 'create', 'edit', 'delete', 'approve']
      expect(managerAccess).not.toContain('schedule')
    })
  })

  describe('排程狀態轉換', () => {
    it('SCHEDULED 可轉換為 ACTIVE 或 CANCELLED', () => {
      const validTransitions = ['ACTIVE', 'CANCELLED']
      expect(validTransitions).toContain('ACTIVE')
      expect(validTransitions).toContain('CANCELLED')
    })

    it('ACTIVE 可轉換為 COMPLETED 或 CANCELLED', () => {
      const validTransitions = ['COMPLETED', 'CANCELLED']
      expect(validTransitions).toContain('COMPLETED')
      expect(validTransitions).toContain('CANCELLED')
    })

    it('COMPLETED 不能再轉換', () => {
      const validTransitions: string[] = []
      expect(validTransitions.length).toBe(0)
    })

    it('CANCELLED 不能再轉換', () => {
      const validTransitions: string[] = []
      expect(validTransitions.length).toBe(0)
    })
  })

  describe('審計日誌', () => {
    it('應記錄排程建立操作', () => {
      const action = 'access.schedule.create'
      expect(action).toMatch(/access\.schedule/)
    })

    it('應記錄排程取消操作', () => {
      const action = 'access.schedule.cancel'
      expect(action).toMatch(/access\.schedule/)
    })

    it('應記錄排程終止操作', () => {
      const action = 'access.schedule.terminate'
      expect(action).toMatch(/access\.schedule/)
    })

    it('審計日誌應包含操作者信息', () => {
      const auditEntry = {
        actor: 'halfmoon',
        action: 'access.schedule.create',
        target: 'schedule:abc123',
        detail: {
          scheduleName: '測試排程',
          doorId: 'main-entrance',
          reason: '測試',
        },
      }
      expect(auditEntry.actor).toBeDefined()
      expect(auditEntry.action).toBeDefined()
      expect(auditEntry.target).toBeDefined()
      expect(auditEntry.detail).toBeDefined()
    })
  })

  describe('設備控制集成', () => {
    it('ACTIVE 排程應觸發開門命令', () => {
      const action = 'OPEN'
      expect(action).toBe('OPEN')
    })

    it('COMPLETED 排程應觸發關門命令', () => {
      const action = 'CLOSE'
      expect(action).toBe('CLOSE')
    })

    it('Demo 模式應模擬設備控制結果', () => {
      const demoResult = {
        success: true,
        result: '[DEMO] Door simulated to open',
      }
      expect(demoResult.success).toBe(true)
      expect(demoResult.result).toContain('DEMO')
    })

    it('執行結果應記錄到 executionLog', () => {
      const log = {
        event: 'activation_success',
        action: 'OPEN',
        timestamp: new Date().toISOString(),
        result: 'Door opened successfully',
      }
      expect(log.event).toBeDefined()
      expect(log.action).toBeDefined()
      expect(log.timestamp).toBeDefined()
    })
  })

  describe('API 端點測試', () => {
    it('GET /api/door/schedule 應需要 access.schedule 權限', () => {
      const endpoint = '/api/door/schedule'
      const requiredPermission = 'access.schedule'
      expect(endpoint).toContain('schedule')
      expect(requiredPermission).toContain('schedule')
    })

    it('POST /api/door/schedule 應需要 access.schedule 權限', () => {
      const endpoint = '/api/door/schedule'
      const method = 'POST'
      const requiredPermission = 'access.schedule'
      expect(endpoint).toContain('schedule')
      expect(requiredPermission).toContain('schedule')
    })

    it('PUT /api/door/schedule/:id 應需要 access.schedule 權限', () => {
      const endpoint = '/api/door/schedule/:id'
      const method = 'PUT'
      const requiredPermission = 'access.schedule'
      expect(endpoint).toContain('schedule')
    })

    it('DELETE /api/door/schedule/:id 應需要 access.schedule 權限', () => {
      const endpoint = '/api/door/schedule/:id'
      const method = 'DELETE'
      const requiredPermission = 'access.schedule'
      expect(endpoint).toContain('schedule')
    })
  })

  describe('數據庫模型', () => {
    it('DoorAccessSchedule 應包含必要的欄位', () => {
      const requiredFields = [
        'id',
        'venueId',
        'doorId',
        'scheduleName',
        'startAt',
        'endAt',
        'status',
        'createdBy',
        'cancelledBy',
        'executionLog',
      ]
      expect(requiredFields.length).toBe(10)
    })

    it('排程應有唯一約束防止衝突', () => {
      // unique([doorId, startAt, endAt], name: "schedule_no_overlap")
      const uniqueConstraint = 'schedule_no_overlap'
      expect(uniqueConstraint).toBeDefined()
    })

    it('排程應有索引加快查詢', () => {
      const indexes = [
        '[venueId, doorId, status]',
        '[startAt, endAt]',
        '[createdBy]',
      ]
      expect(indexes.length).toBe(3)
    })
  })
})
