'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { bookingStatusPresentation } from '@/lib/booking/confirmation-status'
import { useRouter } from 'next/navigation'
import {
  cancelBookingVerification,
  getAvailableSlots,
  getBookingContactModeAction,
  resendBookingVerification,
  startBookingVerification,
  startBookingCheckout,
  verifyAndCreateBooking,
  type BookingVerificationStarted,
  type SlotOption,
} from '@/app/boka/actions'
import type { PickerMode, StaffAvatarMode } from '@/lib/platform/booking-variant'
import styles from './booking.module.css'

type WizardStaff = {
  id: string
  title: string | null
  locationIds: string[]
  /** staff.avatar_url (R2). null → foto-läget faller tillbaka till initialer-disc. */
  avatarUrl: string | null
}
export type WizardService = {
  id: string
  name: string
  description: string | null
  durationMin: number
  priceCents: number
  staff: WizardStaff[]
  /** POPULÄR-taggen (designpaketet steg 1). Osatt → ingen tagg (ingen datakälla än). */
  popular?: boolean
}
/** En bokningsbar plats (VÅG 4b). Tom lista / en post → ingen picker (auto-väljs). */
export type WizardLocation = {
  id: string
  name: string
  isPrimary: boolean
}

const kr = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
})

// Initialer-discfärger (designpaketet): round-robin per medarbetare i listan.
const DISC_COLORS = ['#BC4A1C', '#2E5A46', '#B07A1E', '#7A4A2E'] as const

/** Avatar-disc för barberarkortet (steg 2), 46px. Tre lägen (tenant-valbart):
 *  foto → cirkulärt foto (faller tillbaka till initialer utan avatarUrl);
 *  initialer → per-staff-färgad disc + vit display-initial;
 *  namn → paper-2-disc + ink-2-initial (namnet leder). */
