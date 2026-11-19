'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import styles from '../court-packages.module.css'

export type UserNeed = 'casual' | 'regular' | 'competitive'

export interface NeedSelectorProps {
  value: UserNeed
  onChange: (need: UserNeed) => void
}

const needOptions: Array<{ value: UserNeed; label: string; description: string }> = [
  {
    value: 'casual',
    label: '休閒體驗',
    description: '偶爾打球，享受運動樂趣'
  },
  {
    value: 'regular',
    label: '固定打球',
    description: '每月固定打球，建立習慣'
  },
  {
    value: 'competitive',
    label: '比賽訓練',
    description: '高頻率預約，參加比賽與訓練'
  }
]

/**
 * 使用需求下拉選單
 * 允許用戶選擇其使用場景，以便篩選合適的推薦方案
 */
export function NeedSelector({ value, onChange }: NeedSelectorProps) {
  return (
    <div className={styles.selectorGroup}>
      <label htmlFor="need-selector" className={styles.selectorLabel}>
        請選擇您的使用需求
      </label>
      <fieldset className={styles.selectorControl}>
        <legend className="sr-only">使用需求</legend>
        {needOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            id={`need-${option.value}`}
            aria-checked={value === option.value}
            aria-label={`${option.label}：${option.description}`}
            className={cn(styles.selectorButton, value === option.value && styles.active)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </fieldset>
    </div>
  )
}
