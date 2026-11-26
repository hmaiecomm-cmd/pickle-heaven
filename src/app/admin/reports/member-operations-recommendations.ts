import type { OperationTheme, OperationRecommendation } from './member-operations-types'

export const PAIN_POINT_RECOMMENDATIONS: Record<OperationTheme, OperationRecommendation> = {
  'off-peak-fill': {
    theme: 'off-peak-fill',
    currentStatus: '平日下午使用率偏低，但平日晚間已接近滿場。未充分利用場地資源。',
    possibleCauses: [
      '會員多集中在晚間與假日時段',
      '下午時段缺乏宣傳與推廣',
      '會員對下午時段認知不足'
    ],
    suggestedActions: [
      '針對近 30 天曾在平日下午消費、但本週尚未預約的會員，推送 75 折離峰優惠',
      '針對過去常在晚間消費的會員，提供「早上運動 + 晚間運動」套餐折扣',
      '在每週二、三、四下午提供額外優惠，吸引新客體驗'
    ],
    suggestedPromotions: [
      { name: '下午時段 75 折', discount: 25, condition: '12:00～17:00 預約' },
      { name: '早晚雙場套票', discount: 20, condition: '同日預約上下午' }
    ],
    targetMembers: '近 30 天有下午消費紀錄但本週未預約的會員',
    trackedMetrics: ['離峰使用率', '推播轉換率', '優惠後實收營收', '30 天回訪率']
  },
  'casual-to-prepay': {
    theme: 'casual-to-prepay',
    currentStatus: '有部分會員近期消費頻率高 (3+ 次/月)，但仍以單次付款為主。',
    possibleCauses: [
      '會員對儲值方案認知不足',
      '儲值優惠吸引力不夠',
      '首次儲值流程複雜或風險認知'
    ],
    suggestedActions: [
      '針對近 30 天消費 3 次以上的會員，推送「儲值 3,000 加贈 500」方案',
      '提供首次儲值會員額外 10% 優惠與退款保證',
      '在預約流程中提示儲值優惠與節省金額計算'
    ],
    suggestedPromotions: [
      { name: '儲值 3,000 加贈 500', discount: 15, condition: '首次儲值' },
      { name: '月度儲值者返現', discount: 10, condition: '單月消費滿 10 次' }
    ],
    targetMembers: '近 30 天消費 3 次以上但未儲值的會員',
    trackedMetrics: ['儲值轉換率', '儲值金額', '會員 ARPU', '60 天回訪率']
  },
  'card-renewal': {
    theme: 'card-renewal',
    currentStatus: '部分季卡會員即將到期，需提前提醒與激勵以提高續約率。',
    possibleCauses: [
      '會員未收到到期提醒',
      '季卡方案缺乏吸引力或價值感不足',
      '續約流程不便利'
    ],
    suggestedActions: [
      '在季卡到期前 14 天發送提醒，同時提供 10% 續約折扣',
      '針對過期但曾活躍的會員，推送「復活方案」（限時優惠回歸）',
      '提供續約會員額外福利（優先訂場、專屬教練時段）'
    ],
    suggestedPromotions: [
      { name: '季卡續約 9 折', discount: 10, condition: '到期前 14 天' },
      { name: '復活回歸方案', discount: 30, condition: '過期會員限時專案' }
    ],
    targetMembers: '季卡即將到期 (14 天內) 或已過期的會員',
    trackedMetrics: ['季卡續約率', '回歸會員數', '續約後 90 天留存', '實收營收']
  },
  'dormant-recovery': {
    theme: 'dormant-recovery',
    currentStatus: '部分會員超過 30 天未消費，且過去有固定預約時段。存在喚回機會。',
    possibleCauses: [
      '會員臨時排期滿檔或休閒時間減少',
      '感受不到場館重視',
      '競爭對手吸引',
      '價格或服務感知下降'
    ],
    suggestedActions: [
      '依會員過去常用時段發送個人化回訪訊息，不要對所有沉睡會員發送相同折扣',
      '提供「我們想念你」個人化優惠（基於過去消費金額等級）',
      '邀請會員參與新活動或教練課程，重新建立連結'
    ],
    suggestedPromotions: [
      { name: '個人化回訪折扣', discount: 20, condition: '沉睡 30+ 天會員' },
      { name: '專屬重啟方案', discount: 25, condition: '高價值沉睡會員' }
    ],
    targetMembers: '超過 30 天未消費的曾活躍會員',
    trackedMetrics: ['喚回率', '回訪預約數', '優惠成本', '喚回後 30 天留存']
  },
  'organizer-analysis': {
    theme: 'organizer-analysis',
    currentStatus: '識別出主揪會員 (帶客 3+ 人) 與高頻訂場會員。',
    possibleCauses: [],
    suggestedActions: [
      '針對主揪會員提供「帶客獎勵」方案，每帶 1 新客獎勵 100 元商城額度',
      '提供主揪會員優先訂場權與專屬時段預留',
      '建立「主揪會員」VIP 社群，分享內部優惠與新活動'
    ],
    suggestedPromotions: [
      { name: '帶客獎勵方案', discount: 0, condition: '每帶 1 新客獎勵 100 元' },
      { name: '主揪 VIP 月卡', discount: 15, condition: '主揪會員專屬' }
    ],
    targetMembers: '近 30 天帶客 3 人以上的主揪會員',
    trackedMetrics: ['主揪帶客數', '團隊消費額', '新客留存率', '主揪滿意度']
  },
  'noshowm-manage': {
    theme: 'noshowm-manage',
    currentStatus: '部分會員 No-show 或臨時取消率偏高，影響場館營收與排程。',
    possibleCauses: [
      '預約流程無提醒機制',
      '會員對預約責任認知不足',
      '場館政策不夠明確'
    ],
    suggestedActions: [
      '在預約後 24 小時與 1 小時前發送提醒通知（含 LINE 推播）',
      '首次 No-show 發送溫和提醒，再次 No-show 發送政策說明',
      '對累計 3 次 No-show 的會員，要求「預付款」或「限制預約數量」'
    ],
    suggestedPromotions: [
      { name: '守時會員獎勵', discount: 0, condition: '90 天零 No-show 折扣' }
    ],
    targetMembers: '近 30 天 No-show 或取消率 > 20% 的會員',
    trackedMetrics: ['No-show 率', '取消率', '守時會員數', '場館利用率']
  },
  'line-binding': {
    theme: 'line-binding',
    currentStatus: '部分會員尚未綁定 LINE，無法接收推播優惠與提醒。',
    possibleCauses: [
      '未在簽約流程中強制綁定',
      '會員不知道綁定 LINE 的好處',
      'LINE 綁定流程不便利'
    ],
    suggestedActions: [
      '在簽約/支付流程中加入 LINE 綁定提醒',
      '對未綁定會員推送「綁定 LINE 送 100 元折扣」方案',
      '透過簡訊或 Email 重點告知 LINE 綁定優惠'
    ],
    suggestedPromotions: [
      { name: 'LINE 綁定新客禮', discount: 10, condition: '首次綁定送折扣' }
    ],
    targetMembers: '未綁定 LINE 的全部會員',
    trackedMetrics: ['LINE 綁定率', '綁定推廣轉換率', '推播觸達率', '推播轉換率']
  },
  'retention': {
    theme: 'retention',
    currentStatus: '首次消費會員的回訪率低於 45%。',
    possibleCauses: [
      '首次消費體驗不佳',
      '缺乏持續溝通與優惠',
      '未及時建立會員檔案與推薦'
    ],
    suggestedActions: [
      '在首次消費後 3 天內發送感謝訊息與新客優惠（第二次 85 折）',
      '針對首次消費但未回訪的會員，推送「我們想念你」個人化優惠',
      '邀請新客加入 LINE 與社群，建立長期互動'
    ],
    suggestedPromotions: [
      { name: '新客第二次優惠', discount: 15, condition: '首次消費後 7 天內' }
    ],
    targetMembers: '首次消費後 14～60 天未回訪的新客',
    trackedMetrics: ['新客回訪率', '二次消費轉換率', '新客 LTV', '30 天留存率']
  },
  'high-value': {
    theme: 'high-value',
    currentStatus: '識別出消費金額在前 20% 的高價值會員。',
    possibleCauses: [],
    suggestedActions: [
      '針對高價值會員提供「VIP 專屬優惠」與「優先訂場權」',
      '定期發送高價值會員專屬活動邀請',
      '建立 VIP 顧客支援，主動了解需求與滿意度'
    ],
    suggestedPromotions: [
      { name: 'VIP 會員禮遇', discount: 0, condition: 'VIP 會員專屬權益' }
    ],
    targetMembers: '消費金額在前 20% 的高價值會員',
    trackedMetrics: ['高價值會員 ARPU', 'VIP 滿意度', '續約率', '推薦度']
  },
  'member-segmentation': {
    theme: 'member-segmentation',
    currentStatus: '會員分布在 8～10 個細分群體，需針對不同群體進行精準推播。',
    possibleCauses: [],
    suggestedActions: [
      '按會員身份 (臨打客、儲值、季卡、主揪) 推送對應優惠',
      '按時段偏好 (早晨、下午、晚間、假日) 推送對應優惠',
      '按消費頻率 (高頻、中頻、低頻) 推送對應復興方案'
    ],
    suggestedPromotions: [
      { name: '分群精準優惠', discount: 15, condition: '針對不同會員群' }
    ],
    targetMembers: '全部會員 (依分群推送)',
    trackedMetrics: ['分群轉換率', '推播精準度', '群體 ARPU', '整體回訪率']
  }
}

export function getRecommendationForTheme(theme: OperationTheme): OperationRecommendation {
  return PAIN_POINT_RECOMMENDATIONS[theme] || PAIN_POINT_RECOMMENDATIONS['off-peak-fill']
}
