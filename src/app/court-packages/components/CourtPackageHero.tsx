import styles from '../court-packages.module.css'

export interface CourtPackageHeroProps {
  backgroundImage: string
}

/**
 * 場地包期頁面主視覺區塊
 * 展示背景圖、頁面標題與副標題
 */
export function CourtPackageHero({ backgroundImage }: CourtPackageHeroProps) {
  return (
    <header className={styles.hero} style={{ backgroundImage: `url('${backgroundImage}')` }}>
      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>
          <span className={styles.slash} aria-hidden />
          場地包期
        </h1>
        <p className={styles.heroSub}>靈活選擇，享受優惠</p>
      </div>
    </header>
  )
}