function StaffAvatar({
  name,
  avatarUrl,
  mode,
  index,
}: {
  name: string
  avatarUrl: string | null
  mode: StaffAvatarMode
  index: number
}) {
  if (mode === 'foto' && avatarUrl) {
    return (
      <span className="fc-avatar fc-avatar--foto" aria-hidden>
        {/* Plain <img> — storefrontens remote-image-config är fryst (aldrig next/image). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" width={46} height={46} loading="lazy" />
      </span>
    )
  }
  const initial = (name.trim().charAt(0) || '?').toUpperCase()
  if (mode === 'namn') {
    return (
      <span className="fc-avatar fc-avatar--namn" aria-hidden>
        {initial}
      </span>
    )
  }
  return (
    <span
      className="fc-avatar"
      style={{ background: DISC_COLORS[index % DISC_COLORS.length] }}
      aria-hidden
    >
      {initial}
    </span>
  )
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Presentation variant.
 *  - `wizard`  → Variant 3: steg-för-steg, one decision per screen, top progress
 *    bar + bottom action bar (DEFAULT).
 *  - `compact` → Variant 4: kompakt snabbboka, every choice on one screen with a
 *    single bottom "Boka tid" CTA. */
export type BookingMode = 'wizard' | 'compact'

export function BookingWizard({
  services,
  locations = [],
  open,
  onClose,
  mode = 'wizard',
  staffNoun = 'Personal',
  bokaCta = 'Boka tid',
  pickerMode = 'calendar',
  staffAvatarMode = 'initialer',
  brandName,
  preselectServiceId = null,
  preselectStaffId = null,
}: {
  services: WizardService[]
  /** Bokningsbara platser (VÅG 4b). OPTIONAL — utelämnad/tom/en post → ingen
   *  picker visas, platsen auto-väljs (en-plats-salonger + alla nuvarande
   *  callers, t.ex. storefront-drawern, blir byte-identiska). Endast /boka skickar
   *  in den; flerplatsläget aktiveras först vid >1 aktiv plats. */
  locations?: WizardLocation[]
  /** Drawer open-state (embedded only). On a closed→open rising edge AFTER a
   *  completed booking we reset the wizard, so a reopened drawer starts fresh
   *  rather than on a stale confirmation. Mid-flow closes (step 1–4) are NOT
   *  reset, so an accidental close still resumes where the customer left off. */
  open?: boolean
  /** Set when the wizard is embedded in the storefront drawer. Lets step 5
   *  confirm IN-PAGE (biljetten) instead of navigating to the receipt route. */
  onClose?: () => void
  /** Variant 3 wizard (default) or Variant 4 kompakt snabbboka. */
  mode?: BookingMode
  /** Customer-facing staff noun (singular), bransch-resolved on the SERVER mount
   *  and passed down as a plain string. OPTIONAL — defaults to neutral 'Personal'
   *  for mounts/tenants without bransch. Tenants with a bransch override read e.g.
   *  'Barberare', 'Nagelteknolog', 'Stylist'. Resolve via resolveTerm(terminology,
   *  'staff', DEFAULT_STAFF_NOUN) — NEVER pass the raw terminology object to this
   *  client component. */
  staffNoun?: string
  /** BRANSCH-REGELN: bokningens VERB, resolvat på servern ur bransch-lagret
   *  (bransch-copy.ts → branschBokning().cta) och nedskickat som ren sträng —
   *  "Boka bord" hos en restaurang, "Boka konsultation" hos en florist. Utelämnad
   *  → 'Boka tid' (samma ord som stod hårdkodat förr → byte-identisk). */
  bokaCta?: string
  /** Tid-väljaren (settings.booking.pickerMode): månadskalender eller dag-remsa. */
  pickerMode?: PickerMode
  /** Barberarbild-läget (settings.booking.staffAvatars): foto/initialer/namn. */
  staffAvatarMode?: StaffAvatarMode
  /** Salongens wordmark på biljettens huvudrad (steg 5). OPTIONAL — mounts som
   *  inte skickar den får den neutrala fallbacken 'Bokning'. */
  brandName?: string
  /** goal-64: förvald tjänst ur /boka?tjanst=<serviceId> (prisraden vet sin tjänst).
   *  Okänt id ignoreras tyst. */
  preselectServiceId?: string | null
  /** goal-64: förvald personal ur /boka?personal=<staffId> (teamkortets djuplänk).
   *  Okänt id — eller personal som inte kan utföra den valda tjänsten — ignoreras tyst. */
  preselectStaffId?: string | null
}) {
  const compact = mode === 'compact'
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // ── Plats (VÅG 4b) ──────────────────────────────────────────────────────────
  // Flerplatsläget aktiveras BARA vid >1 aktiv plats. Vid 0/1 plats auto-väljs den
  // (eller null → servern faller tillbaka på primär plats), och INGEN picker visas
  // → UX byte-identisk med dagens en-plats-flöde. Defaultval = primär ?? första.
  const multiLocation = locations.length > 1
  const defaultLocationId = useMemo(
    () => locations.find((l) => l.isPrimary)?.id ?? locations[0]?.id ?? null,
    [locations],
  )
  // Startval:
  //  • ≤1 plats → auto-väljs (eller null vid 0 platser → servern tar primär).
  //  • >1 i WIZARD → null, så grind-skärmen tvingar ett aktivt platsval först.
  //  • >1 i COMPACT → default förvald (single-screen ska vara användbar direkt;
  //    chip-raden låter kunden byta).
  const [locationId, setLocationId] = useState<string | null>(
    multiLocation && !compact ? null : defaultLocationId,
  )
  // Picker-grinden (BARA wizard): visa platsvalet före steg-maskinen tills en plats
  // är vald. ≤1 plats eller compact → alltid false → ingen grind.
  const needsLocationPick = multiLocation && !compact && !locationId

  // ── FÖRVAL UR DJUPLÄNKEN (goal-64, HANDOFF §4) ──────────────────────────────
  // Teamkorten och prisraderna länkar till /boka?personal=<staffId>&tjanst=<serviceId>.
  // /boka läser query-parametrarna och skickar dem hit. Kopplingen MÅSTE finnas: ett
  // teamkort som bara dumpar besökaren på ett tomt bokningsformulär har tappat exakt
  // det som gjorde kortet meningsfullt ("boka hos VERA").
  //
  // FAIL-SAFE, alltid: ett id som inte finns (gammal länk, manipulerad url, personal
  // som slutat) IGNORERAS tyst → wizarden startar som vanligt. En djuplänk kan alltså
  // aldrig låsa eller krascha bokningen. Servern validerar ändå allt igen vid submit;
  // detta är ren UI-förifyllnad.
  const preService = useMemo(
    () => services.find((s) => s.id === preselectServiceId) ?? null,
    [services, preselectServiceId],
  )
  // Personalen förväljs bara när hen FAKTISKT kan utföra den valda tjänsten. Utan
  // tjänst i länken hålls valet kvar och appliceras när kunden väljer tjänst (se
  // effekten nedan) — annars vore "?personal=" utan "?tjanst=" en död parameter.
  const preStaffValid = (svc: WizardService | null, staffId: string | null) =>
    staffId && svc?.staff.some((m) => m.id === staffId) ? staffId : 'any'

  // Med tjänst i länken hoppar vi förbi steg 1 (kunden har redan valt den).
  const [step, setStep] = useState(preService ? 2 : 1)
  const [service, setService] = useState<WizardService | null>(preService)
  const [staffChoice, setStaffChoice] = useState<string>(() =>
    preStaffValid(preService, preselectStaffId ?? null),
  ) // 'any' | staffId
  const [date, setDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [timeZone, setTimeZone] = useState('Europe/Stockholm')
  const [slot, setSlot] = useState<SlotOption | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', note: '' })
  const [error, setError] = useState<string | null>(null)
  const [contactMode, setContactMode] = useState<'sms' | 'email' | null>(null)
  const [verification, setVerification] = useState<BookingVerificationStarted | null>(null)
  const [pin, setPin] = useState('')
  const [clock, setClock] = useState(() => Date.now())
  // Bekräftelse-steget (in-page): satt när bokningen lyckats utan online-betalning.
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [bookingStatus, setBookingStatus] = useState<'pending' | 'confirmed' | null>(null)
  const bookingPresentation = bookingStatusPresentation(bookingStatus)
  // Step-3 specific load/error so it never gets confused with the empty state.
  const [slotsError, setSlotsError] = useState<string | null>(null)
  // "Tiden togs precis"-notis: visas överst i steg 3 efter en krock; överlever
  // slot-uppdateringen så användaren förstår varför hen är tillbaka här.
  const [slotTakenNotice, setSlotTakenNotice] = useState<string | null>(null)
  // Kalender-vyns månadsmarkör: index i calMonths (månader som bokningsfönstret rör).
  const [calCursor, setCalCursor] = useState(0)

  // Giada-health bestämmer vilket ENDA kontaktfält som visas. Servern gör om
  // kontrollen när koden skickas; ett modem som dör mellan render och klick kan
  // därför aldrig skapa en SMS-bokning utan levererad kod.
  useEffect(() => {
    let active = true
    getBookingContactModeAction()
      .then(({ mode: liveMode }) => {
        if (active) setContactMode(liveMode)
      })
      .catch(() => {
        if (active) setContactMode('email')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!verification) return
    setClock(Date.now())
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [verification])

  // Bokningsfönstret (Zivar 2026-07-09: "borde kunna väljas månadsvis …
  // åtminstone några månader fram"): 90 dagar ≈ 3 månader. Tiderna hämtas
  // per vald dag (getAvailableSlots), så fönstret kostar inget förrän en dag
  // klickas — motorn räknar godtyckligt långt fram ur veckoschema-mallen.
  const BOOKING_WINDOW_DAYS = 90
  const days = useMemo(() => {
    const out: Date[] = []
    const base = new Date()
    for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      out.push(d)
    }
    return out
  }, [])

  // Månader som bokningsfönstret (days) täcker — kalenderbläddringen begränsas hit.
  const calMonths = useMemo(() => {
    const list: { y: number; m: number }[] = []
    for (const d of days) {
      const y = d.getFullYear()
      const m = d.getMonth()
      if (!list.some((x) => x.y === y && x.m === m)) list.push({ y, m })
    }
    return list
  }, [days])

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone }).format(
      new Date(iso),
    )
  const fmtDow = (d: Date) =>
    new Intl.DateTimeFormat('sv-SE', { weekday: 'short' }).format(d).replace('.', '')
  const fmtMon = (d: Date) =>
    new Intl.DateTimeFormat('sv-SE', { month: 'short' }).format(d).replace('.', '')
  // Lång datum-rad till biljetten (steg 5) — speglar /boka/bekraftelse-rutten.
  const fmtLongDate = (iso: string) =>
    new Intl.DateTimeFormat('sv-SE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone,
    }).format(new Date(iso))

  // Core slot-fetch — the ONE place that calls getAvailableSlots. Used by both
  // variants: the wizard's day handler (per service+staff+day) and compact's
  // effect (refetch whenever service OR staff OR day changes).
  function fetchSlots(serviceId: string, choice: string, d: string, locId: string | null) {
    setSlot(null)
    setError(null)
    setSlotsError(null)
    startTransition(async () => {
      // locId vidarebefordras → location-aware availability. null (en-plats/saknat
      // val) → servern faller tillbaka på tenantens primära plats.
      const res = await getAvailableSlots(serviceId, choice === 'any' ? null : choice, d, locId)
      if (res.ok) {
        setSlots(res.slots)
        setTimeZone(res.timeZone)
      } else {
        setSlots([])
        setSlotsError(res.error)
      }
    })
  }

  // Platsval (VÅG 4b): byter availability-scope → ALLT nedströms (tjänst/frisör/
  // dag/tid) nollställs så inget val släpar med från en annan plats. Anropas bara
  // i flerplatsläget; i en-plats-läget rörs detta aldrig.
  function pickLocation(id: string) {
    setLocationId(id)
    setService(compact && services.length > 0 ? services[0]! : null)
    setStaffChoice('any')
    setDate(compact ? ymd(days[0]!) : null)
    setSlots([])
    setSlot(null)
    setSlotsError(null)
    setSlotTakenNotice(null)
    setError(null)
  }

  // ── Variant 3 (wizard) navigation ─────────────────────────────────────────
  // Selection NO LONGER auto-advances (handoff = one decision per screen + an
  // explicit "Fortsätt"). Each picker only sets state; the bottom action bar
  // advances. Selecting a service/staff still RESETS downstream choices.
  function pickService(s: WizardService) {
    setService(s)
    // goal-64: kom besökaren via /boka?personal=… utan tjänst i länken, appliceras
    // personal-förvalet nu — men BARA om hen kan utföra just den valda tjänsten.
    setStaffChoice(preStaffValid(s, preselectStaffId ?? null))
    setDate(null)
    setSlots([])
    setSlot(null)
    setSlotsError(null)
    setSlotTakenNotice(null)
    setError(null)
  }

  function pickStaff(choice: string) {
    setStaffChoice(choice)
    setDate(null)
    setSlots([])
    setSlot(null)
    setSlotsError(null)
    setSlotTakenNotice(null)
  }

  // Day selection still fires the slot fetch (the wiring the engine depends on),
  // but stays on step 3 so the customer can read the grid and press Fortsätt.
  function pickDate(d: string) {
    if (!service) return
    setDate(d)
    fetchSlots(service.id, staffChoice, d, locationId)
  }

  // Tid-steget öppnar med DAGENS datum förvalt (Zivar: kunden ska direkt se
  // dagens tider — aldrig "välj en dag ovan" som första möte) och kan byta
  // fritt. Körs varje gång steget nås med nollställt datum (tjänst/frisör-byte
  // nollar datumet → återbesök på steget väljer om dagens dag).
  useEffect(() => {
    if (compact || step !== 3 || !service || date) return
    pickDate(ymd(days[0]!))
    // pickDate/days medvetet utanför dep-listan (stabila per render-cykel) —
    // samma mönster som compact-effekterna nedan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, step, service, date])

  // ── Variant 4 (compact) ────────────────────────────────────────────────────
  // Everything is on one screen, so the slot grid must refetch whenever the
  // service, staff, OR day changes — not only on an explicit day click. We seed
  // a default service + today's date once services are known, then key an effect
  // on [service, staffChoice, date]. Until it resolves the grid renders disabled.
  useEffect(() => {
    if (!compact) return
    // Seed defaults on first compact mount: first service + today, like the
    // handoff VCompact. (Re-seeding after a confirmation is handled directly in
    // resetWizard, since this effect won't re-run on that render.)
    if (!service && services.length > 0) setService(services[0]!)
    if (!date) setDate(ymd(days[0]!))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, services])

  useEffect(() => {
    if (!compact || !service || !date) return
    // Refetcha även när platsen byts (location-aware availability i compact-läget).
    fetchSlots(service.id, staffChoice, date, locationId)
  }, [compact, service, staffChoice, date, locationId])

  // Idempotens-nyckel (0048): ETT id per boknings-intent — genereras lazy vid
  // första submit och överlever retries, men nollas så fort tiden byts (nytt
  // intent). Ett förlorat SVAR + retry ger då samma bokning tillbaka i stället
  // för en dold dubblett.
  const requestIdRef = useRef<string | null>(null)
  useEffect(() => {
    requestIdRef.current = null
    setVerification(null)
    setPin('')
  }, [slot])

  function selectedContact(): string {
    return contactMode === 'sms' ? form.phone : form.email
  }

  async function finishCreatedBooking(res: Extract<Awaited<ReturnType<typeof verifyAndCreateBooking>>, { ok: true }>) {
    // Online-betalning på (payments_enabled && charges_enabled) → Stripe Checkout.
    // Bokningen är redan durabel; ett betalningsfel degraderar till betala på plats.
    if (res.requiresPayment) {
      try {
        const pay = await startBookingCheckout(res.bookingId)
        if (pay.ok) {
          window.location.href = pay.url
          return
        }
      } catch {
        // degradera till betala-på-plats-bekräftelsen
      }
    }
    if (onClose) {
      setBookingId(res.bookingId)
      setBookingStatus(res.bookingStatus)
      setStep(5)
    } else {
      router.push(`/boka/bekraftelse/${res.bookingId}`)
    }
  }

  function beginVerification() {
    if (!service || !slot) return
    if (!contactMode) {
      setError('Vänta ett ögonblick medan vi kontrollerar hur koden ska skickas.')
      return
    }
    setError(null)
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID()
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof startBookingVerification>>
      try {
        res = await startBookingVerification({
          serviceId: service.id,
          staffId: slot.staffId,
          startISO: slot.start,
          contact: selectedContact(),
          locationId,
        })
      } catch {
        setError('Koden kunde inte skickas. Kontrollera uppkopplingen och försök igen.')
        return
      }
      if (res.ok) {
        setVerification(res)
        setContactMode(res.channel)
        setPin('')
      } else {
        if (res.channel) setContactMode(res.channel)
        if (res.reason === 'slot_taken' && date) {
          setStep(3)
          pickDate(date)
          setSlotTakenNotice(res.message)
        } else {
          setError(res.message)
        }
      }
    })
  }

  function verifyPin() {
    if (!service || !slot || !verification || pin.length !== 6) return
    setError(null)
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof verifyAndCreateBooking>>
      try {
        res = await verifyAndCreateBooking({
          serviceId: service.id,
          staffId: slot.staffId,
          startISO: slot.start,
          locationId,
          challengeId: verification.challengeId,
          sessionToken: verification.sessionToken,
          channel: verification.channel,
          contact: selectedContact(),
          pin,
          name: form.name,
          note: form.note,
          requestId: requestIdRef.current ?? undefined,
        })
      } catch {
        setError('Vi kunde inte läsa svaret. Kontrollera ditt SMS eller mejl innan du försöker igen.')
        return
      }
      if (res.ok) {
        await finishCreatedBooking(res)
        return
      }
      if (res.reason === 'slot_taken' && date) {
        setVerification(null)
        setPin('')
        setStep(3)
        pickDate(date)
        setSlotTakenNotice(res.message)
        return
      }
      if (res.reason === 'expired') {
        setVerification(null)
        setPin('')
      }
      setError(res.message)
    })
  }

  function resendPin() {
    if (!service || !slot || !verification) return
    setError(null)
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof resendBookingVerification>>
      try {
        res = await resendBookingVerification({
          serviceId: service.id,
          staffId: slot.staffId,
          startISO: slot.start,
          locationId,
          contact: selectedContact(),
          channel: verification.channel,
          challengeId: verification.challengeId,
          sessionToken: verification.sessionToken,
        })
      } catch {
        setError('Koden kunde inte skickas igen. Försök om en stund.')
        return
      }
      if (res.ok) {
        setVerification(res)
        setPin('')
        return
      }
      if (res.reason === 'delivery_unavailable' && verification.channel === 'sms') {
        setVerification(null)
        setPin('')
        setContactMode('email')
      }
      setError(res.message)
    })
  }

  // Nollställ hela wizarden till steg 1. Körs på en stängd→öppen flank EFTER en
  // klar bokning (se effekten nedan) och av biljettens "Boka en till tid".
  function resetWizard() {
    setStep(1)
    // Compact reopens straight back into the one-page form, so re-seed its
    // defaults (first service + today) here rather than clearing to null — the
    // seed effect won't re-run on the post-reset render (its deps are unchanged).
    setService(compact && services.length > 0 ? services[0]! : null)
    setStaffChoice('any')
    setDate(compact ? ymd(days[0]!) : null)
    setSlots([])
    setSlot(null)
    setForm({ name: '', email: '', phone: '', note: '' })
    setError(null)
    setSlotsError(null)
    setSlotTakenNotice(null)
    setBookingId(null)
    setBookingStatus(null)
    setVerification(null)
    setPin('')
    setCalCursor(0)
    // Platsval nollställs till sitt utgångsläge (≤1 plats → auto; >1 wizard → grind;
    // >1 compact → default förvald).
    setLocationId(multiLocation && !compact ? null : defaultLocationId)
  }

  // Reset på ÅTERÖPPNING (inte på stängning): så att drawern glider ut med
  // bekräftelsen kvar synlig, men nästa öppning börjar om. Bara när förra flödet
  // nådde bekräftelsen (step 5) — mitt-i-flödet-stängningar (X/Esc/scrim på steg
  // 1–4) lämnas orörda så att kunden kan återuppta där hen var.
  const prevOpen = useRef(open)
  useEffect(() => {
    if (open && !prevOpen.current && step === 5) resetWizard()
    prevOpen.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Variant 3 (wizard) bottom-action-bar wiring ────────────────────────────
  // The handoff puts ALL forward/back navigation in a single bottom bar.
  // Per-step gate: can the customer advance? Step 4's "Bekräfta" submits the
  // step-4 <form> (so its required-field validation still runs) rather than
  // calling submit() blindly.
  const formRef = useRef<HTMLFormElement>(null)
  const canAdvance =
    step === 1
      ? !!service
      : step === 2
        ? !!staffChoice
        : step === 3
          ? !!slot
          : step === 4
            ? verification
              ? pin.length === 6
              : !!(form.name && contactMode && selectedContact())
            : true

  // Vad SAKNAS för att gå vidare? Bärs av den låsta CTA:ns sub-rad. Steg 2 kan
  // aldrig blockera (staffChoice är alltid satt → 'any'), därför ingen text där.
  const blockedHint =
    step === 1
      ? 'Välj en tjänst'
      : step === 3
        ? 'Välj en tid'
        : step === 4
          ? verification
            ? 'Fyll i den sexsiffriga koden'
            : contactMode === 'sms'
              ? 'Fyll i namn och telefon'
              : contactMode === 'email'
                ? 'Fyll i namn och e-post'
                : 'Kontrollerar kontaktväg…'
          : ''

  function goNext() {
    if (step === 4) {
      if (verification) {
        verifyPin()
        return
      }
      // Trigger native form validation + submit (keeps required + types).
      formRef.current?.requestSubmit()
      return
    }
    if (step < 4) setStep((s) => s + 1)
  }

  async function leaveVerification() {
    const activeVerification = verification
    if (!activeVerification) return
    let res: Awaited<ReturnType<typeof cancelBookingVerification>>
    try {
      res = await cancelBookingVerification({
        challengeId: activeVerification.challengeId,
        sessionToken: activeVerification.sessionToken,
      })
    } catch {
      setError('Tiden kunde inte släppas ännu. Försök igen om en stund.')
      return
    }
    if (!res.ok) {
      setError(res.message)
      return
    }
    setVerification(null)
    setPin('')
    setError(null)
  }

  function goBack() {
    if (verification) {
      setError(null)
      startTransition(leaveVerification)
      return
    }
    if (step > 1) setStep((s) => s - 1)
  }

  // ── Variant 4 (compact) submit ─────────────────────────────────────────────
  // One CTA at the bottom. Validates name + phone (the only two required fields
  // compact shows) before delegating to the shared submit() — same engine, same
  // Stripe / in-page-confirmation / slot-collision behaviour.
  const compactReady = !!(service && slot && form.name && contactMode && selectedContact())
  function submitCompact() {
    if (!compactReady) {
      setError(contactMode === 'email'
        ? 'Fyll i tjänst, tid, namn och e-post.'
        : 'Fyll i tjänst, tid, namn och telefon.')
      return
    }
    beginVerification()
  }

  // Spec-copy: mono steglabel + display-frågor. Steglabel 2 = bransch-nounet
  // (FreshCut → 'Barberare') — aldrig hårdkodad bransch (goal-46-guardrail).
  const stepLabels = ['Tjänst', staffNoun, 'Tid', verification ? 'Verifiera' : 'Uppgifter']
  const stepTitles = ['Vad vill du boka?', 'Hos vem?', 'När passar det?', verification ? 'Ange koden' : 'Dina uppgifter']

  // Platsfiltrerad personal (VÅG 4b): en frisör erbjuds BARA på en plats hen
  // faktiskt jobbar på (≥1 working_hours-rad med location_id = vald plats). Speglar
  // availability-motorns location-scope (actions.ts) så pickern aldrig listar
  // fel-plats-personal. locationId === null (en-plats-auto / ej valt) → visa alla;
  // efter VÅG 4-backfillen har varje frisör en primär-plats-rad → en-plats byte-
  // identisk (filtret släpper igenom alla). Beräknas en gång, används i båda
  // render-lägena (compact + wizard). OBS: staffChoice nollställs redan i
  // pickLocation (→ 'any'), så ett gammalt fel-plats-val kan aldrig släpa med.
  const staffHere = (service?.staff ?? []).filter(
    (m) => !locationId || m.locationIds.includes(locationId),
  )

  // ── Recap-rad (mono, rust): delarna som valts hittills ──────────────────────
  const recapBits: string[] = []
  if (step > 1 && service) recapBits.push(service.name)
  if (step > 2)
    recapBits.push(
      staffChoice === 'any'
        ? 'Första lediga'
        : (staffHere.find((m) => m.id === staffChoice)?.title ?? staffNoun),
    )
  if (step > 3 && slot && date) {
    const dObj = days.find((d) => ymd(d) === date)
    recapBits.push(`${dObj ? `${fmtDow(dObj)} ` : ''}${fmtTime(slot.start)}`)
  }
  const recapText = recapBits.join('  ·  ')

  // ── Slots grupperade Morgon (<12) / Dagtid (<16) / Kväll (tenant-tidszon) ────
  const slotGroupsAll = [
    { label: 'Morgon', items: [] as SlotOption[] },
    { label: 'Dagtid', items: [] as SlotOption[] },
    { label: 'Kväll', items: [] as SlotOption[] },
  ]
  for (const sl of slots) {
    const h = Number(fmtTime(sl.start).slice(0, 2))
    ;(h < 12 ? slotGroupsAll[0] : h < 16 ? slotGroupsAll[1] : slotGroupsAll[2])!.items.push(sl)
  }
  const slotGroups = slotGroupsAll.filter((g) => g.items.length > 0)

  // ── Delade render-bitar ──────────────────────────────────────────────────────
  const slotButton = (sl: SlotOption) => {
    const isSel = slot?.start === sl.start && slot?.staffId === sl.staffId
    return (
      <button
        key={sl.start + sl.staffId}
        type="button"
        className={`wizard-time${isSel ? ' selected' : ''}`}
        aria-pressed={isSel}
        onClick={() => {
          // Select only — advancing is the bottom bar's "Fortsätt" (steps mode).
          setSlot(sl)
          setSlotTakenNotice(null)
        }}
      >
        {/* Vid "Alla" visas INGEN frisör på tiden — systemet fördelar själv till
            den med minst bokat (Zivar 2026-07-10). */}
        <span className="fc-slot-time">{fmtTime(sl.start)}</span>
      </button>
    )
  }

  const slotSkeleton = (
    <div className="fc-slot-grid" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="fc-skel-chip" />
      ))}
    </div>
  )

  const slotError = (retry: () => void) => (
    <div>
      <p className="fc-alert" role="alert">
        {slotsError}
      </p>
      <button type="button" className="fc-retry" onClick={retry}>
        ↻ Försök igen
      </button>
    </div>
  )

  const resendWaitSeconds = verification
    ? Math.max(0, Math.ceil((Date.parse(verification.resendAt) - clock) / 1000))
    : 0
  const verificationPanel = verification ? (
    <div className="fc-step">
      <div className="fc-summary">
        <span className="fc-summary-main">
          <span className="fc-summary-name">Kod skickad</span>
          <span className="fc-summary-meta">
            {verification.channel === 'sms' ? 'SMS' : 'E-post'} till {verification.maskedContact}
          </span>
        </span>
        <span className="fc-summary-price" aria-hidden>✓</span>
      </div>
      <p className="wizard-muted" style={{ marginTop: 0 }}>
        Skriv in den sexsiffriga koden. Tiden bokas först när koden är godkänd.
      </p>
      <label className="fc-field">
        <span>Verifieringskod</span>
        <input
          required
          autoFocus
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </label>
      <button
        type="button"
        className="fc-retry"
        disabled={pending || resendWaitSeconds > 0}
        onClick={resendPin}
      >
        {resendWaitSeconds > 0 ? `Skicka ny kod om ${resendWaitSeconds} s` : 'Skicka ny kod'}
      </button>
      {error ? <p className="fc-alert" role="alert">{error}</p> : null}
    </div>
  ) : null

  // ── Variant 4 (compact) — kompakt snabbboka, allt på en skärm ───────────────
  // The whole booking on one scroll: chip rows for tjänst/personal/dag, a 4-col
  // slot grid (disabled until getAvailableSlots resolves), name+phone side by
  // side, and a single bottom "Boka tid" CTA with a mono summary sub-line. After
  // a successful booking the shared step-5 ticket takes over (below).
  if (compact && step !== 5 && verification) {
    return (
      <div className="wizard wizard--compact fc-scope">
        <div className="wizard-head">
          <h2 className="ckompakt-title">Bekräfta din bokning</h2>
          <p className="ckompakt-lede">Ett sista snabbt steg.</p>
        </div>
        <div className="wizard-stepbody">{verificationPanel}</div>
        <div className="wizard-actionbar">
          <button
            type="button"
            className="wizard-back-btn"
            disabled={pending}
            onClick={goBack}
            aria-label="Ändra uppgifter"
          >
            <span aria-hidden>←</span>
          </button>
          <button
            type="button"
            className="wizard-cta"
            disabled={pin.length !== 6 || pending}
            onClick={verifyPin}
          >
            <span className="wizard-cta-label">{pending ? 'Verifierar…' : 'Verifiera & boka'}</span>
            {pin.length !== 6 && !pending ? <span className="wizard-cta-sub">Fyll i 6 siffror</span> : null}
          </button>
          <ConsentLine />
        </div>
      </div>
    )
  }

  if (compact && step !== 5) {
    return (
      <div className="wizard wizard--compact fc-scope">
        <div className="wizard-head">
          <h2 className="ckompakt-title">Snabbboka</h2>
          <p className="ckompakt-lede">Allt på en skärm — för dig som vet vad du vill.</p>
        </div>

        <div className="wizard-stepbody">
          {services.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon} aria-hidden>
                ✂️
              </div>
              <p className={styles.emptyTitle}>Inga tjänster att boka just nu</p>
              <p className={styles.emptyText}>
                Inga bokningsbara tjänster ännu — hör av dig{brandName ? ` till ${brandName}` : ''} direkt.
              </p>
            </div>
          ) : (
            <div className="ckompakt">
              {/* Plats — chip row (VÅG 4b). Visas BARA vid >1 aktiv plats; en-plats-
                  salonger ser ingenting (UX byte-identisk). Byte av plats nollställer
                  tjänst/frisör/tid via pickLocation. */}
              {multiLocation && (
                <>
                  <div className="ckompakt-label">Plats</div>
                  <div className="ckompakt-chiprow" role="group" aria-label="Välj plats">
                    {locations.map((l) => {
                      const on = locationId === l.id
                      return (
                        <button
                          key={l.id}
                          type="button"
                          className={`ckompakt-chip${on ? ' selected' : ''}`}
                          aria-pressed={on}
                          onClick={() => pickLocation(l.id)}
                        >
                          {l.name}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Tjänst — chip row (namn + mono-pris) */}
              <div className="ckompakt-label">Tjänst</div>
              <div className="ckompakt-chiprow" role="group" aria-label="Välj tjänst">
                {services.map((s) => {
                  const on = service?.id === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`ckompakt-chip${on ? ' selected' : ''}`}
                      aria-pressed={on}
                      onClick={() => {
                        setService(s)
                        setStaffChoice('any')
                        setSlot(null)
                        setError(null)
                      }}
                    >
                      <span>{s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name}</span>
                      <span className="ckompakt-chip-meta">{kr.format(s.priceCents / 100)}</span>
                    </button>
                  )
                })}
              </div>

              {/* Personal-chip-row (Alla + each staff of the chosen service). Label
                  is the bransch-resolved staff noun (default 'Frisör'). */}
              <div className="ckompakt-label">{staffNoun}</div>
              <div
                className="ckompakt-chiprow"
                role="group"
                aria-label={`Välj ${staffNoun.toLowerCase()}`}
              >
                <button
                  type="button"
                  className={`ckompakt-chip${staffChoice === 'any' ? ' selected' : ''}`}
                  aria-pressed={staffChoice === 'any'}
                  onClick={() => setStaffChoice('any')}
                >
                  Alla
                </button>
                {staffHere.map((m) => {
                  const on = staffChoice === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`ckompakt-chip${on ? ' selected' : ''}`}
                      aria-pressed={on}
                      onClick={() => setStaffChoice(m.id)}
                    >
                      {m.title ?? staffNoun}
                    </button>
                  )
                })}
              </div>

              {/* Dag — 60px-chips (dow + display-datum) */}
              <div className="ckompakt-label">Dag</div>
              <div className="wizard-days" role="group" aria-label="Välj dag">
                {days.map((d) => {
                  const key = ymd(d)
                  const isSel = date === key
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`wizard-day${isSel ? ' selected' : ''}`}
                      aria-pressed={isSel}
                      onClick={() => {
                        setSlotTakenNotice(null)
                        setDate(key)
                      }}
                    >
                      <span className="fc-day-dow">{fmtDow(d)}</span>
                      <span className="fc-day-dom">{d.getDate()}</span>
                    </button>
                  )
                })}
              </div>

              {/* Tid — 4-col grid. Async: skeleton/error/empty tills slots resolvar. */}
              <div className="ckompakt-label">Tid</div>
              {pending ? (
                slotSkeleton
              ) : slotsError ? (
                slotError(() => service && date && fetchSlots(service.id, staffChoice, date, locationId))
              ) : slots.length === 0 ? (
                <p className="fc-noslots-inline">Inga lediga tider den dagen — välj en annan.</p>
              ) : (
                <div className="ckompakt-slots" role="group" aria-label="Välj tid">
                  {slots.map(slotButton)}
                </div>
              )}

              {/* Exakt en kontaktväg: SMS när Giada är frisk, annars e-post. */}
              <div className="ckompakt-fields">
                <label className="fc-field">
                  <span>Namn</span>
                  <input
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                {contactMode === 'sms' ? (
                  <label className="fc-field">
                    <span>Telefon</span>
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      placeholder="070-000 00 00"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </label>
                ) : contactMode === 'email' ? (
                  <label className="fc-field">
                    <span>E-post</span>
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="du@exempel.se"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </label>
                ) : (
                  <p className="wizard-muted">Kontrollerar kontaktväg…</p>
                )}
              </div>

              {slotTakenNotice ? (
                <p className="fc-alert" role="alert" style={{ marginTop: 14 }}>
                  {slotTakenNotice}
                </p>
              ) : null}
              {error ? (
                <p className="fc-alert" role="alert" style={{ marginTop: 14 }}>
                  {error}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Single bottom CTA — thumb reach, with a live mono summary sub-line. */}
        {services.length > 0 && (
          <div className="wizard-actionbar">
            <button
              type="button"
              className="wizard-cta"
              disabled={!compactReady || pending}
              onClick={submitCompact}
            >
              <span className="wizard-cta-label">{pending ? 'Skickar kod…' : bokaCta}</span>
              {compactReady && slot && service ? (
                <span className="wizard-cta-sub">
                  {service.name} · {fmtTime(slot.start)}
                </span>
              ) : (
                <span className="wizard-cta-sub">
                  Välj tjänst, tid &amp; fyll i namn + {contactMode === 'email' ? 'e-post' : 'telefon'}
                </span>
              )}
            </button>
            <ConsentLine />
          </div>
        )}
      </div>
    )
  }

  // ── Plats-grind (VÅG 4b, BARA flerplats-wizard) ─────────────────────────────
  // Renderas FÖRE steg-maskinen, som en ledande grind — INTE som ett omnumrerat
  // steg. Steg-räknaren (n / 5), canAdvance och alla `step === N` lämnas orörda.
  // Vid ≤1 plats (alla nuvarande tenants + tester) körs detta aldrig → byte-
  // identiskt. När en plats valts faller komponenten igenom till steg 1 (tjänst).
  if (needsLocationPick) {
    return (
      <div className="wizard wizard--steps fc-scope">
        <div className="wizard-head">
          <h2 className="wizard-q">Var vill du boka?</h2>
        </div>
        <div className="wizard-stepbody">
          <p className="wizard-muted" style={{ marginTop: 0 }}>
            Välj plats — vi visar lediga tider för just den platsen.
          </p>
          <ul className="wizard-list">
            {locations.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="wizard-card"
                  aria-pressed={locationId === l.id}
                  onClick={() => pickLocation(l.id)}
                >
                  <span className="wizard-card-main">
                    <span className="fc-card-title">{l.name}</span>
                  </span>
                  {l.isPrimary ? <span className="fc-role">Huvudplats</span> : null}
                  {locationId === l.id ? <span className="fc-ring" aria-hidden /> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // ── Kalender-vyn (steg 3, pickerMode='calendar') ────────────────────────────
  // Månadskalender över bokningsfönstret (days, BOOKING_WINDOW_DAYS): förflutna dagar och
  // dagar bortom fönstret är disabled/faded; availability-dot sätts på ALLA
  // bokningsbara fönster-dagar (pragmatiskt beslut — getAvailableSlots är per dag,
  // N anrop för en månad vore oärligt dyrt; tomma dagar visar ärligt tom-state
  // efter klick). Idag = ink-2-ring; vald = rust-fill; bläddring begränsad till
  // månader som fönstret rör.
  const cal = calMonths[Math.min(calCursor, calMonths.length - 1)]!
  const todayKey = ymd(days[0]!)
  const lastKey = ymd(days[days.length - 1]!)
  const firstOfMonth = new Date(cal.y, cal.m, 1)
  const startCol = (firstOfMonth.getDay() + 6) % 7 // Mån-först
  const daysInMonth = new Date(cal.y, cal.m + 1, 0).getDate()
  const monthName = new Intl.DateTimeFormat('sv-SE', { month: 'long' }).format(firstOfMonth)
  const calTitle = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${cal.y}`
  const ariaDay = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  type CalCell = { key: string; day: number; disabled: boolean; isToday: boolean; aria: string } | null
  const calCells: CalCell[] = []
  for (let i = 0; i < startCol; i++) calCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dObj = new Date(cal.y, cal.m, d)
    const key = ymd(dObj)
    calCells.push({
      key,
      day: d,
      disabled: key < todayKey || key > lastKey,
      isToday: key === todayKey,
      aria: ariaDay.format(dObj),
    })
  }
  while (calCells.length % 7 !== 0) calCells.push(null)

  // ── Variant 3 (wizard) — steg-för-steg, ett beslut per skärm ─────────────────
  return (
    <div className="wizard wizard--steps fc-scope">
      {/* HEAD (handoff): mono steglabel + "n / 5" + 5 segment, display-frågan och
          recap-raden. Döljs på bekräftelsen (steg 5) så biljetten läser rent. */}
      {step < 5 && (
        <div className="wizard-head">
          <div className="wizard-progress">
            <span className="wizard-progress-label">{stepLabels[step - 1]}</span>
            <span className="wizard-progress-count">{Math.min(step, 5)} / 5</span>
          </div>
          <div className="wizard-progress-track" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`wizard-progress-seg${i < step ? ' on' : ''}`} />
            ))}
          </div>
          <h2 className="wizard-q">{stepTitles[step - 1]}</h2>
          {recapText ? <div className="fc-recap">{recapText}</div> : null}
        </div>
      )}

      <div className={`wizard-stepbody${step === 5 ? ' fc-stepbody--ticket' : ''}`}>
        {/* Step 1 — service */}
        {step === 1 &&
          (services.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon} aria-hidden>
                ✂️
              </div>
              <p className={styles.emptyTitle}>Inga tjänster att boka just nu</p>
              <p className={styles.emptyText}>
                Inga bokningsbara tjänster ännu — hör av dig{brandName ? ` till ${brandName}` : ''} direkt.
              </p>
            </div>
          ) : (
            <div className="fc-step">
              <ul className="wizard-list">
                {services.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="wizard-card"
                      aria-pressed={service?.id === s.id}
                      onClick={() => pickService(s)}
                    >
                      <span className="wizard-card-main">
                        <span className="fc-card-titlerow">
                          <span className="fc-card-title">{s.name}</span>
                          {s.popular ? <span className="fc-tag">POPULÄR</span> : null}
                        </span>
                        {s.description ? (
                          <span className="wizard-card-sub">{s.description}</span>
                        ) : null}
                      </span>
                      <span className="wizard-card-meta">
                        <span className="fc-price">{kr.format(s.priceCents / 100)}</span>
                        <span className="fc-dur">{s.durationMin} min</span>
                      </span>
                      {service?.id === s.id ? <span className="fc-ring" aria-hidden /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        {/* Step 2 — staff ("Alla" först, sedan barberarkort med avatar-läge). */}
        {step === 2 && service && (
          <div className="fc-step">
            <ul className="wizard-list">
              <li>
                <button
                  type="button"
                  className="wizard-card wizard-card--staff"
                  aria-pressed={staffChoice === 'any'}
                  onClick={() => pickStaff('any')}
                >
                  <span className="fc-avatar fc-avatar--any" aria-hidden>
                    ✦
                  </span>
                  <span className="wizard-card-main">
                    <span className="fc-card-title">Alla</span>
                    <span className="fc-role">Vem som helst</span>
                  </span>
                  <span className="fc-meta-any">FÖRSTA LEDIGA</span>
                  {staffChoice === 'any' ? (
                    <>
                      <span className="fc-ring" aria-hidden />
                      <span className="fc-check" aria-hidden>
                        ✓
                      </span>
                    </>
                  ) : null}
                </button>
              </li>
              {staffHere.map((m, i) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="wizard-card wizard-card--staff"
                    aria-pressed={staffChoice === m.id}
                    onClick={() => pickStaff(m.id)}
                  >
                    <StaffAvatar
                      name={m.title ?? staffNoun}
                      avatarUrl={m.avatarUrl}
                      mode={staffAvatarMode}
                      index={i}
                    />
                    <span className="wizard-card-main">
                      <span className="fc-card-title">{m.title ?? staffNoun}</span>
                      <span className="fc-role">{staffNoun}</span>
                    </span>
                    {staffChoice === m.id ? (
                      <>
                        <span className="fc-ring" aria-hidden />
                        <span className="fc-check" aria-hidden>
                          ✓
                        </span>
                      </>
                    ) : null}
                  </button>
                </li>
              ))}
              {staffHere.length === 0 && (
                <li>
                  <p className={styles.emptyText} style={{ padding: '0.5rem 0.25rem' }}>
                    Ingen specifik personal är kopplad — välj “Alla” för tidigast lediga tid.
                  </p>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Step 3 — datum (kalender ELLER dag-remsa, tenant-valbart) + slots. */}
        {step === 3 && service && (
          <div className="fc-step">
            {/* Krock-notis: tiden togs precis. Vänligt, ej blockerande. */}
            {slotTakenNotice ? (
              <p className="fc-alert" role="alert">
                {slotTakenNotice}
              </p>
            ) : null}

            {pickerMode === 'strip' ? (
              <div className="wizard-days" role="group" aria-label="Välj dag">
                {days.map((d) => {
                  const key = ymd(d)
                  const isSel = date === key
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`wizard-day${isSel ? ' selected' : ''}`}
                      aria-pressed={isSel}
                      onClick={() => {
                        setSlotTakenNotice(null)
                        pickDate(key)
                      }}
                    >
                      <span className="fc-day-dow">{fmtDow(d)}</span>
                      <span className="fc-day-dom">{d.getDate()}</span>
                      <span className="fc-day-mon">{fmtMon(d)}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="fc-cal">
                <div className="fc-cal-head">
                  <button
                    type="button"
                    className="fc-cal-nav"
                    onClick={() => setCalCursor((c) => Math.max(0, c - 1))}
                    disabled={calCursor <= 0}
                    aria-label="Föregående månad"
                  >
                    ‹
                  </button>
                  <span className="fc-cal-title">{calTitle}</span>
                  <button
                    type="button"
                    className="fc-cal-nav"
                    onClick={() => setCalCursor((c) => Math.min(calMonths.length - 1, c + 1))}
                    disabled={calCursor >= calMonths.length - 1}
                    aria-label="Nästa månad"
                  >
                    ›
                  </button>
                </div>
                <div className="fc-cal-dows" aria-hidden>
                  <span>Mån</span>
                  <span>Tis</span>
                  <span>Ons</span>
                  <span>Tors</span>
                  <span>Fre</span>
                  <span>Lör</span>
                  <span>Sön</span>
                </div>
                <div className="fc-cal-grid" role="group" aria-label="Välj dag">
                  {calCells.map((c, i) =>
                    c === null ? (
                      <span key={`e${i}`} aria-hidden />
                    ) : (
                      <button
                        key={c.key}
                        type="button"
                        className={`fc-cal-cell${date === c.key ? ' selected' : ''}${c.isToday ? ' is-today' : ''}`}
                        disabled={c.disabled}
                        aria-pressed={date === c.key}
                        aria-label={c.aria}
                        onClick={() => {
                          setSlotTakenNotice(null)
                          pickDate(c.key)
                        }}
                      >
                        {c.day}
                        {!c.disabled ? <span className="fc-cal-dot" aria-hidden /> : null}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* loading: skeleton-chips medan slots resolvar */}
            {pending && slotSkeleton}

            {/* error: notis + retry */}
            {!pending && slotsError && slotError(() => date && pickDate(date))}

            {/* empty: only when we genuinely have a day, no error, not loading */}
            {!pending && !slotsError && date && slots.length === 0 && (
              <div className="fc-noslots">
                <div className="fc-noslots-glyph" aria-hidden>
                  —
                </div>
                <p>
                  Inga lediga tider den dagen.
                  <br />
                  Prova en annan dag.
                </p>
              </div>
            )}

            {/* success: slots grupperade Morgon / Dagtid / Kväll */}
            {!pending && !slotsError && slots.length > 0 && (
              <div className="fc-slotgroups">
                {slotGroups.map((g) => (
                  <div key={g.label}>
                    <div className="fc-label">{g.label}</div>
                    <div className="fc-slot-grid" role="group" aria-label={`Välj tid — ${g.label}`}>
                      {g.items.map(slotButton)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4 — details. The submit BUTTON lives in the bottom action bar;
            the <form> stays (with a ref) so required-field + type validation still
            runs when the bar's "Bekräfta bokning" calls requestSubmit(). */}
        {step === 4 && service && slot && (verification ? verificationPanel : (
          <div className="fc-step">
            <div className="fc-summary">
              <span className="fc-summary-main">
                <span className="fc-summary-name">{service.name}</span>
                <span className="fc-summary-meta">
                  {fmtTime(slot.start)}
                  {staffChoice !== 'any' && slot.staffTitle ? ` · ${slot.staffTitle}` : ''} ·{' '}
                  {service.durationMin} min
                </span>
              </span>
              <span className="fc-summary-price">{kr.format(service.priceCents / 100)}</span>
            </div>
            <form
              ref={formRef}
              className="wizard-form"
              onSubmit={(e) => {
                e.preventDefault()
                beginVerification()
              }}
            >
              {/* Steg 4 var fyra NAKNA fält i rad — kassan grupperar sina, det här
                  gjorde det inte. Två grupper (kontakt / meddelande) ger samma
                  läsbara hierarki: vad vi MÅSTE ha, och vad du får lägga till. */}
              <div className="fc-label">Dina kontaktuppgifter</div>
              <label className="fc-field">
                <span>Namn</span>
                <input
                  required
                  autoComplete="name"
                  placeholder="För- och efternamn"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              {contactMode === 'sms' ? (
                <label className="fc-field">
                  <span>Telefon</span>
                  <input
                    required
                    type="tel"
                    autoComplete="tel"
                    placeholder="070-000 00 00"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
              ) : contactMode === 'email' ? (
                <label className="fc-field">
                  <span>E-post</span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="du@exempel.se"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
              ) : (
                <p className="wizard-muted">Kontrollerar kontaktväg…</p>
              )}
              <div className="fc-label" style={{ marginTop: 4 }}>
                Något vi bör veta?
              </div>
              <label className="fc-field">
                <span>
                  Meddelande <span className="fc-optional">(valfritt)</span>
                </span>
                <input
                  placeholder={`Önskemål till din ${staffNoun.toLowerCase()}`}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>
              {error ? (
                <p className="fc-alert" role="alert">
                  {error}
                </p>
              ) : null}
              {/* Hidden submit keeps requestSubmit() + Enter-to-submit working;
                  the visible CTA is the sticky bottom action bar. */}
              <button type="submit" className="wizard-form-submit" tabIndex={-1} aria-hidden>
                Skicka verifieringskod
              </button>
            </form>
          </div>
        ))}

        {/* Step 5 — statusbiljetten. RPC-statusen styr all copy: en pending
            förfrågan får aldrig presenteras som bokad eller kalenderklar. */}
        {step === 5 && service && slot && (
          <div className="fc-ticket-wrap">
            {/* H4: ritad bock (samma payoff som köp-rälsens kvitto). */}
            <span className="fc-mark" aria-hidden>
              <svg
                viewBox="0 0 24 24"
                width="26"
                height="26"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path className="fc-mark-path" d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <div className="fc-ticket-booked">
              {bookingPresentation.eyebrow}
            </div>
            <h2 className="fc-ticket-title">
              {bookingPresentation.heading}
            </h2>
            <p className="fc-ticket-sub">{bookingPresentation.message}</p>

            <div className="fc-ticket">
              <div className="fc-stamp" aria-hidden>
                {bookingPresentation.stamp}
              </div>
              <div className="fc-ticket-head">
                <span className="fc-ticket-brand">{brandName || 'Bokning'}</span>
                <span className="fc-ticket-ref">
                  {bookingId ? bookingId.slice(0, 8).toUpperCase() : ''}
                </span>
              </div>
              <div className="fc-ticket-rows">
                <span className="fc-ticket-rowlabel">Tjänst</span>
                <span className="fc-ticket-rowvalue">{service.name}</span>
                {slot.staffTitle ? (
                  <>
                    <span className="fc-ticket-rowlabel">{staffNoun}</span>
                    <span className="fc-ticket-rowvalue">{slot.staffTitle}</span>
                  </>
                ) : null}
                <span className="fc-ticket-rowlabel">Tid</span>
                <span className="fc-ticket-rowvalue">
                  {fmtLongDate(slot.start)}
                  <br />
                  <span className="fc-ticket-time">kl. {fmtTime(slot.start)}</span>
                </span>
              </div>
              <div className="fc-ticket-foot">
                <span className="fc-ticket-footlabel">
                  {bookingStatus === 'pending' ? 'Pris om tiden bekräftas' : 'Att betala på plats'}
                </span>
                <span className="fc-ticket-price">{kr.format(service.priceCents / 100)}</span>
              </div>
            </div>

            <div className="fc-ticket-actions">
              {bookingId && bookingPresentation.canAddToCalendar ? (
                // Befintlig .ics-väg: kvittosidan bygger kalenderfilen server-side.
                <Link href={`/boka/bekraftelse/${bookingId}`} className="fc-btn-ink">
                  Lägg till i kalender
                </Link>
              ) : null}
              <button type="button" className="fc-btn-outline" onClick={resetWizard}>
                Boka en till tid
              </button>
              {/* "Avboka eller boka om"-länken kräver den token-signerade avboka-URL:en
                  (cancel-token, finns bara i mejlet) — ingen giltig länk kan byggas här,
                  och en död länk är förbjuden. Mejlet bär avboka-vägen. */}
            </div>
          </div>
        )}
      </div>
      {/* /.wizard-stepbody */}

      {/* BOTTOM ACTION BAR: ← back (52px, från steg 2) + full-bredd
          Fortsätt/Bekräfta bokning. Sticky i botten. Döljs på bekräftelsen. */}
      {step < 5 && (
        <div className="wizard-actionbar">
          {step > 1 ? (
            <button
              type="button"
              className="wizard-back-btn"
              disabled={pending}
              onClick={goBack}
              aria-label="Tillbaka"
            >
              <span aria-hidden>←</span>
            </button>
          ) : null}
          <button
            type="button"
            className="wizard-cta"
            disabled={!canAdvance || pending}
            onClick={goNext}
          >
            <span className="wizard-cta-label">
              {step === 4
                ? verification
                  ? pending ? 'Verifierar…' : 'Verifiera & boka'
                  : pending ? 'Skickar kod…' : 'Skicka kod'
                : 'Fortsätt'}
            </span>
            {/* Den låsta knappen SÄGER vad som fattas i stället för att bara vara
                grå — compact-läget gjorde redan det, stegläget lämnade kunden i
                tystnad precis när hen behövde veta varför det inte går vidare. */}
            {!canAdvance && !pending ? (
              <span className="wizard-cta-sub">{blockedHint}</span>
            ) : null}
          </button>
          {/* Samtyckesraden bara på bekräftelsesteget — informativ, aldrig en
              blockerande kryssruta (friktion i bokningsflödet är dyr; plan 003). */}
          {step === 4 ? <ConsentLine /> : null}
        </div>
      )}
    </div>
  )
}

/** Villkorsraden vid bokningens submit (plan 003 — informationsplikten för
 *  tjänstebokning). En rad, inte en kryssruta: att trycka på boka ÄR handlingen. */
function ConsentLine() {
  return (
    <p
      style={{
        margin: '8px 0 0',
        fontSize: 11,
        lineHeight: 1.4,
        textAlign: 'center',
        opacity: 0.75,
        width: '100%',
      }}
    >
      Genom att boka godkänner du våra <a href="/villkor">villkor</a> och{' '}
      <a href="/integritetspolicy">integritetspolicy</a>.
    </p>
  )
}
