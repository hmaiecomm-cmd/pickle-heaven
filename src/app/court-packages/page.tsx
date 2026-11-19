import type { Metadata } from 'next'
import { images } from '@/config/site'
import { CourtPackageHero } from './components/CourtPackageHero'
import { CourtPackagesClient } from './components/CourtPackagesClient'
import styles from './court-packages.module.css'

export const metadata: Metadata = {
  title: '場地包期',
  description: '彈性選擇場地包期方案。短期試用、半年常規、年度優惠，根據您的使用需求找到最適合的方案。',
}

/**
 * 場地包期頁面
 * 
 * 展示三種場地包期方案，包括：
 * - 短期方案（30天，10次）
 * - 半年方案（6個月，48次）
 * - 年度方案（12個月，104次）
 * 
 * 功能：
 * - 使用需求下拉選單，篩選推薦方案
 * - 推薦方案卡片，可展開詳細資訊
 * - 方案比較表，對比各方案特性
 * - LINE 聯絡區塊，引導用戶聯繫場館
 */
export default function CourtPackagesPage() {
  return (
    <div className={styles.page}>
      <CourtPackageHero backgroundImage={images.hero.src} />
      <CourtPackagesClient />
    </div>
  )
}
