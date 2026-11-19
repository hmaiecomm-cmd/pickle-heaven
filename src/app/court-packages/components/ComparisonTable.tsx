import { comparisonData } from '../court-packages.data'
import styles from '../court-packages.module.css'

/**
 * 方案比較表
 * 展示所有方案在各項特性上的對比
 */
export function ComparisonTable() {
  return (
    <section className={styles.comparisonSection}>
      <h2 className={styles.comparisonTitle}>
        <span className={styles.slash} aria-hidden />
        方案詳細對比
      </h2>

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.comparisonTable}>
          <thead>
            <tr>
              <th className={styles.comparisonFeature}>特性</th>
              <th>短期方案</th>
              <th>半年方案</th>
              <th>年度方案</th>
            </tr>
          </thead>
          <tbody>
            {comparisonData.map((row) => (
              <tr key={row.feature}>
                <td className={styles.comparisonFeature}>{row.feature}</td>
                <td className={styles.comparisonValue}>{row.shortTerm}</td>
                <td className={styles.comparisonValue}>{row.halfYear}</td>
                <td className={styles.comparisonValue}>{row.annual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
