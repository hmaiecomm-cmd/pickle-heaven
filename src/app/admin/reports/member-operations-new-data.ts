// 新版會員經營頁面數據配置

import type { MemberSegmentType, KpiMetric, DemoContent } from './member-operations-new-types'

export function getKpiMetrics(segment: MemberSegmentType): KpiMetric[] {
  const baseMetrics: KpiMetric[] = [
    { name: '會員總數', value: 3892, change: 6.8, trend: 'up', color: 'green' },
    { name: '新增會員', value: 1964, change: 9.3, trend: 'up', color: 'green' },
    { name: '活躍會員', value: 3428, change: 4.7, trend: 'up', color: 'green' },
    { name: '預約場次', value: 4428, change: 4.7, trend: 'up', color: 'blue' },
    { name: 'No-show 率', value: 5.8, change: -1.9, trend: 'down', color: 'red' },
    { name: '取消率', value: 8.6, change: -2.1, trend: 'down', color: 'red' }
  ]

  // 根據分群調整部分指標
  switch (segment) {
    case 'no-show-cancel':
      return [
        { name: '會員總數', value: 3892, change: 6.8, trend: 'up', color: 'green' },
        { name: 'No-show 會員', value: 285, change: -8.5, trend: 'down', color: 'green' },
        { name: '取消會員', value: 412, change: -12.3, trend: 'down', color: 'green' },
        { name: '高風險會員', value: 68, change: -15.4, trend: 'down', color: 'green' },
        { name: 'No-show 率', value: 5.8, change: -1.9, trend: 'down', color: 'red' },
        { name: '取消率', value: 8.6, change: -2.1, trend: 'down', color: 'red' }
      ]
    case 'line-binding':
      return [
        { name: 'LINE 綁定會員', value: 2854, change: 12.5, trend: 'up', color: 'blue' },
        { name: '推播開啟率', value: 68.5, change: 5.2, trend: 'up', color: 'blue' },
        { name: '點擊率', value: 24.8, change: 3.1, trend: 'up', color: 'blue' },
        { name: '訊息轉換率', value: 12.4, change: 2.8, trend: 'up', color: 'blue' },
        { name: '未綁定會員', value: 1038, change: -5.3, trend: 'down', color: 'gray' },
        { name: '點擊無轉換', value: 456, change: -8.2, trend: 'down', color: 'red' }
      ]
    case 'retention':
      return [
        { name: '活躍會員', value: 3428, change: 4.7, trend: 'up', color: 'green' },
        { name: '首次回訪率', value: 68.5, change: 7.2, trend: 'up', color: 'green' },
        { name: '30 天回訪率', value: 52.3, change: 4.5, trend: 'up', color: 'green' },
        { name: '90 天回訪率', value: 38.9, change: 3.1, trend: 'up', color: 'green' },
        { name: '沉睡會員', value: 464, change: -11.2, trend: 'down', color: 'red' },
        { name: '流失會員', value: 189, change: -8.5, trend: 'down', color: 'red' }
      ]
    default:
      return baseMetrics
  }
}

export function getDemoContent(segment: MemberSegmentType): DemoContent | null {
  const demoMap: Record<MemberSegmentType, DemoContent> = {
    'all': {
      title: '會員經營概況',
      status: '會員整體活躍度穩定，每周預約數維持 300-350 次，營收約 120,000 元。',
      causes: ['新會員帶動成長', '老會員逐漸流失', '季節性波動影響'],
      actions: ['加強新會員首次體驗', '老會員定期回訪方案', '季節性優惠規劃'],
      metrics: ['會員成長率', '活躍會員比例', '人均 ARPU', '會員滿意度']
    },
    'no-show-cancel': {
      title: '降低 No-show 與取消率',
      status: '部分會員 No-show 或臨時取消率偏高，影響場館營收與排程。',
      causes: ['預約後缺少提醒', '會員對預約責任認知不足', '取消政策不夠明確', '沉睡會員缺乏回訪誘因'],
      actions: ['預約後 24 小時與 1 小時前發送 LINE 提醒', '對首次 No-show 會員發送溫和提醒', '對重複 No-show 要求預付款', '對沉睡會員提供回訪優惠'],
      metrics: ['No-show 率', '取消率', '會員回訪率', 'LINE 訊息開啟率', '預約轉換率']
    },
    'line-binding': {
      title: 'LINE 綁定與推播成效',
      status: '部分會員尚未綁定 LINE，無法進行精準推播與提醒。',
      causes: ['綁定流程不清楚', '會員對權益認知不足', '通知頻率過高導致取消', '推播內容與個人偏好不符'],
      actions: ['簡化 LINE 綁定流程與引導說明', '強調綁定後的專屬優惠與提醒', '個性化推播內容與時段', '定期評估推播轉換率並優化'],
      metrics: ['LINE 綁定率', '推播開啟率', '點擊率', '轉換率', '取消訂閱率']
    },
    'retention': {
      title: '提升會員回訪率',
      status: '首次消費會員回訪率偏低，長期會員逐漸流失。',
      causes: ['首次消費後缺乏後續互動', '沒有個性化的回訪方案', '競爭對手吸引', '時段或服務不符需求'],
      actions: ['首次消費後 3-7 天發送感謝訊息與回訪優惠', '根據消費時段推薦相似時段優惠', '提供會員專屬活動與福利', '定期發送個人化推薦'],
      metrics: ['首次回訪率', '30 天回訪率', '重複消費頻率', '會員留存率', '流失會員數']
    },
    'dormant-recovery': {
      title: '喚回沉睡會員',
      status: '沉睡會員數量增加，代表經營品質下降。',
      causes: ['缺乏定期聯繫', '時段或服務調整未通知', '消費價格上升', '競爭對手優惠'],
      actions: ['對 30 天未來會員發送溫和重啟訊息', '提供特別回訪優惠與誘因', '根據過去消費習慣推薦時段', '調查流失原因並改善'],
      metrics: ['沉睡會員數', '喚回率', '重新活躍會員', '流失原因分析', '回訪 ROI']
    },
    'high-value': {
      title: '高價值會員經營',
      status: '高價值會員佔比 20%，貢獻 80% 營收，應成為重點經營對象。',
      causes: ['高價值會員滿意度差異大', '缺乏專屬服務與關懷', '流失風險高', '轉介紹潛力未開發'],
      actions: ['建立 VIP 會員專屬服務與優先訂場', '定期個人化溝通與關懷', '提供轉介紹獎勵方案', '邀請參與會員意見反饋'],
      metrics: ['高價值會員數', '留存率', '消費金額成長', '轉介紹數', '滿意度評分']
    },
    'member-segmentation': {
      title: '會員分群與精準推播',
      status: '會員分群明確，可針對不同群體進行精準推播與優惠設計。',
      causes: [],
      actions: ['根據消費頻率分群進行不同優惠策略', '根據時段偏好推送相關優惠', '針對不同身份提供專屬服務', '持續監測各分群表現與調整'],
      metrics: ['各分群人數', '各分群轉換率', '分群留存率', '推播成效差異', '分群 ARPU']
    }
  }

  return demoMap[segment]
}
