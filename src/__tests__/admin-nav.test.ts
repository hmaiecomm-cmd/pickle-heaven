import { ADMIN_NAV, ALIAS_PATHS, activeHref, sectionLabel } from '@/app/admin/admin-nav'

describe('Admin Navigation - Product Tier Restructuring (V8.2)', () => {
  describe('PLUS｜基礎營運', () => {
    test('應存在 PLUS｜基礎營運 分組', () => {
      const plus = ADMIN_NAV.filter(g => g.section === 'plus')
      expect(plus.length).toBeGreaterThan(0)
    })

    test('場地預約應包含正確的子項目', () => {
      const courts = ADMIN_NAV.find(g => g.key === 'courts')
      expect(courts?.section).toBe('plus')
      expect(courts?.items).toHaveLength(3)
      expect(courts?.items?.map(i => i.label)).toEqual(['預約行事曆', '場地設定', '維護與封場'])
      expect(courts?.items?.map(i => i.href)).toEqual(['/admin/schedule', '/admin/courts', '/admin/maintenance'])
    })

    test('訂單紀錄應包含正確的子項目', () => {
      const orders = ADMIN_NAV.find(g => g.key === 'orders')
      expect(orders?.section).toBe('plus')
      expect(orders?.items).toHaveLength(4)
      expect(orders?.items?.map(i => i.label)).toEqual(['訂場訂單', '活動訂單', '商品訂單', '點數與票券'])
      expect(orders?.items?.map(i => i.href)).toEqual(['/admin/bookings?tab=venue', '/admin/bookings?tab=activity', '/admin/product-orders', '/admin/bookings?tab=points'])
    })

    test('財務報表應為單一入口，不拆分 tab', () => {
      const finance = ADMIN_NAV.find(g => g.key === 'finance')
      expect(finance?.section).toBe('plus')
      expect(finance?.href).toBe('/admin/finance')
      expect(finance?.items).toBeUndefined()
      // 確保沒有多個財務相關項目
      const financeGroups = ADMIN_NAV.filter(g => g.section === 'plus' && (g.key === 'finance' || g.label.includes('財務')))
      expect(financeGroups).toHaveLength(1)
    })

    test('財務 query tab 別名應全部映射到 /admin/finance', () => {
      const aliases = ['/admin/finance/payments', '/admin/refunds', '/admin/topup', '/admin/members/points', '/admin/invoices', '/admin/expenses', '/admin/finance/daily', '/admin/bookings/products']
      aliases.forEach(alias => {
        expect(ALIAS_PATHS[alias]).toBe('/admin/finance')
      })
    })

    test('會員與教練應包含正確的子項目', () => {
      const members = ADMIN_NAV.find(g => g.key === 'members')
      expect(members?.section).toBe('plus')
      expect(members?.items).toHaveLength(3)
      expect(members?.items?.map(i => i.label)).toEqual(['會員管理', '教練', '黑名單'])
    })
  })

  describe('PRO｜智慧無人營運', () => {
    test('應存在 PRO｜智慧無人營運 分組', () => {
      const pro = ADMIN_NAV.filter(g => g.section === 'pro')
      expect(pro.length).toBeGreaterThan(0)
    })

    test('無人營運管理應包含正確的子項目', () => {
      const operations = ADMIN_NAV.find(g => g.key === 'operations')
      expect(operations?.label).toBe('無人營運管理')
      expect(operations?.section).toBe('pro')
      expect(operations?.items).toHaveLength(3)
      expect(operations?.items?.map(i => i.href)).toEqual(['/admin/access', '/admin/devices', '/admin/control'])
    })

    test('/admin/automation 應映射到 /admin/devices（無人營運管理）', () => {
      expect(ALIAS_PATHS['/admin/automation']).toBe('/admin/devices')
      expect(activeHref('/admin/automation')).toBe('/admin/devices')
    })

    test('AI 即時監控應包含正確的子項目', () => {
      const monitoring = ADMIN_NAV.find(g => g.key === 'monitoring')
      expect(monitoring?.label).toBe('AI 即時監控')
      expect(monitoring?.section).toBe('pro')
      expect(monitoring?.items).toHaveLength(3)
      expect(monitoring?.items?.map(i => i.label)).toEqual(['即時影像與攝影機管理', '歷史影像回放', '設備異常事件'])
      expect(monitoring?.items?.map(i => i.href)).toEqual(['/admin/monitor', '/admin/monitor?tab=playback', '/admin/monitor?tab=events'])
    })

    test('/admin/incidents 應映射到 AI 即時監控的設備異常事件', () => {
      expect(ALIAS_PATHS['/admin/incidents']).toBe('/admin/monitor?tab=events')
      expect(activeHref('/admin/incidents')).toBe('/admin/monitor?tab=events')
    })

    test('AI 即時監控不應包含獨立的操作紀錄項目', () => {
      const monitoring = ADMIN_NAV.find(g => g.key === 'monitoring')
      const hasAudit = monitoring?.items?.some(i => i.label.includes('操作紀錄') || i.label.includes('audit'))
      expect(hasAudit).toBe(false)
    })

    test('AI 超級特助應有副標題「智慧營運與成長管理」', () => {
      const assistant = ADMIN_NAV.find(g => g.key === 'assistant')
      expect(assistant?.label).toBe('AI 超級特助')
      expect(assistant?.subtitle).toBe('智慧營運與成長管理')
      expect(assistant?.section).toBe('pro')
    })

    test('AI 超級特助應包含正確的子項目', () => {
      const assistant = ADMIN_NAV.find(g => g.key === 'assistant')
      expect(assistant?.items).toHaveLength(5)
      expect(assistant?.items?.map(i => i.label)).toEqual([
        '營收與會員成長洞察',
        '會員經營與精準溝通',
        'AI 行銷活動策劃',
        '空場率與收益優化',
        '動態定價',
      ])
    })

    test('AI 超級特助不應拆分為「會員續約與回流商機」與「會員精準溝通與訊息推送」', () => {
      const assistant = ADMIN_NAV.find(g => g.key === 'assistant')
      const labels = assistant?.items?.map(i => i.label) ?? []
      expect(labels).not.toContain('會員續約與回流商機')
      expect(labels).not.toContain('會員精準溝通與訊息推送')
      // 應該只有一個會員相關的項目
      const memberRelated = labels.filter(l => l.includes('會員'))
      expect(memberRelated).toHaveLength(1)
      expect(memberRelated[0]).toBe('會員經營與精準溝通')
    })

    test('AI 情境營造應存在', () => {
      const ambience = ADMIN_NAV.find(g => g.key === 'ambience')
      expect(ambience?.label).toBe('AI 情境營造')
      expect(ambience?.section).toBe('pro')
      expect(ambience?.items).toHaveLength(3)
    })

    test('AI 情境營造的入口應為 /admin/ambience', () => {
      const ambience = ADMIN_NAV.find(g => g.key === 'ambience')
      expect(ambience?.items?.some(i => i.href === '/admin/ambience?tab=voice')).toBe(true)
    })
  })

  describe('系統設定', () => {
    test('應保持原有的結構與位置', () => {
      const settings = ADMIN_NAV.find(g => g.key === 'settings')
      expect(settings?.section).toBe('settings')
      expect(settings?.label).toBe('系統設定')
    })

    test('操作紀錄應保留在系統設定中', () => {
      const settings = ADMIN_NAV.find(g => g.key === 'settings')
      const audit = settings?.items?.find(i => i.label === '操作紀錄')
      expect(audit?.href).toBe('/admin/audit')
    })

    test('/admin/audit 應屬於系統設定，不應屬於設備異常事件', () => {
      const settings = ADMIN_NAV.find(g => g.key === 'settings')
      const hasAudit = settings?.items?.some(i => i.href === '/admin/audit')
      expect(hasAudit).toBe(true)

      const monitoring = ADMIN_NAV.find(g => g.key === 'monitoring')
      const monitoringHasAudit = monitoring?.items?.some(i => i.href === '/admin/audit')
      expect(monitoringHasAudit).toBe(false)
    })
  })

  describe('舊網址相容性', () => {
    test('/admin/automation 應映射到 /admin/devices', () => {
      expect(activeHref('/admin/automation')).toBe('/admin/devices')
      expect(sectionLabel('/admin/automation')).toContain('設備智慧排程')
    })

    test('/admin/incidents 應映射到 /admin/monitor?tab=events', () => {
      expect(activeHref('/admin/incidents')).toBe('/admin/monitor?tab=events')
      expect(sectionLabel('/admin/incidents')).toContain('設備異常事件')
    })

    test('舊的活動頁面應映射到行銷', () => {
      expect(ALIAS_PATHS['/admin/activities']).toBe('/admin/marketing')
      expect(ALIAS_PATHS['/admin/marketing/campaigns']).toBe('/admin/marketing')
      expect(ALIAS_PATHS['/admin/marketing/vouchers']).toBe('/admin/marketing')
    })

    test('舊的會員相關頁面應仍可訪問', () => {
      expect(ALIAS_PATHS['/admin/members/history']).toBe('/admin/members')
    })
  })

  describe('首頁', () => {
    test('首頁應不屬於任何 section', () => {
      const home = ADMIN_NAV.find(g => g.key === 'home')
      expect(home?.section).toBeUndefined()
      expect(home?.href).toBe('/admin')
    })
  })
})
