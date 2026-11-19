/**
 * 場地包期方案資料
 * 
 * 包含三種方案的資訊，可用於展示推薦、比較表等不同應用場景
 */

export type CourtPackage = {
  /** 方案唯一識別碼 */
  id: 'short-term' | 'half-year' | 'annual'
  /** 方案名稱 */
  name: string
  /** 方案描述（簡短） */
  description: string
  /** 有效期間（文字描述） */
  validity: string
  /** 包含的使用次數或時間 */
  includedUsage: string
  /** 方案優勢清單 */
  advantages: string[]
  /** 適合對象 */
  suitableFor: string
  /** 是否為推薦方案 */
  featured?: boolean
}

export const courtPackages: CourtPackage[] = [
  {
    id: 'short-term',
    name: '短期方案',
    description: '彈性試用，快速體驗',
    validity: '30 天內有效',
    includedUsage: '10 次場地預約',
    advantages: [
      '無長期綁約，彈性安排',
      '隨時調整預約時間',
      '適合初次體驗球友',
      '可升級至其他方案'
    ],
    suitableFor: '初次到訪或試用期間的球友'
  },
  {
    id: 'half-year',
    name: '半年方案',
    description: '常規選擇，穩定享受',
    validity: '6 個月內有效',
    includedUsage: '48 次場地預約',
    advantages: [
      '平均每月 8 次預約機會',
      '享受會員優惠與積分回饋',
      '優先預約熱門時段',
      '贈送教練課程折扣券'
    ],
    suitableFor: '經常打球的愛好者或小型球隊'
  },
  {
    id: 'annual',
    name: '年度方案',
    description: '最高優惠，盡情享受',
    validity: '12 個月內有效',
    includedUsage: '104 次場地預約',
    advantages: [
      '平均每月超過 8 次預約機會',
      '享受最高會員折扣',
      '積分加倍累積',
      '專屬球友社群與活動邀請',
      '免費教練課程 2 堂',
      'VIP 預約優先權'
    ],
    suitableFor: '常客或球隊固定預約',
    featured: true
  }
]

/**
 * 根據使用需求篩選推薦方案
 * 
 * @param need - 使用需求類別：'casual' (休閒體驗) | 'regular' (固定打球) | 'competitive' (比賽訓練)
 * @returns 推薦的方案
 */
export function getRecommendedPackages(need: 'casual' | 'regular' | 'competitive'): CourtPackage[] {
  const needMap = {
    casual: [courtPackages[0], courtPackages[1]], // 短期、半年
    regular: [courtPackages[1], courtPackages[2]], // 半年、年度
    competitive: [courtPackages[2]], // 年度
  }
  return needMap[need] || courtPackages
}

/**
 * 比較表用資料：所有方案的詳細特性對比
 */
export const comparisonData = [
  {
    feature: '合約期限',
    shortTerm: '30 天',
    halfYear: '6 個月',
    annual: '12 個月'
  },
  {
    feature: '場地預約次數',
    shortTerm: '10 次',
    halfYear: '48 次',
    annual: '104 次'
  },
  {
    feature: '平均每次成本',
    shortTerm: '高',
    halfYear: '中',
    annual: '低'
  },
  {
    feature: '會員折扣',
    shortTerm: '基礎',
    halfYear: '標準',
    annual: '最高 / 加倍積分'
  },
  {
    feature: '預約優先權',
    shortTerm: '一般',
    halfYear: '優先',
    annual: 'VIP 優先'
  },
  {
    feature: '教練課程折扣',
    shortTerm: '無',
    halfYear: '有折扣券',
    annual: '免費 2 堂 + 折扣'
  },
  {
    feature: '專屬社群與活動',
    shortTerm: '無',
    halfYear: '無',
    annual: '有'
  }
]
