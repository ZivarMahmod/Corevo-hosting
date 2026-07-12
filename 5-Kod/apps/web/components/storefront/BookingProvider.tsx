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
import type { WizardService, WizardLocation } from '@/components/booking/BookingWizard'
import type { BookingVariant, PickerMode, StaffAvatarMode } from '@/lib/platform/booking-variant'
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

/** Presentation mode for the embedded booking flow.
 *  - `wizard`  → Variant 3: steg-för-steg, one decision per screen (DEFAULT).
 *  - `compact` → Variant 4: snabbboka, all choices on one screen. */
export type BookingMode = 'wizard' | 'compact'

type BookingContextValue = {
  /** True when the salon has bookable services AND a provider is mounted. */
  available: boolean
  /** Open the drawer in the default steg-för-steg wizard (Variant 3). */
  open: () => void
  /** Open the drawer in kompakt snabbboka-läge (Variant 4). SF-A wires this to
   *  an optional "Snabbboka" CTA alongside the primary "Boka tid". */
  openQuickBook: () => void
}

const BookingContext = createContext<BookingContextValue | null>(null)

/** Opener for any CTA. Returns null when no provider is present (e.g. the
 *  standalone `/boka` route), so the CTA can fall back to a real link. */
export function useBooking(): BookingContextValue | null {
  return useContext(BookingContext)
}

export function BookingProvider({
  services,
  locations = [],
  tenantName,
  staffNoun = 'Personal',
  variant = 'wizard',
  pickerMode = 'calendar',
  staffAvatarMode = 'initialer',
  children,
}: {
  services: WizardService[]
  locations?: WizardLocation[]
  tenantName: string
  /** Bransch-resolved staff noun (singular) for the embedded wizard. Resolved on
   *  the server (layout) and threaded down as a plain string. OPTIONAL — defaults
   *  to 'Frisör' so any caller that omits it is byte-identical to today. */
  staffNoun?: string
  /** Tenantens boknings-vy (settings.booking.variant). Styr BÅDE innehåll (steg vs
   *  enskärms) och presentation (modal / slide-over / inbyggd sektion):
   *  wizard → steg i centrerad modal · drawer → steg i slide-over ·
   *  compact → snabbboka i slide-over · inline → CTA scrollar till den inbyggda
   *  sektionen (renderas av layouten, se InlineBooking). */
  variant?: BookingVariant
  /** Tid-väljaren (settings.booking.pickerMode) — rå-läses på servern via
   *  readPickerMode och skickas ner som plain string. Default 'calendar'. */
  pickerMode?: PickerMode
  /** Barberarbild-läget (settings.booking.staffAvatars) — rå-läses på servern via
   *  readStaffAvatarMode. Default 'initialer'. */
  staffAvatarMode?: StaffAvatarMode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Innehålls-läge i overlayen. Startar på variantens; en "Snabbboka"-CTA kan
  // fortfarande öppna kompakt-läget explicit.
  const variantMode: BookingMode = variant === 'compact' || variant === 'inline' ? 'compact' : 'wizard'
  const presentation: 'modal' | 'drawer' = variant === 'wizard' ? 'modal' : 'drawer'
  const [mode, setMode] = useState<BookingMode>(variantMode)
  // Render the (potentially heavy) wizard only after the drawer is first opened.
  const [mounted, setMounted] = useState(false)
  const available = services.length > 0

  const openWith = useCallback(
    (next: BookingMode) => {
      if (!available) return
      setMode(next)
      setMounted(true)
      setOpen(true)
    },
    [available],
  )

  const openDrawer = useCallback(() => {
    // Inline-varianten: bokningen ligger I sidan — CTA scrollar dit i stället för
    // att öppna en overlay. Saknas sektionen (t.ex. bokning ej live) → overlay-fallback.
    if (variant === 'inline') {
      const el = document.getElementById('boka-inline')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    openWith(variantMode)
  }, [openWith, variant, variantMode])
  const openQuickBook = useCallback(() => openWith('compact'), [openWith])

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
  // because server + first client render are both CLOSED. ?boka=snabb (or
  // #snabbboka) opens straight into the kompakt snabbboka-variant.
  useEffect(() => {
    if (!available) return
    const sp = new URLSearchParams(window.location.search)
    const boka = sp.get('boka')
    if (boka === 'snabb' || window.location.hash === '#snabbboka') openQuickBook()
    else if (boka === '1' || window.location.hash === '#boka') openDrawer()
  }, [available, openDrawer, openQuickBook])

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
    () => ({ available, open: openDrawer, openQuickBook }),
    [available, openDrawer, openQuickBook],
  )

  return (
    <BookingContext.Provider value={value}>
      {children}
      {mounted ? (
        <BookingDrawer
          open={open}
          onClose={closeDrawer}
          services={services}
          locations={locations}
          tenantName={tenantName}
          staffNoun={staffNoun}
          mode={mode}
          presentation={presentation}
          pickerMode={pickerMode}
          staffAvatarMode={staffAvatarMode}
        />
      ) : null}
    </BookingContext.Provider>
  )
}
