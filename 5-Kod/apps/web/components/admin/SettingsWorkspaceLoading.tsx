import styles from './settings-v2.module.css'
import { SETTINGS_GROUPS } from '@/lib/admin/settings-map'

export function SettingsWorkspaceLoading() {
  return (
    <section
      className={`${styles.root} ${styles.loading}`}
      aria-label="Inställningar laddas"
      aria-busy="true"
      data-accept="settings-loading"
    >
      <aside className={styles.nav}>
        <h1>Inställningar</h1>
        <div className={`${styles.search} ${styles.loadingBar}`} />
        {SETTINGS_GROUPS.map((group) => (
          <div className={styles.group} key={group}>
            <h2>{group}</h2>
            <div className={styles.loadingRow} />
            <div className={styles.loadingRow} />
          </div>
        ))}
      </aside>
      <div className={styles.paneWrap}>
        <div className={styles.pane}>
          <div className={`${styles.loadingBar} ${styles.loadingTitle}`} />
          <div className={`${styles.loadingBar} ${styles.loadingCopy}`} />
          <div className={`${styles.loadingBar} ${styles.loadingCard}`} />
        </div>
      </div>
    </section>
  )
}
