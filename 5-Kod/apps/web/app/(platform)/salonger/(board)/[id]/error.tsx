'use client'

import { PlatformError } from '@/components/platform/PlatformError'
import styles from '@/components/platform/salonger-v2.module.css'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.pane}>
      <div className={styles.paneInner}>
        <PlatformError
          title="Kunde inte ladda kunden"
          message="Kundens detaljer gick inte att hämta just nu. Försök igen."
          reset={reset}
        />
      </div>
    </div>
  )
}
