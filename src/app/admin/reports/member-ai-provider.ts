// AI Provider 架構 - 支持多個 AI 後端

export interface MemberOperationsInput {
  dateRange: { from: string; to: string; days: number }
  painPoint: string
  selectedChart?: string
  memberSegments: any
  memberStats: any
  revenueStats: any
  bookingStats: any
  retentionStats: any
  lineBindingStats: any
  promotionStats: any
}

export interface AIAnalysisResult {
  dataSummary: string
  mainFindings: string[]
  targetMembers: string
  suggestedPromotions: string[]
  suggestedLineMessages: string[]
  estimatedRevenue: string
  trackedMetrics: string[]
  risksAndWarnings: string[]
  loadingTime?: number
}

export interface MemberOperationsAIProvider {
  analyzeMemberOperations(input: MemberOperationsInput): Promise<AIAnalysisResult>
  generateLineMessage(painPoint: string, memberCount: number): Promise<string>
  generateCommunicationPlan(painPoint: string, memberData: any): Promise<string>
}

// Mock AI Provider - 用於演示和測試
export class MockMemberOperationsAIProvider implements MemberOperationsAIProvider {
  async analyzeMemberOperations(input: MemberOperationsInput): Promise<AIAnalysisResult> {
    // 模擬 API 延遲
    await new Promise(resolve => setTimeout(resolve, 1500))

    const mockResponses = {
      'off-peak-fill': {
        dataSummary: `分析期間 ${input.dateRange.from} 到 ${input.dateRange.to}。目前有 120 位會員，其中 45 位單次客、32 位儲值會員、28 位季卡會員。平日下午使用率僅 35%，遠低於晚間的 85%。`,
        mainFindings: [
          '平日下午時段使用率偏低，存在 50% 以上的空場機會',
          '近 30 天曾在下午消費的會員有 22 位，本週未預約',
          '下午時段如能填滿，預計可增加 15,000 元月營收'
        ],
        targetMembers: '近 30 天曾在下午消費、本週未預約的 22 位會員',
        suggestedPromotions: [
          '下午時段 75 折優惠（12:00～17:00）',
          '早晚雙場套票 8 折（提前預約'
        ],
        suggestedLineMessages: [
          '📍 下午空場補位！今週二三四下午 12-17 點享 75 折，限定 10 位會員 👉 立即預約',
          '🎾 早上運動 + 晚上運動，一起打球更划算！下午時段 8 折雙場套票，本週限時 👉 立即選位'
        ],
        estimatedRevenue: '若有 8 位會員轉換下午預約，預計增加 3,200 元現金流。若轉換率達 50%，月營收可增加 12,000 元。',
        trackedMetrics: ['離峰使用率', '下午預約數', '推播轉換率', '優惠後實收', '30 天回訪率'],
        risksAndWarnings: [
          '避免同時對所有會員發送相同優惠，應針對「晚間常客」推薦雙場套票，針對「無下午紀錄」推薦初體驗優惠',
          '如果優惠過於頻繁，可能稀釋晚間時段的收益，建議設定「每位會員單月最多 1 次下午優惠」'
        ]
      },
      'casual-to-prepay': {
        dataSummary: `分析期間共有 18 位會員近 30 天消費 3 次以上但未儲值。其中 7 位消費 4 次以上，是高轉換潛力族群。目前儲值會員 32 位，較上月增加 15%。`,
        mainFindings: [
          '識別出 7 位高頻臨打客（近 30 天消費 4+ 次），轉換潛力最高',
          '這 7 位會員平均每位消費 1,600 元，若轉換儲值預計每位貢獻 3,000+ 元',
          '首次儲值轉換率目前約 18.7%，仍有改善空間'
        ],
        targetMembers: '近 30 天消費 3-4 次、金額 1,500+ 元的 7 位臨打客',
        suggestedPromotions: [
          '儲值 3,000 元加贈 500 元方案',
          '首次儲值送 10% 額外優惠'
        ],
        suggestedLineMessages: [
          '🎾 你是我們的常客！儲值 3,000 送 500，划算又方便 👉 立即儲值',
          '💚 累積消費金額已達 1,600 元，建議改用儲值省更多！本月新客加贈 10% 👉 一起來儲值'
        ],
        estimatedRevenue: '若 5 位會員轉換儲值，增加現金流 15,000 元。預估轉換率達 71%（比行業平均高 3 倍），月營收增加潛力達 25,000 元。',
        trackedMetrics: ['儲值轉換率', '儲值客單價', '會員 ARPU', '60 天留存率'],
        risksAndWarnings: [
          '勿對已儲值會員推送「轉儲值」訊息，應事先篩選目標客群',
          '首次儲值優惠應設定使用期限（30～45 天），避免永遠積壓'
        ]
      },
      'default': {
        dataSummary: `分析期間共有 120 位會員，預約 285 次，營收 120,000 元。活躍會員 68 位（近 30 天有消費），沉睡會員 15 位。`,
        mainFindings: [
          '會員整體活躍度相對穩定，每周預約數維持 65-72 次',
          '最需要改善的是首次消費會員的回訪率，目前僅 42.5%',
          '高價值會員（前 20%）貢獻 80% 營收，應成為重點經營對象'
        ],
        targetMembers: '首次消費後 14-60 天未回訪的新客，約 28 位',
        suggestedPromotions: [
          '新客回訪優惠：第二次消費享 85 折',
          '沉睡會員喚回：依過去時段推送個人化優惠'
        ],
        suggestedLineMessages: [
          '👋 我們想念你！上次消費後優惠，現在回訪享 85 折 👉 立即預約',
          '🎾 你喜歡的時段，現在有特別優惠～下午時段限時 75 折 👉 一起來打球'
        ],
        estimatedRevenue: '若回訪率從 42.5% 提升至 55%，月營收可增加 8,000-10,000 元。',
        trackedMetrics: ['新客回訪率', '回訪預約轉換', '人均 ARPU', '客戶滿意度'],
        risksAndWarnings: [
          '不同會員群需要不同的喚回策略，勿一視同仁',
          '優惠設計應考慮季節性與場館淨營收，不要過度折扣'
        ]
      }
    }

    const response = mockResponses[input.painPoint] || mockResponses['default']

    return {
      ...response,
      loadingTime: 1500
    }
  }

