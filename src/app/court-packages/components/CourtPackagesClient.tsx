'use client'

import React from 'react'
import { NeedSelector, type UserNeed } from './NeedSelector'
import { RecommendedPlans } from './RecommendedPlans'
import { ComparisonTable } from './ComparisonTable'
import { ContactSection } from './ContactSection'
import styles from '../court-packages.module.css'

/**
 * 場地包期頁面客戶端容器
 * 管理使用需求選擇與推薦方案的交互邏輯
 */
export function CourtPackagesClient() {
  const [userNeed, setUserNeed] = React.useState<UserNeed>('casual')

  return (
    <div className={styles.body}>
      <NeedSelector value={userNeed} onChange={setUserNeed} />

      <RecommendedPlans userNeed={userNeed} />

      <ComparisonTable />

      <ContactSection />

      <p className={styles.notice}>
        <strong>選擇方案後的下一步？</strong>
        透過本頁面的 LINE 聯絡按鈕與我們聯繫，確認購買意願與細節，
        我們會引導您完成方案購買與帳戶設定。
      </p>
    </div>
  )
}
