'use client'

import { useEffect, useState } from 'react'
import { pickPersistedView } from '@/lib/portal/view'
import { Icon, type IconName } from './Icon'

export type ViewOption<T extends string> = { value: T; label: string; icon?: IconName }

/**
 * Segmented view switcher (playbook — Bokningar Lista/Vecka/…). Controlled: the
 * parent owns the active value (pair it with usePersistentView to auto-save the
 * choice to localStorage so the operator always lands in their last view).
 * Styling in app/portal-global.css (.bo-viewswitch).
 */
export function ViewSwitcher<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Vy',
}: {
  options: ReadonlyArray<ViewOption<T>>
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="bo-viewswitch" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? 'is-active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.icon && <Icon name={o.icon} size={15} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Companion hook: remembers the chosen view in localStorage and restores it on
 * mount (after hydration, so SSR markup is stable). `valid` guards against stale
 * / tampered keys. Returns [view, setView] — setView also persists.
 */
export function usePersistentView<T extends string>(
  storageKey: string,
  valid: ReadonlyArray<T>,
  fallback: T,
): [T, (v: T) => void] {
  const [view, setView] = useState<T>(fallback)

  useEffect(() => {
    try {
      setView(pickPersistedView(window.localStorage.getItem(storageKey), valid, fallback))
    } catch {
      /* localStorage unavailable (private mode / SSR) — keep fallback */
    }
    // restore once on mount for this key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const set = (v: T) => {
    setView(v)
    try {
      window.localStorage.setItem(storageKey, v)
    } catch {
      /* ignore persistence failure — UI still switches */
    }
  }

  return [view, set]
}
