'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './ui/Icon'

/**
 * Topbarens butik-väljare (kund-admin, bara vid >1 aktiv plats): skriver valet
 * till corevo-plats-cookien och laddar om server-datat — Bokningar/Scheman/
 * Bokningsvyn defaultar till valet (lib/admin/plats.ts). '' = Alla platser.
 */
export function LocationSwitcher({
  locations,
  value,
}: {
  locations: { id: string; name: string }[]
  value: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12.5,
        color: 'var(--c-ink-3)',
        opacity: pending ? 0.6 : 1,
      }}
      title="Vald butik — Bokningar, Scheman och Bokningsvyn följer valet"
    >
      <Icon name="mapPin" size={14} />
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value
          document.cookie = `corevo-plats=${encodeURIComponent(v)}; path=/; max-age=31536000; samesite=lax`
          start(() => router.refresh())
        }}
        style={{
          font: 'inherit',
          fontSize: 13,
          padding: '6px 9px',
          borderRadius: 7,
          border: '1px solid var(--c-line)',
          background: 'var(--c-paper)',
          color: 'var(--c-ink)',
          maxWidth: 180,
        }}
        aria-label="Vald butik"
      >
        <option value="">Alla platser</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  )
}
