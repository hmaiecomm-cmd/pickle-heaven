import { contact } from '@/config/site'
import { cn } from '@/lib/utils'
import styles from '../court-packages.module.css'

/**
 * LINE 聯絡區塊
 * 提供 LINE 聯絡按鈕，引導用戶與場館聯絡
 */
export function ContactSection() {
  const content = (
    <>
      <span>聯絡場館</span>
      <span className={styles.divider} aria-hidden />
      <span className={styles.lineSub}>
        <span className={styles.lineIcon} aria-hidden>
          LINE
        </span>
        透過 LINE 洽談
      </span>
    </>
  )

  return (
    <section className={styles.contactSection}>
      <h2 className={styles.contactTitle}>
        對方案有疑問？
      </h2>

      <p className={styles.contactDescription}>
        每種方案都有不同的優勢與適用場景。
        若想了解哪個方案最適合您，歡迎透過 LINE 與我們直接洽談，
        我們會根據您的需求提供最佳建議。
      </p>

      {contact.lineUrl ? (
        <a
          href={contact.lineUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="透過 LINE 聯絡場館（另開視窗）"
          className={styles.lineBtn}
        >
          {content}
        </a>
      ) : (
        <div>
          <span
            role="link"
            aria-disabled="true"
            aria-label="LINE 聯絡連結尚未設定"
            className={cn(styles.lineBtn, styles.lineBtnDisabled)}
          >
            {content}
          </span>
          <p className={styles.lineNote}>LINE 聯絡連結尚未設定</p>
        </div>
      )}
    </section>
  )
}
