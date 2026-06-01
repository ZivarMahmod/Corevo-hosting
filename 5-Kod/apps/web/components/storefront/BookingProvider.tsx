'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { WizardService } from '@/components/booking/BookingWizard'
import { BookingDrawer } from './BookingDrawer'

/**
 * In-page booking embed (Zivar's #1 requirement).
 *
 * The whole storefront shell (Nav + main + Footer) is wrapped in this provider,
 * so EVERY "Boka tid" CTA — in the nav, the hero, and the closing section —
 * opens the SAME slide-over drawer rendered inside the storefront's own React
 * tree. No iframe, no redirect, no foreign portal: the dimmed, branded
 * storefront stays behind the drawer the entire time.
 *
 * SSR-safety (no React #418): `open` initialises CLOSED on both server and the
 * first client render, so hydration matches. We only read the `?boka=1` deep
 * link AFTER mount (in an effect) and open then. The drawer itself is not
 * rendered into the DOM until it has been opened at least once.
 */

type BookingContextValue = {
  /** True when the salon has bookable services AND a provider is mounted. */
  available: boolean
  open: () => void
}

const BookingContext = createContext<BookingContextValue | null>(null)

/** Opener for any CTA. Returns null when no provider is present (e.g. the
 *  standalone `/boka` route), so the CTA can fall back to a real link. */
export function useBooking(): BookingContextValue | null {
  return useContext(BookingContext)
}

export function BookingProvider({
  services,
  tenantName,
  children,
}: {
  services: WizardService[]
  tenantName: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Render the (potentially heavy) wizard only after the drawer is first opened.
  const [mounted, setMounted] = useState(false)
  const available = services.length > 0

  const openDrawer = useCallback(() => {
    if (!available) return
    setMounted(true)
    setOpen(true)
  }, [available])

  const closeDrawer = useCallback(() => {
    setOpen(false)
    // Drop the deep-link param without a navigation, so a refresh/back is clean.
    if (typeof window !== 'undefined' && window.location.search.includes('boka')) {
      const url = new URL(window.location.href)
      url.searchParams.delete('boka')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
  }, [])

  // Deep link: ?boka=1 (or #boka) opens the drawer after mount — hydration-safe
  // because server + first client render are both CLOSED.
  useEffect(() => {
    if (!available) return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('boka') === '1' || window.location.hash === '#boka') openDrawer()
  }, [available, openDrawer])

  // Reflect open-state in the URL so it is shareable / back-button friendly,
  // without ever navigating to a foreign route.
  const lastOpen = useRef(false)
  useEffect(() => {
    if (open === lastOpen.current) return
    lastOpen.current = open
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (open) {
      url.searchParams.set('boka', '1')
    } else {
      url.searchParams.delete('boka')
    }
    window.history.replaceState(null, '', url.pathname + url.search)
  }, [open])

  const value = useMemo<BookingContextValue>(
    () => ({ available, open: openDrawer }),
    [available, openDrawer],
  )

  return (
    <BookingContext.Provider value={value}>
      {children}
      {mounted ? (
        <BookingDrawer
          open={open}
          onClose={closeDrawer}
          services={services}
          tenantName={tenantName}
        />
      ) : null}
    </BookingContext.Provider>
  )
}
