'use client'

import { useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PLATS_ALLA, PLATS_COOKIE } from '@/lib/admin/plats-constants'
import { setAdminPrimaryLocation } from '@/lib/admin/location-actions'
import styles from './LocationSwitcher.module.css'
import { useDismissibleDetails } from './useDismissibleDetails'
import { effectiveLocationValue, locationSelectionTarget } from './location-switcher-state'

/**
 * Universalbannerens globala platsväljare. Den visas bara när PortalShell har
 * hittat fler än en aktiv plats. Valet sparas i samma corevo-plats-cookie som
 * Bokningar och Scheman redan läser. URL:ens `plats` hålls synkad så att dess
 * uttryckliga filter inte kan vinna över ett nyare menyval.
 */
export function LocationSwitcher({
  locations,
  value,
  primaryLocationId,
  allowAll,
}: {
  locations: { id: string; name: string }[]
  value: string
  primaryLocationId: string | null
  allowAll: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const onToggle = useDismissibleDetails(detailsRef)
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const exactRoute = pathname.startsWith('/admin/bokningar') || pathname.startsWith('/admin/scheman')
  const canUseAll = allowAll && !exactRoute
  const rawEffectiveValue = effectiveLocationValue(
    searchParams.get('plats'),
    value,
    locations.map((location) => location.id),
  )
  const effectiveValue =
    rawEffectiveValue || canUseAll
      ? rawEffectiveValue
      : locations.some((location) => location.id === primaryLocationId)
        ? primaryLocationId!
        : ''
  const selectedName =
    locations.find((location) => location.id === effectiveValue)?.name ??
    (canUseAll ? 'Alla platser' : 'Välj plats')

  const choose = (nextValue: string) => {
    if (detailsRef.current) detailsRef.current.open = false
    const queryValue = nextValue || PLATS_ALLA
    const cookieAlreadyMatches = value === nextValue
    const queryAlreadyMatches = searchParams.get('plats') === queryValue
    if (cookieAlreadyMatches && queryAlreadyMatches) return

    const currentSearch = searchParams.toString()
    const target = locationSelectionTarget(pathname, currentSearch, nextValue)
    const current = currentSearch ? `${pathname}?${currentSearch}` : pathname
    start(async () => {
      setError('')
      if (nextValue) {
        const saved = await setAdminPrimaryLocation(nextValue)
        if (saved.error) {
          setError(saved.error)
          return
        }
      }
      document.cookie = `${PLATS_COOKIE}=${encodeURIComponent(queryValue)}; path=/; max-age=31536000; samesite=lax`
      // replace laddar om serverkomponenterna när URL:en ändras. Om bara cookien
      // behövde synkas ligger vi redan på rätt URL och gör en explicit refresh.
      if (target === current) router.refresh()
      else router.replace(target, { scroll: false })
    })
  }

  const options = canUseAll ? [{ id: '', name: 'Alla platser' }, ...locations] : locations

  return (
    <details
      ref={detailsRef}
      className={styles.switcher}
      data-portal-details
      aria-busy={pending}
      onToggle={onToggle}
    >
      <summary
        className={styles.summary}
        aria-label={`Platsfilter: ${selectedName}`}
        title={`${selectedName} — filtrerar alla flikar`}
      >
        <span className={styles.marker} aria-hidden="true">
          ◎
        </span>
        <span className={styles.label}>{selectedName}</span>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </summary>

      <div className={styles.menu} role="menu" aria-label="Välj plats">
        <div className={styles.heading}>PLATS — FILTRERAR ALLT</div>
        {options.map((option) => {
          const active = option.id === effectiveValue
          return (
            <button
              key={option.id || 'all'}
              type="button"
              className={`${styles.option}${active ? ` ${styles.optionActive}` : ''}`}
              role="menuitemradio"
              aria-checked={active}
              disabled={pending}
              onClick={() => choose(option.id)}
            >
              <span className={styles.dot} aria-hidden="true" />
              <span>{option.name}</span>
            </button>
          )
        })}
        <div className={styles.footer}>Valet följer med till alla flikar.</div>
        {error && <div className={styles.footer} role="alert">{error}</div>}
      </div>
    </details>
  )
}
