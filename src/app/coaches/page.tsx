import type { Metadata } from 'next'
import { images } from '@/config/site'
import { CoachClassClient } from './coach-class-client'
import { defaultCoaches } from './coaches.data'
import styles from './coaches.module.css'

export const metadata: Metadata = {
  title: '教練課堂',
  description: '認識大新店森林匹克球的教練，查看專長、教學風格與適合對象，並透過 LINE 與教練聯絡。',
}

export default function CoachClassPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero} style={{ backgroundImage: `url('${images.hero.src}')` }}>
        <div className={styles.heroInner}>
          <h1 className={styles.heroTitle}>
            <span className={styles.slash} aria-hidden />
            教練課堂
          </h1>
          <p className={styles.heroSub}>教練介紹</p>
        </div>
      </header>

      <div className={styles.body}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.slash} aria-hidden />
          認識我們的教練
        </h2>

        <CoachClassClient coaches={defaultCoaches} />

        <p className={styles.notice}>
          <strong>如何與教練聯絡？</strong>
          點選教練卡片上的「聯絡教練」，即可透過 LINE 與教練直接洽談課程內容與上課安排。
        </p>
      </div>
    </div>
  )
}
