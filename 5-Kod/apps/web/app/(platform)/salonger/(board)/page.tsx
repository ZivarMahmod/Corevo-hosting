import type { Metadata } from 'next'
import { Card, Icon } from '@/components/portal/ui'
import styles from '@/components/platform/salonger-v2.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Kunder' }

export default function TenantsPage() {
  return (
    <div className={styles.pane}>
      <div className={`${styles.paneInner} ${styles.prompt}`}>
        <Card>
          <Icon name="users" size={24} />
          <h1 style={{ margin: '12px 0 6px' }}>Välj en kund</h1>
          <p style={{ margin: 0, color: 'var(--c-ink-3)' }}>
            Välj en kund i listan för att öppna kundkortet och dess verktyg.
          </p>
        </Card>
      </div>
    </div>
  )
}
