'use client'

import type { LocationRow } from '@/lib/admin/data'
import styles from './admin.module.css'

/**
 * Per-location scope for a schedule row (VÅG 4b). The chosen location is what the
 * booking engine keys availability off (working_hours / working_hour_slots
 * .location_id), so the owner picks WHICH place these hours/slots apply to.
 *
 * With a single location there is no choice to make — we emit the id as a hidden
 * input so the form still submits it (and the server validates ownership anyway),
 * keeping the UI uncluttered for the common single-salon case.
 */
export function LocationSelect({
  locations,
  defaultLocationId,
}: {
  locations: LocationRow[]
  defaultLocationId: string
}) {
  if (locations.length <= 1) {
    const only = locations[0]?.id ?? defaultLocationId
    return only ? <input type="hidden" name="location_id" value={only} /> : null
  }
  return (
    <label className={styles.field}>
      <span>Plats</span>
      <select name="location_id" defaultValue={defaultLocationId}>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.is_primary ? ' (primär)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
