'use client'

import React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CourtPackage } from '../court-packages.data'
import styles from '../court-packages.module.css'

export interface PlanCardProps {
  package: CourtPackage
  expanded?: boolean
  onToggleExpand?: (id: string) => void
}

/**
 * 方案卡片組件
 * 展示方案名稱、描述、有效期間、包含使用、優勢、適合對象
 * 支援展開詳細資訊
 */
export function PlanCard({ package: pkg, expanded = false, onToggleExpand }: PlanCardProps) {
  return (
    <article className={cn(styles.planCard, pkg.featured && styles.planCardFeatured)}>
      <div className={styles.planHeader}>
        <h3 className={styles.planName}>{pkg.name}</h3>
        <p className={styles.planDescription}>{pkg.description}</p>

        <div className={styles.planValidity}>
          <span className={styles.planValidityLabel}>有效期間</span>
          <span>{pkg.validity}</span>
        </div>

        <div className={styles.planUsage}>
          <strong>包含使用：</strong>
          {pkg.includedUsage}
        </div>
      </div>

      <div className={styles.planAdvantages}>
        <strong>方案優勢：</strong>
        {pkg.advantages.map((advantage, index) => (
          <div key={index} className={styles.planAdvantageItem}>
            <span className={styles.planAdvantageIcon}>✓</span>
            <span>{advantage}</span>
          </div>
        ))}
      </div>

      <div className={styles.planSuitableFor}>
        <span className={styles.planSuitableForLabel}>適合對象：</span>
        {pkg.suitableFor}
      </div>

      {onToggleExpand && (
        <button
          type="button"
          onClick={() => onToggleExpand(pkg.id)}
          aria-expanded={expanded}
          className={styles.detailsToggle}
        >
          <span>
            {expanded ? '隱藏詳細' : '查看詳細'}
          </span>
          <ChevronDown className={styles.detailsToggleIcon} size={20} aria-hidden />
        </button>
      )}

      {expanded && (
        <div className={styles.detailsContent}>
          <p>
            此方案提供彈性的場地預約安排，所有優勢均包含在內。
            如有任何疑問，歡迎透過 LINE 與我們聯絡。
          </p>
        </div>
      )}
    </article>
  )
}
