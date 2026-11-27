import 'server-only'

/**
 * 頁面上下文提取 — Phase 3
 * 為 AI 助理提供當前頁面的背景信息
 */

export interface PageContext {
  pageName: string
  pageUrl: string
  userRole: string
  permissions: string[]
  contextSummary: string
}

/**
 * 根據頁面 URL 和角色提取頁面上下文
 */
export function extractPageContext(
  pageName: string,
  pageUrl: string,
  userRole: string,
  permissions: string[]
): PageContext {
  const pageInfo = getPageInfo(pageUrl)
  
  return {
    pageName: pageInfo.name,
    pageUrl,
    userRole,
    permissions,
    contextSummary: generateContextSummary(pageInfo, userRole, permissions),
  }
}

interface PageInfo {
  name: string
  section: string
  description: string
}

function getPageInfo(pageUrl: string): PageInfo {
  if (pageUrl.includes('/admin/courts')) {
    return {
      name: '智慧排程與場地',
      section: 'booking',
      description: '管理預約、時段設定、場地規則',
    }
  }
  if (pageUrl.includes('/admin/bookings')) {
    return {
      name: '訂單查詢',
      section: 'booking',
      description: '查看預約訂單、客人信息、預約狀態',
    }
  }
  if (pageUrl.includes('/admin/members')) {
    return {
      name: '會員管理',
      section: 'members',
      description: '查看會員信息、消費紀錄、會員分級',
    }
  }
  if (pageUrl.includes('/admin/finance')) {
    return {
      name: '財務報表',
      section: 'finance',
      description: '查看營收、金流、財務明細',
    }
  }
  if (pageUrl.includes('/admin/reports')) {
    return {
      name: '營運報表',
      section: 'reports',
      description: '查看營運指標、利用率、營業數據',
    }
  }
  if (pageUrl.includes('/admin/access')) {
    return {
      name: '門禁管理',
      section: 'access',
      description: '管理門禁授權、進出紀錄、異常事件',
    }
  }
  if (pageUrl.includes('/admin/device')) {
    return {
      name: '智慧設備',
      section: 'device',
      description: '管理設備狀態、控制排程、自動化規則',
    }
  }

  return {
    name: '後台首頁',
    section: 'home',
    description: '場館營運概況',
  }
}

function generateContextSummary(
  pageInfo: PageInfo,
  userRole: string,
  permissions: string[]
): string {
  const sections = []
  
  sections.push(`📍 目前頁面: ${pageInfo.name}`)
  sections.push(`👤 用戶角色: ${userRole}`)
  
  const availableActions = getAvailableActions(pageInfo.section, permissions)
  if (availableActions.length > 0) {
    sections.push(`✅ 可用功能: ${availableActions.join('、')}`)
  }
  
  sections.push(`💡 ${pageInfo.description}`)
  
  return sections.join('\n')
}

function getAvailableActions(section: string, permissions: string[]): string[] {
  const actions: string[] = []
  
  switch (section) {
    case 'booking':
      if (permissions.includes('bookings')) actions.push('查詢預約')
      if (permissions.includes('bookings.manage')) actions.push('管理預約')
      break
    case 'finance':
      if (permissions.includes('finance')) actions.push('查看財務')
      if (permissions.includes('finance.adjust')) actions.push('調整財務')
      break
    case 'reports':
      if (permissions.includes('reports')) actions.push('查看報表')
      if (permissions.includes('reports.export')) actions.push('匯出報表')
      break
    case 'members':
      if (permissions.includes('members')) actions.push('查詢會員')
      if (permissions.includes('members.note')) actions.push('新增備註')
      break
    case 'access':
      if (permissions.includes('access')) actions.push('查看門禁')
      if (permissions.includes('access.grant')) actions.push('授權管理')
      break
    case 'device':
      if (permissions.includes('device')) actions.push('查看設備')
      if (permissions.includes('device.control')) actions.push('遠端控制')
      break
  }
  
  return actions
}
