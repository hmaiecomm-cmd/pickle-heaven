'use client'

import * as React from 'react'
import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CoachProfile } from './coaches.data'
import styles from './coaches.module.css'

const PANEL_ID = 'coach-featured'

export function CoachClassClient({ coaches }: { coaches: CoachProfile[] }) {
  const [selectedId, setSelectedId] = React.useState(coaches[0]?.id ?? '')
  const featuredRef = React.useRef<HTMLElement>(null)
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])
  const selected = coaches.find((c) => c.id === selectedId) ?? coaches[0]

  const select = (id: string) => {
    setSelectedId(id)
    if (window.matchMedia('(max-width: 767px)').matches) {
      featuredRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (index + delta + coaches.length) % coaches.length
    tabRefs.current[next]?.focus()
    select(coaches[next].id)
  }

  if (!selected) return null

  return (
    <>
      <section
        ref={featuredRef}
        id={PANEL_ID}
        role="tabpanel"
        aria-live="polite"
        aria-labelledby={`coach-tab-${selected.id}`}
        className={styles.featured}
      >
        <CoachPhoto coach={selected} className={styles.featuredPhoto} />
        <div>
          <h3 className={styles.featuredName}>
            <span className={styles.slash} aria-hidden />
            {selected.name}
            <span className={styles.badge}>目前選取</span>
          </h3>
          <dl className={styles.facts}>
            <Fact label="教練專長" value={selected.specialty.join('、')} />
            <Fact label="教學風格" value={selected.teachingStyle.join('、')} />
            <Fact label="適合對象" value={selected.suitableFor.join('、')} />
            <Fact label="教學經驗" value={selected.experience} />
          </dl>
          <p className={styles.intro}>{selected.introduction}</p>
          <div className={styles.featuredContact}>
            <LineContactButton coach={selected} />
          </div>
        </div>
      </section>

      <div role="tablist" aria-label="選擇教練" aria-orientation="horizontal" className={styles.list}>
        {coaches.map((coach, index) => {
          const active = coach.id === selected.id
          return (
            <div key={coach.id} role="presentation" className={cn(styles.card, active && styles.cardSelected)}>
              <button
                ref={(el) => {
                  tabRefs.current[index] = el
                }}
                id={`coach-tab-${coach.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={PANEL_ID}
                aria-label={`${coach.name}，專長：${coach.specialty.join('、')}${active ? '，目前選取' : ''}`}
                tabIndex={active ? 0 : -1}
                onClick={() => select(coach.id)}
                onKeyDown={(e) => onTabKey(e, index)}
                className={styles.cardSelect}
              >
                <CoachPhoto coach={coach} className={styles.cardPhoto} />
                <span>
                  <span className={styles.cardHead}>
                    <span className={styles.cardName}>{coach.name}</span>
                    {active && <span className={styles.badge}>目前選取</span>}
                  </span>
                  <span className={cn(styles.cardText, 'block')}>{coach.specialty.join('、')}</span>
                  <span className={cn(styles.cardMeta, 'block')}>適合：{coach.suitableFor.join('、')}</span>
                </span>
              </button>
              <LineContactButton coach={coach} />
            </div>
          )
        })}
      </div>
    </>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{value}</dd>
    </div>
  )
}

function CoachPhoto({ coach, className }: { coach: CoachProfile; className?: string }) {
  return (
    <div className={cn(styles.photo, className)}>
      {coach.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coach.image} alt={`${coach.name}照片`} />
      ) : (
        <div className={styles.placeholder} role="img" aria-label={`${coach.name}照片（尚未上傳）`}>
          <UserRound className={styles.placeholderIcon} aria-hidden />
        </div>
      )}
    </div>
  )
}

function LineContactButton({ coach }: { coach: CoachProfile }) {
  const content = (
    <>
      <span>聯絡教練</span>
      <span className={styles.divider} aria-hidden />
      <span className={styles.lineSub}>
        <span className={styles.lineIcon} aria-hidden>
          LINE
        </span>
        透過 LINE 洽談
      </span>
    </>
  )

  if (!coach.lineUrl) {
    return (
      <div>
        <span role="link" aria-disabled="true" aria-label={`聯絡${coach.name}：LINE 聯絡連結尚未設定`} className={cn(styles.lineBtn, styles.lineBtnDisabled)}>
          {content}
        </span>
        <p className={styles.lineNote}>LINE 聯絡連結尚未設定</p>
      </div>
    )
  }

  return (
    <a href={coach.lineUrl} target="_blank" rel="noreferrer noopener" aria-label={`聯絡${coach.name}：透過 LINE 洽談（另開視窗）`} className={styles.lineBtn}>
      {content}
    </a>
  )
}
