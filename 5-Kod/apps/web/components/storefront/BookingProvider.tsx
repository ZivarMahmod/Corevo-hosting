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
import type {
  BookingMode,
  WizardService,
  WizardLocation,
} from '@/components/booking/BookingWizard'
import type { BookingVariant, PickerMode, StaffAvatarMode } from '@/lib/platform/booking-variant'
import {
  resolveBookingExternalUrl,
  type BookingExternalCtaUrls,
  type BookingProviderKind,
} from '@/lib/platform/booking-external-url'
import { BookingDrawer } from './BookingDrawer'

/**
 * In-page booking embed (Zivar's #1 requirement).
 *
 * The whole storefront shell (Nav + main + Footer) is wrapped in this provider.
 * A live Corevo provider opens the shared in-page flow; a live external provider
 * resolves validated links; an off module exposes neither.
 *
 * SSR-safety (no React #418): `open` initialises CLOSED on both server and the
 * first client render, so hydration matches. We only read the `?boka=1` deep
 * link AFTER mount (in an effect) and open then. The drawer itself is not
 * rendered into the DOM until it has been opened at least once.
 */

type BookingContextValue = {
  /** Route-level module gate; false for off, true for live. */
  reachable: boolean
  /** Provider is independent from the module's on/off visibility. */
  provider: BookingProviderKind
  /** External destination used only when the module is on with external provider. */
  externalUrl: string | null
  /** Resolve a button-specific destination with the global URL as fallback. */
  externalUrlFor: (slotId?: string) => string | null
  /** True when the salon has bookable services AND a provider is mounted. */
  available: boolean
  /** Active presentation, including iframe-only editor preview changes. */
  variant: BookingVariant
  /** Active date-picker mode, including iframe-only editor preview changes. */
  pickerMode: PickerMode
  /** Active staff-avatar mode, including iframe-only editor preview changes. */
  staffAvatarMode: StaffAvatarMode
  /** Active company name, including iframe-only editor preview changes. */
  tenantName: string
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
  bokaCta = 'Boka tid',
  variant = 'wizard',
  pickerMode = 'calendar',
  staffAvatarMode = 'initialer',
  reachable = true,
  provider = 'corevo',
  externalUrl = null,
  externalCtaUrls = {},
  countryCode,
  locale,
  currency,
  defaultTimeZone,
  children,
}: {
  services: WizardService[]
  locations?: WizardLocation[]
  tenantName: string
  /** BRANSCH-REGELN: bokningens verb ur bransch-lagret (branschBokning().cta),
   *  resolvat på servern (layouten) och trådat ner som ren sträng. Utelämnad →
   *  'Boka tid' (det som stod hårdkodat i drawern förr → byte-identiskt). */
  bokaCta?: string
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
  /** Whether /boka may be reached. Off must stay inert; live may be used. */
  reachable?: boolean
  /** Corevo engine or external provider; module visibility is controlled by reachable. */
  provider?: BookingProviderKind
  /** Validated HTTPS destination for tenants using an external provider. */
  externalUrl?: string | null
  /** Validated button-specific destinations for tenants using an external provider. */
  externalCtaUrls?: BookingExternalCtaUrls
  countryCode?: string
  locale?: string
  currency?: string
  defaultTimeZone?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [previewPrefs, setPreviewPrefs] = useState({ variant, pickerMode, staffAvatarMode })
  const [previewTenantName, setPreviewTenantName] = useState(tenantName)
  // Innehålls-läge i overlayen. Startar på variantens; en "Snabbboka"-CTA kan
  // fortfarande öppna kompakt-läget explicit.
  const variantMode: BookingMode = previewPrefs.variant === 'compact' || previewPrefs.variant === 'inline' ? 'compact' : 'wizard'
  const presentation: 'modal' | 'drawer' = previewPrefs.variant === 'wizard' ? 'modal' : 'drawer'
  const [mode, setMode] = useState<BookingMode>(variantMode)
  // Render the (potentially heavy) wizard only after the drawer is first opened.
  const [mounted, setMounted] = useState(false)
  const available = services.length > 0
  const internalBookingAvailable = reachable && provider === 'corevo' && available

  const openWith = useCallback(
    (next: BookingMode) => {
      if (!internalBookingAvailable) return
      setMode(next)
      setMounted(true)
      setOpen(true)
    },
    [internalBookingAvailable],
  )

  const openDrawer = useCallback(() => {
    if (!internalBookingAvailable) return
    // Inline-varianten: bokningen ligger I sidan — CTA scrollar dit i stället för
    // att öppna en overlay. Saknas sektionen (t.ex. bokning ej live) → overlay-fallback.
    if (previewPrefs.variant === 'inline') {
      const el = document.getElementById('boka-inline')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    openWith(variantMode)
  }, [internalBookingAvailable, openWith, previewPrefs.variant, variantMode])
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
    if (!internalBookingAvailable) return
    const sp = new URLSearchParams(window.location.search)
    const boka = sp.get('boka')
    if (boka === 'snabb' || window.location.hash === '#snabbboka') openQuickBook()
    else if (boka === '1' || window.location.hash === '#boka') openDrawer()
  }, [internalBookingAvailable, openDrawer, openQuickBook])

  // The same-origin site editor dispatches this event inside its isolated preview
  // iframe. Public pages never dispatch it, so their server-resolved preferences
  // remain unchanged.
  useEffect(() => {
    const onPreview = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail
      if (!detail) return
      const nextVariant = detail.variant
      const nextPickerMode = detail.pickerMode
      const nextStaffAvatarMode = detail.staffAvatars
      if (typeof detail.tenantName === 'string' && detail.tenantName.trim()) {
        setPreviewTenantName(detail.tenantName)
      }
      if (!['wizard', 'drawer', 'compact', 'inline'].includes(String(nextVariant)) ||
          !['calendar', 'strip'].includes(String(nextPickerMode)) ||
          !['initialer', 'foto', 'namn'].includes(String(nextStaffAvatarMode))) return
      setPreviewPrefs({
        variant: nextVariant as BookingVariant,
        pickerMode: nextPickerMode as PickerMode,
        staffAvatarMode: nextStaffAvatarMode as StaffAvatarMode,
      })
      setMode(nextVariant === 'compact' || nextVariant === 'inline' ? 'compact' : 'wizard')
      const search = new URLSearchParams(window.location.search)
      const previewShouldOpen = internalBookingAvailable && nextVariant !== 'inline' &&
        (search.get('boka') === '1' || window.location.hash === '#boka')
      setMounted((current) => current || previewShouldOpen)
      setOpen(previewShouldOpen)
      if (internalBookingAvailable && nextVariant === 'inline') {
        window.setTimeout(() => {
          document.getElementById('boka-inline')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 0)
      }
    }
    window.addEventListener('corevo-booking-preview', onPreview)
    return () => window.removeEventListener('corevo-booking-preview', onPreview)
  }, [internalBookingAvailable])

  // Reflect open-state in the URL so it is shareable / back-button friendly,
  // without ever navigating to a foreign route.
  const lastOpen = useRef(false)
  useEffect(() => {
    if (open === lastOpen.current) return
    lastOpen.current = open
    if (typeof window === 'undefined') return
    if (window.parent !== window && window.location.pathname.startsWith('/salong-preview/')) return
    const url = new URL(window.location.href)
    if (open) {
      url.searchParams.set('boka', '1')
    } else {
      url.searchParams.delete('boka')
    }
    window.history.replaceState(null, '', url.pathname + url.search)
  }, [open])

  const value = useMemo<BookingContextValue>(
    () => ({
      reachable,
      provider,
      externalUrl,
      externalUrlFor: (slotId) => resolveBookingExternalUrl(externalUrl, externalCtaUrls, slotId),
      available: internalBookingAvailable,
      variant: previewPrefs.variant,
      pickerMode: previewPrefs.pickerMode,
      staffAvatarMode: previewPrefs.staffAvatarMode,
      tenantName: previewTenantName,
      open: openDrawer,
      openQuickBook,
    }),
    [externalCtaUrls, externalUrl, internalBookingAvailable, openDrawer, openQuickBook, previewPrefs, previewTenantName, provider, reachable],
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
          tenantName={previewTenantName}
          staffNoun={staffNoun}
          bokaCta={bokaCta}
          mode={mode}
          presentation={presentation}
          pickerMode={previewPrefs.pickerMode}
          staffAvatarMode={previewPrefs.staffAvatarMode}
          countryCode={countryCode}
          locale={locale}
          currency={currency}
          defaultTimeZone={defaultTimeZone}
        />
      ) : null}
    </BookingContext.Provider>
  )
}