  async generateLineMessage(painPoint: string, memberCount: number): Promise<string> {
    const templates = {
      'off-peak-fill': `📍 下午空場補位！本週二三四下午 12-17 點享 75 折，限定 ${memberCount} 位會員 👉 立即預約`,
      'casual-to-prepay': `🎾 你是我們的常客！儲值 3,000 送 500，${memberCount} 位會員已受惠 👉 立即儲值`,
      'card-renewal': `📅 季卡即將到期！續約享 9 折 + 專屬福利，${memberCount} 位會員已續約 👉 立即續約`,
      'default': `💚 專為你設計的優惠方案！立即查看 👉 點擊連結`
    }
    return templates[painPoint] || templates['default']
  }

  async generateCommunicationPlan(painPoint: string, memberData: any): Promise<string> {
    return `溝通計畫：針對「${painPoint}」在未來 7 天內通過 LINE 推播向符合條件的會員發送個人化訊息，預期轉換率達 50-60%。`
  }
}

// LLM Window Provider Adapter - 後續實裝
export class LLMWindowMemberOperationsAIProvider implements MemberOperationsAIProvider {
  private apiEndpoint: string

  constructor(apiEndpoint: string = '/api/ai/member-operations') {
    this.apiEndpoint = apiEndpoint
  }

  async analyzeMemberOperations(input: MemberOperationsInput): Promise<AIAnalysisResult> {
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })

    if (!response.ok) {
      throw new Error(`AI API 錯誤: ${response.status}`)
    }

    return response.json()
  }

  async generateLineMessage(painPoint: string, memberCount: number): Promise<string> {
    const response = await fetch(`${this.apiEndpoint}/line-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ painPoint, memberCount })
    })

    return response.text()
  }

  async generateCommunicationPlan(painPoint: string, memberData: any): Promise<string> {
    const response = await fetch(`${this.apiEndpoint}/communication-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ painPoint, memberData })
    })

    return response.text()
  }
}

// 預設使用 Mock Provider（後續可切換為 LLM Window）
export const memberOperationsAIProvider: MemberOperationsAIProvider = new MockMemberOperationsAIProvider()
