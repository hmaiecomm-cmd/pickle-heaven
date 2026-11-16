import { ADMIN_NAV, ALIAS_PATHS, activeHref, sectionLabel } from '@/app/admin/admin-nav'

describe('Admin Navigation - V8.1 Phase 1', () => {
  test('智慧設備管理應有兩個子項目', () => {
    const devices = ADMIN_NAV.find(g => g.key === 'devices')
    expect(devices?.items).toHaveLength(2)
    expect(devices?.items?.[0].label).toBe('設備總覽與智慧排程')
    expect(devices?.items?.[1].label).toBe('手動控制中心')
  })

  test('/admin/devices 應映射到設備總覽與智慧排程', () => {
    expect(activeHref('/admin/devices')).toBe('/admin/devices')
    expect(sectionLabel('/admin/devices')).toContain('設備總覽與智慧排程')
  })

  test('/admin/control 應映射到手動控制中心', () => {
    expect(activeHref('/admin/control')).toBe('/admin/control')
    expect(sectionLabel('/admin/control')).toContain('手動控制中心')
  })

  test('/admin/automation 應透過 ALIAS_PATHS 映射到 /admin/devices', () => {
    expect(ALIAS_PATHS['/admin/automation']).toBe('/admin/devices')
    expect(activeHref('/admin/automation')).toBe('/admin/devices')
  })

  test('自動化策略不應出現在側邊選單中', () => {
    const devices = ADMIN_NAV.find(g => g.key === 'devices')
    const hasAutomation = devices?.items?.some(i => i.href === '/admin/automation')
    expect(hasAutomation).toBe(false)
  })

  test('門禁權限管理應保持獨立', () => {
    const access = ADMIN_NAV.find(g => g.key === 'access')
    expect(access?.label).toBe('門禁權限管理')
    expect(access?.items?.[0].label).toBe('門禁設備與授權')
  })
})
