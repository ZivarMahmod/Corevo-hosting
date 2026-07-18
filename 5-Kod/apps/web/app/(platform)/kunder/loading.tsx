import { PageSkeleton } from '@/components/platform/PlatformSkeleton'
import styles from '@/components/platform/kunder-v2.module.css'

export default function Loading() {
  return (
    <div className={`workbench ${styles.board} ${styles.boardState}`}>
      <div className={styles.pane}>
        <div className={styles.paneInner}>
          <PageSkeleton table />
        </div>
      </div>
    </div>
  )
}
