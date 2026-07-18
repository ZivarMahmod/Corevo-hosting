import { PageSkeleton } from '@/components/platform/PlatformSkeleton'
import styles from '@/components/platform/kunder-v2.module.css'

export default function Loading() {
  return (
    <div className={styles.pane}>
      <div className={styles.paneInner}>
        <PageSkeleton stats={4} table />
      </div>
    </div>
  )
}
