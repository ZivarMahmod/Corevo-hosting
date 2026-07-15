'use client'

import type { RefObject, SyntheticEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'

type OpenDetails = { open: boolean }
type EscapeEvent = Pick<KeyboardEvent, 'key' | 'preventDefault' | 'stopPropagation'>

export function closeOpenPortalDetails<T extends OpenDetails>(
  details: Iterable<T>,
  except?: T,
) {
  for (const item of details) {
    if (item !== except) item.open = false
  }
}

/** Stänger alla portal-details utom den som precis öppnas. */
export function closePortalDetails(except?: HTMLDetailsElement) {
  closeOpenPortalDetails(
    document.querySelectorAll<HTMLDetailsElement>('details[data-portal-details][open]'),
    except,
  )
}

/**
 * Escape ska först stänga en nästlad details-meny. Händelsen konsumeras så att
 * en omgivande Modal inte också stängs av samma tangenttryckning.
 */
export function dismissPortalDetailsOnEscape(
  event: EscapeEvent,
  details: HTMLDetailsElement | null,
): boolean {
  if (event.key !== 'Escape' || !details?.open) return false

  event.preventDefault()
  event.stopPropagation()
  details.open = false
  details.querySelector<HTMLElement>('summary')?.focus()
  return true
}

/**
 * Samordnar portalens details-menyer och stänger vid klick utanför eller Escape.
 * Globala lyssnare finns bara medan den egna menyn är öppen.
 */
export function useDismissibleDetails(ref: RefObject<HTMLDetailsElement | null>) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const details = ref.current
      if (details?.open && !details.contains(event.target as Node)) details.open = false
    }
    const onKeyDown = (event: KeyboardEvent) => {
      dismissPortalDetailsOnEscape(event, ref.current)
    }

    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, ref])

  return useCallback((event: SyntheticEvent<HTMLDetailsElement>) => {
    const details = event.currentTarget
    if (details.open) closePortalDetails(details)
    setOpen(details.open)
  }, [])
}
