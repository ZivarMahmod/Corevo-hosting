'use client'

import { useRouter } from 'next/navigation'
import type { StaffWithServices } from '@/lib/admin/data'
import styles from './admin.module.css'

/**
 * Navigates to ?staff=<id> so the server page loads that staff's schedule.
 * @deprecated goal-46 audit 2026-06-17: oanvänd build-once-dubblett. Ersatt av
 * SlotManager.tsx StaffChips (chip-navigering på /admin/scheman, §4.5-kanon —
 * chips, ej dropdown). Behålls (build-once-never-delete), ej raderad.
 */
export function StaffPicker({
  staff,
  selectedId,
  basePath,
}: {
  staff: StaffWithServices[]
  selectedId: string
  basePath: string
}) {
  const router = useRouter()
  return (
    <label className={styles.field} style={{ maxWidth: '20rem' }}>
      <span>Medarbetare</span>
      <select
        value={selectedId}
        onChange={(e) => router.push(`${basePath}?staff=${e.target.value}`)}
      >
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.displayName}
            {s.active ? '' : ' (inaktiv)'}
          </option>
        ))}
      </select>
    </label>
  )
}
