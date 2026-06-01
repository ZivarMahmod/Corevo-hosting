import type { OnboardingStep, OnboardingStatus } from '@/lib/platform/tenants'
import styles from './platform.module.css'

const STEP_CLASS: Record<OnboardingStatus, string> = {
  done: styles.stepDone ?? '',
  todo: styles.stepTodo ?? '',
  locked: styles.stepLocked ?? '',
}
const MARK: Record<OnboardingStatus, string> = {
  done: '✓ Klart',
  todo: '● Att göra',
  locked: '🔒 Spärrad',
}

/** Renders the 6-step onboarding ladder with colour-coded status (server-only). */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  return (
    <ol className={styles.checklist}>
      {steps.map((s) => (
        <li key={s.key} className={`${styles.step} ${STEP_CLASS[s.status]}`}>
          <span className={styles.stepNum}>{s.step}</span>
          <span className={styles.stepBody}>
            <span className={styles.stepLabel}>{s.label}</span>
            <span className={styles.stepDetail}>{s.detail}</span>
          </span>
          <span className={styles.stepMark}>{MARK[s.status]}</span>
        </li>
      ))}
    </ol>
  )
}
