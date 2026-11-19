'use client'

import React from 'react'
import { getRecommendedPackages, type CourtPackage } from '../court-packages.data'
import type { UserNeed } from './NeedSelector'
import { PlanCard } from './PlanCard'
import styles from '../court-packages.module.css'

export interface RecommendedPlansProps {
  userNeed: UserNeed
}

/**
 * 推薦方案區塊
 * 根據用戶的使用需求顯示推薦的方案
 */
export function RecommendedPlans({ userNeed }: RecommendedPlansProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const recommendedPackages = getRecommendedPackages(userNeed)

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <section>
      <h2 className={styles.sectionTitle}>
        <span className={styles.slash} aria-hidden />
        推薦方案
      </h2>

      <div className={styles.plansContainer}>
        {recommendedPackages.map((pkg) => (
          <PlanCard
            key={pkg.id}
            package={pkg}
            expanded={expandedId === pkg.id}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>
    </section>
  )
}
