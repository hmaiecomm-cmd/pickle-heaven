'use client'

import * as React from 'react'
import type { ProductCategory } from '@/lib/types'
import styles from './category-filter.module.css'

interface CategoryFilterProps {
  categories: Array<{ value: ProductCategory | 'ALL'; label: string }>
  selectedCategory: ProductCategory | 'ALL'
  onCategoryChange: (category: ProductCategory | 'ALL') => void
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
}: CategoryFilterProps) {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (isMobile) {
    return (
      <div className={styles.filterContainer}>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value as ProductCategory | 'ALL')}
          className={styles.select}
        >
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className={styles.filterContainer}>
      <div className={styles.filterButtons}>
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            className={`${styles.filterButton} ${
              selectedCategory === cat.value ? styles.filterButtonActive : ''
            }`}
            aria-pressed={selectedCategory === cat.value}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  )
}
