import styles from './storefront.module.css'

/** Thin top utility strip — uppercase, letterspaced micro-copy. The first thing
 *  the editorial references (Tofifi) show. Tenant-themed via tokens. */
export function UtilityBar({ text = 'Drop in eller boka online' }: { text?: string }) {
  return (
    <div className={styles.utilityBar} role="note">
      <span className={styles.utilityText}>{text}</span>
    </div>
  )
}
