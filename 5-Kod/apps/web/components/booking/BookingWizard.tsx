'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  getAvailableSlots,
  createBooking,
  startBookingCheckout,
  type SlotOption,
} from '@/app/boka/actions'
import styles from './booking.module.css'

type WizardStaff = { id: string; title: string | null; locationIds: string[] }
export type WizardService = {
  id: string
  name: string
  description: string | null
  durationMin: number
  priceCents: number
  staff: WizardStaff[]
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

// Accent "selected" fill via the product accent token. Applied inline because the
// frozen global selectors (.wizard-day.selected etc.) out-specify a module class.
// On the storefront --color-accent is re-pointed to the theme primary (never Corevo
// gold), so the text must use --color-accent-fg (white on the storefront, tenant-
// recomputed on override) — NOT --color-fg, which would be dark-on-dark on the
// darker themes (e.g. "edit").
const goldSelected = {
  background: 'var(--color-accent, var(--color-primary))',
  color: 'var(--color-accent-fg, #fff)',
  borderColor: 'var(--color-accent, var(--color-primary))',
} as const

// Card "selected" border-only highlight (gold ring, no fill).
const goldBorder = { borderColor: 'var(--color-accent, var(--color-primary))' } as const

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
  staffNoun = 'Frisör',
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
  /** Set when the wizard is embedded in the storefront drawer. Lets step 5's
   *  primary action close the drawer (instead of linking to "/"). */
  onClose?: () => void
  /** Variant 3 wizard (default) or Variant 4 kompakt snabbboka. */
  mode?: BookingMode
  /** Customer-facing staff noun (singular), bransch-resolved on the SERVER mount
   *  and passed down as a plain string. OPTIONAL — defaults to 'Frisör' so the
   *  un-edited sajtbyggare mount (and any caller that doesn't pass it) renders
   *  EXACTLY today's text. Tenants with a bransch override read e.g. 'Barberare',
   *  'Nagelteknolog', 'Stylist'. Resolve via resolveTerm(terminology,'staff',
   *  'Frisör') — NEVER pass the raw terminology object to this client component. */
  staffNoun?: string
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

  const [step, setStep] = useState(1)
  const [service, setService] = useState<WizardService | null>(null)
  const [staffChoice, setStaffChoice] = useState<string>('any') // 'any' | staffId
  const [date, setDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [timeZone, setTimeZone] = useState('Europe/Stockholm')
  const [slot, setSlot] = useState<SlotOption | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', note: '' })
  const [error, setError] = useState<string | null>(null)
  // Bekräftelse-steget (in-page): satt när bokningen lyckats utan online-betalning.
  const [bookingId, setBookingId] = useState<string | null>(null)
  // Step-3 specific load/error so it never gets confused with the empty state.
  const [slotsError, setSlotsError] = useState<string | null>(null)
  // "Tiden togs precis"-notis: visas överst i steg 3 efter en krock; överlever
  // slot-uppdateringen så användaren förstår varför hen är tillbaka här.
  const [slotTakenNotice, setSlotTakenNotice] = useState<string | null>(null)

  const days = useMemo(() => {
    const out: Date[] = []
    const base = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      out.push(d)
    }
    return out
  }, [])

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone }).format(
      new Date(iso),
    )
  const fmtDay = (d: Date) =>
    new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
  // Full datum + tid till bekräftelsesteget — speglar /boka/bekraftelse-rutten.
  const fmtDateTime = (iso: string) =>
    new Intl.DateTimeFormat('sv-SE', { dateStyle: 'full', timeStyle: 'short', timeZone }).format(
      new Date(iso),
    )

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
  // Selection NO LONGER auto-advances (handoff VWizard = one decision per screen
  // + an explicit "Fortsätt"). Each picker only sets state; the bottom action
  // bar advances. Selecting a service/staff still RESETS downstream choices.
  function pickService(s: WizardService) {
    setService(s)
    setStaffChoice('any')
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
  }, [slot])

  function submit() {
    if (!service || !slot) return
    setError(null)
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID()
    startTransition(async () => {
      // Transport-fel (nät dör mitt i anropet) får ALDRIG bubbla till error-
      // boundaryn — den unmountar drawern, slänger allt kunden skrivit och
      // lockar till en OM-bokning fast den första kan ha gått igenom (audit
      // P0-2/P1-4). Fånga, behåll allt state, säg sanningen.
      let res: Awaited<ReturnType<typeof createBooking>>
      try {
        res = await createBooking({
          serviceId: service.id,
          staffId: slot.staffId,
          startISO: slot.start,
          name: form.name,
          email: form.email,
          phone: form.phone,
          note: form.note,
          // Vald plats (VÅG 4b); null → servern faller tillbaka på primär plats.
          locationId,
          requestId: requestIdRef.current ?? undefined,
        })
      } catch {
        setError(
          'Något gick fel med uppkopplingen. Din bokning KAN ha gått igenom — kolla din e-post efter en bekräftelse innan du försöker igen.',
        )
        return
      }
      if (res.ok) {
        // Online-betalning på (payments_enabled && charges_enabled) → Stripe Checkout.
        // Allt fel/degrade landar tyst på bekräftelsen (betala på plats) — sant
        // efter P0-1-fixen: en misslyckad checkout lämnar ingen payment-rad, så
        // bokningen överlever som vanlig betala-på-plats. Ett KAST här får inte
        // unwinda — bokningen är redan durabel, visa bekräftelsen.
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
          // ⭐ KÄRNKRAV (Zivar): inbäddat i storefront-drawern sker bekräftelsen
          // IN-PAGE — vi byter till steg 5 i samma wizard istället för att navigera
          // bort. Rutten /boka/bekraftelse/[id] finns kvar som delbar djuplänk.
          setBookingId(res.bookingId)
          setStep(5)
        } else {
          // Fristående /boka-rutten: behåll den rika kvittosidan (med .ics +
          // betalstatus) — finding #11 gäller drawer-flödet, inte denna route.
          router.push(`/boka/bekraftelse/${res.bookingId}`)
        }
      } else {
        if (res.reason === 'slot_taken' && date) {
          // Krock: gå tillbaka till tidsvalet, visa notisen, ladda om tiderna.
          // pickDate nollställer error/slotsError men INTE slotTakenNotice.
          setStep(3)
          pickDate(date) // refresh slots
          setSlotTakenNotice(res.message)
        } else {
          setError(res.message)
        }
      }
    })
  }

  // Nollställ hela wizarden till steg 1. Körs på en stängd→öppen flank EFTER en
  // klar bokning (se effekten nedan), så en återöppnad drawer börjar om från
  // början istället för att visa en gammal bekräftelse.
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

  // "Klar" på bekräftelsesteget: stäng drawern (reseten sker vid nästa öppning).
  function finish() {
    onClose?.()
  }

  // ── Variant 3 (wizard) bottom-action-bar wiring ────────────────────────────
  // The handoff VWizard puts ALL forward/back navigation in a single bottom bar.
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
            ? !!(form.name && form.email && form.phone)
            : true

  function goNext() {
    if (step === 4) {
      // Trigger native form validation + submit (keeps required + types).
      formRef.current?.requestSubmit()
      return
    }
    if (step < 4) setStep((s) => s + 1)
  }
  function goBack() {
    if (step > 1) setStep((s) => s - 1)
  }

  // ── Variant 4 (compact) submit ─────────────────────────────────────────────
  // One CTA at the bottom. Validates name + phone (the only two fields compact
  // shows) before delegating to the shared submit() — same engine, same Stripe /
  // in-page-confirmation / slot-collision behaviour.
  const compactReady = !!(service && slot && form.name && form.phone)
  function submitCompact() {
    if (!compactReady) {
      setError('Fyll i tjänst, tid, namn och telefon.')
      return
    }
    submit()
  }

  const stepLabels = ['Tjänst', 'Personal', 'Tid', 'Uppgifter']
  const stepTitles = ['Vad vill du boka?', 'Hos vem?', 'När passar det?', 'Dina uppgifter']

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

  // ── Variant 4 (compact) — kompakt snabbboka, allt på en skärm ───────────────
  // The whole booking on one scroll: chip rows for tjänst/frisör/dag, a 4-col
  // slot grid (disabled until getAvailableSlots resolves), name+phone side by
  // side, and a single bottom "Boka tid" CTA with a summary sub-line. After a
  // successful booking the shared step-5 confirmation takes over (below).
  if (compact && step !== 5) {
    return (
      <div className="wizard wizard--compact">
        {services.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon} aria-hidden>
              ✂️
            </div>
            <p className={styles.emptyTitle}>Inga tjänster att boka just nu</p>
            <p className={styles.emptyText}>
              Salongen har inte lagt upp några bokningsbara tjänster ännu. Försök igen senare eller
              kontakta salongen direkt.
            </p>
          </div>
        ) : (
          <div className="ckompakt">
            <p className="ckompakt-lede">Allt på en skärm — för dig som vet vad du vill.</p>

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
                        style={on ? goldSelected : undefined}
                        onClick={() => pickLocation(l.id)}
                      >
                        {l.name}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* Tjänst — chip row */}
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
                    style={on ? goldSelected : undefined}
                    onClick={() => {
                      setService(s)
                      setStaffChoice('any')
                      setSlot(null)
                      setError(null)
                    }}
                  >
                    {s.name}
                    <span className="ckompakt-chip-meta">{kr.format(s.priceCents / 100)}</span>
                  </button>
                )
              })}
            </div>

            {/* Personal-chip-row (Alla + each staff of the chosen service). Label
                is the bransch-resolved staff noun (default 'Frisör'). */}
            <div className="ckompakt-label">{staffNoun}</div>
            <div className="ckompakt-chiprow" role="group" aria-label={`Välj ${staffNoun.toLowerCase()}`}>
              <button
                type="button"
                className={`ckompakt-chip${staffChoice === 'any' ? ' selected' : ''}`}
                aria-pressed={staffChoice === 'any'}
                style={staffChoice === 'any' ? goldSelected : undefined}
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
                    style={on ? goldSelected : undefined}
                    onClick={() => setStaffChoice(m.id)}
                  >
                    {m.title ?? staffNoun}
                  </button>
                )
              })}
            </div>

            {/* Dag — chip row (reuses the wizard-day visual) */}
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
                    style={isSel ? goldSelected : undefined}
                    onClick={() => {
                      setSlotTakenNotice(null)
                      setDate(key)
                    }}
                  >
                    {fmtDay(d)}
                  </button>
                )
              })}
            </div>

            {/* Tid — 4-col grid. Async: disabled/empty until slots resolve. */}
            <div className="ckompakt-label">Tid</div>
            {pending ? (
              <div className="ckompakt-slots" aria-hidden>
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className={styles.skeletonChip} />
                ))}
              </div>
            ) : slotsError ? (
              <div style={{ marginTop: '0.25rem' }}>
                <p className="auth-error" role="alert">
                  {slotsError}
                </p>
                <button
                  type="button"
                  className={styles.retry}
                  onClick={() => service && date && fetchSlots(service.id, staffChoice, date, locationId)}
                >
                  ↻ Försök igen
                </button>
              </div>
            ) : slots.length === 0 ? (
              <p className="wizard-muted" style={{ marginTop: '0.25rem' }}>
                Inga lediga tider denna dag — välj en annan dag.
              </p>
            ) : (
              <div className="ckompakt-slots" role="group" aria-label="Välj tid">
                {slots.map((sl) => {
                  const isSel = slot?.start === sl.start && slot?.staffId === sl.staffId
                  return (
                    <button
                      key={sl.start + sl.staffId}
                      type="button"
                      className={`wizard-time${isSel ? ' selected' : ''}`}
                      aria-pressed={isSel}
                      style={isSel ? goldSelected : undefined}
                      onClick={() => {
                        setSlot(sl)
                        setSlotTakenNotice(null)
                      }}
                    >
                      {fmtTime(sl.start)}
                      {staffChoice === 'any' && sl.staffTitle ? (
                        <span className="wizard-time-staff">{sl.staffTitle}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Namn + Telefon side by side */}
            <div className="ckompakt-fields">
              <label className="auth-field">
                <span>Namn</span>
                <input
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="auth-field">
                <span>Telefon</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
            </div>
            <label className="auth-field">
              <span>E-post</span>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>

            {slotTakenNotice ? (
              <p className="auth-error" role="alert">
                {slotTakenNotice}
              </p>
            ) : null}
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}

        {/* Single bottom CTA — thumb reach, with a live summary sub-line. */}
        {services.length > 0 && (
          <div className="wizard-actionbar">
            <button
              type="button"
              className="wizard-cta"
              disabled={!compactReady || pending}
              onClick={submitCompact}
              style={compactReady && !pending ? goldSelected : undefined}
            >
              <span className="wizard-cta-label">{pending ? 'Bokar…' : 'Boka tid'}</span>
              {compactReady && slot ? (
                <span className="wizard-cta-sub">
                  {service!.name} · {fmtTime(slot.start)}
                </span>
              ) : (
                <span className="wizard-cta-sub">Välj tjänst, tid och fyll i dina uppgifter</span>
              )}
            </button>
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
      <div className="wizard wizard--steps">
        <h2 className="wizard-q">Var vill du boka?</h2>
        <div className="wizard-stepbody">
          <p className="wizard-muted" style={{ marginTop: 0 }}>
            Välj salong — vi visar lediga tider för just den platsen.
          </p>
          <ul className="wizard-list">
            {locations.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="wizard-card"
                  onClick={() => pickLocation(l.id)}
                  style={locationId === l.id ? goldBorder : undefined}
                >
                  <span className="wizard-card-main">
                    <strong>{l.name}</strong>
                  </span>
                  {l.isPrimary ? <span className="wizard-card-meta">Huvudsalong</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // ── Variant 3 (wizard) — steg-för-steg, en beslut per skärm ─────────────────
  return (
    <div className="wizard wizard--steps">
      {/* TOP PROGRESS BAR (handoff VWizard): 5 segments + "n / 5". Sticky so it
          stays visible while the step body scrolls. Hidden on the confirmation
          step (step 5) so the kvitto-vy reads clean. */}
      {step < 5 && (
        <div className="wizard-progress">
          <div className="wizard-progress-head">
            <span className="wizard-progress-label">{stepLabels[step - 1]}</span>
            <span className="wizard-progress-count">{Math.min(step, 5)} / 5</span>
          </div>
          <div className="wizard-progress-track" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`wizard-progress-seg${i < step ? ' on' : ''}`}
                style={i < step ? { background: 'var(--color-accent, var(--color-primary))' } : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Per-step heading (handoff: one big question per screen). */}
      {step < 5 && <h2 className="wizard-q">{stepTitles[step - 1]}</h2>}

      <div className="wizard-stepbody">

      {/* Step 1 — service */}
      {step === 1 &&
        (services.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon} aria-hidden>
              ✂️
            </div>
            <p className={styles.emptyTitle}>Inga tjänster att boka just nu</p>
            <p className={styles.emptyText}>
              Salongen har inte lagt upp några bokningsbara tjänster ännu. Försök igen senare eller
              kontakta salongen direkt.
            </p>
          </div>
        ) : (
          <ul className="wizard-list">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="wizard-card"
                  onClick={() => pickService(s)}
                  style={service?.id === s.id ? goldBorder : undefined}
                >
                  <span className="wizard-card-main">
                    <strong>{s.name}</strong>
                    {s.description ? <span className="wizard-card-sub">{s.description}</span> : null}
                  </span>
                  <span className="wizard-card-meta">
                    {s.durationMin} min · {kr.format(s.priceCents / 100)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {/* Step 2 — staff (or anyone). Back/forward now live in the bottom bar. */}
      {step === 2 && service && (
        <div>
          <ul className="wizard-list">
            <li>
              <button
                type="button"
                className="wizard-card"
                onClick={() => pickStaff('any')}
                style={staffChoice === 'any' ? goldBorder : undefined}
              >
                <span className="wizard-card-main">
                  <strong>Alla</strong>
                  <span className="wizard-card-sub">Tidigast möjliga tid hos vem som helst</span>
                </span>
                {staffChoice === 'any' ? (
                  <span className={styles.pickedChip} aria-hidden>
                    ✓
                  </span>
                ) : (
                  <span className="wizard-card-meta">Första lediga tid</span>
                )}
              </button>
            </li>
            {staffHere.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="wizard-card"
                  onClick={() => pickStaff(m.id)}
                  style={staffChoice === m.id ? goldBorder : undefined}
                >
                  <span className="wizard-card-main">
                    <strong>{m.title ?? staffNoun}</strong>
                  </span>
                  {staffChoice === m.id ? (
                    <span className={styles.pickedChip} aria-hidden>
                      ✓
                    </span>
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

      {/* Step 3 — date + time. Back/forward now live in the bottom bar. */}
      {step === 3 && service && (
        <div>
          {/* Krock-notis: tiden togs precis. Vänligt, ej blockerande. */}
          {slotTakenNotice ? (
            <p className="auth-error" role="alert">
              {slotTakenNotice}
            </p>
          ) : (
            <p className="wizard-muted" style={{ marginTop: 0 }}>
              Välj en dag och en ledig tid.
            </p>
          )}

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
                  style={isSel ? goldSelected : undefined}
                >
                  {fmtDay(d)}
                </button>
              )
            })}
          </div>

          {/* loading: shimmer chips while slots resolve */}
          {pending && (
            <>
              <div className={styles.loadingRow}>
                <span className={styles.spinner} aria-hidden />
                <span>Hämtar lediga tider…</span>
              </div>
              <div className={styles.skeletonTimes} aria-hidden>
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className={styles.skeletonChip} />
                ))}
              </div>
            </>
          )}

          {/* error: ink-red box + retry */}
          {!pending && slotsError && (
            <div style={{ marginTop: '1rem' }}>
              <p className="auth-error" role="alert">
                {slotsError}
              </p>
              <button
                type="button"
                className={styles.retry}
                onClick={() => date && pickDate(date)}
              >
                ↻ Försök igen
              </button>
            </div>
          )}

          {/* empty: only when we genuinely have a day, no error, not loading */}
          {!pending && !slotsError && date && slots.length === 0 && (
            <div className={styles.slotsEmpty}>
              <div className={styles.emptyIcon} aria-hidden>
                📅
              </div>
              <p className={styles.emptyTitle}>Inga lediga tider denna dag</p>
              <p className={styles.emptyText}>Välj en annan dag ovan så visar vi lediga tider.</p>
            </div>
          )}

          {/* prompt before any day is chosen */}
          {!pending && !slotsError && !date && (
            <p className="wizard-muted">Välj en dag ovan för att se lediga tider.</p>
          )}

          {/* success: the slot grid */}
          {!pending && !slotsError && slots.length > 0 && (
            <div className="wizard-times" role="group" aria-label="Välj tid">
              {slots.map((sl) => {
                const isSel = slot?.start === sl.start && slot?.staffId === sl.staffId
                return (
                  <button
                    key={sl.start + sl.staffId}
                    type="button"
                    className={`wizard-time${isSel ? ' selected' : ''}`}
                    aria-pressed={isSel}
                    style={isSel ? goldSelected : undefined}
                    onClick={() => {
                      // Select only — advancing is the bottom bar's "Fortsätt".
                      setSlot(sl)
                      setSlotTakenNotice(null)
                    }}
                  >
                    {fmtTime(sl.start)}
                    {staffChoice === 'any' && sl.staffTitle ? (
                      <span className="wizard-time-staff">{sl.staffTitle}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 4 — details. The submit BUTTON moved to the bottom action bar;
          the <form> stays (with a ref) so required-field + type validation still
          runs when the bar's "Bekräfta bokning" calls requestSubmit(). */}
      {step === 4 && service && slot && (
        <div>
          <div className="wizard-summary">
            <div className={styles.summaryRow}>
              <strong>{service.name}</strong>
              <span style={{ opacity: 0.75 }}>
                {fmtTime(slot.start)}
                {slot.staffTitle ? ` · ${slot.staffTitle}` : ''} · {service.durationMin} min
              </span>
              <span className={styles.summaryPrice}>{kr.format(service.priceCents / 100)}</span>
            </div>
          </div>
          <form
            ref={formRef}
            className="wizard-form"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <label className="auth-field">
              <span>Namn</span>
              <input
                required
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="auth-field">
              <span>E-post</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="auth-field">
              <span>Telefon</span>
              <input
                required
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="auth-field">
              <span>Meddelande (valfritt)</span>
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
            {/* Hidden submit keeps requestSubmit() + Enter-to-submit working;
                the visible CTA is the sticky bottom action bar. */}
            <button type="submit" className="wizard-form-submit" tabIndex={-1} aria-hidden>
              Bekräfta bokning
            </button>
          </form>
        </div>
      )}

      </div>{/* /.wizard-stepbody */}

      {/* BOTTOM ACTION BAR (handoff VWizard): Back arrow + full-width
          Fortsätt/Bekräfta. Sticky to the bottom so the primary action stays in
          thumb reach while the step body scrolls. Hidden on the confirmation. */}
      {step < 5 && (
        <div className="wizard-actionbar">
          {step > 1 ? (
            <button
              type="button"
              className="wizard-back-btn"
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
            style={canAdvance && !pending ? goldSelected : undefined}
          >
            <span className="wizard-cta-label">
              {step === 4 ? (pending ? 'Bokar…' : 'Bekräfta bokning') : 'Fortsätt'}
            </span>
          </button>
        </div>
      )}

      {/* Step 5 — in-page bekräftelse (⭐ kärnkrav). Kvitto-känsla utan att lämna
          storefronten: vi återanvänder de globala .confirm-*-klasserna så att
          steget ser identiskt ut med /boka/bekraftelse-rutten. Datan finns redan
          i wizarden (tjänst, tid, personal, pris, bokningsid). */}
      {step === 5 && service && slot && (
        <div className="booking-confirm">
          <div
            className="confirm-badge"
            aria-hidden
            style={{
              background: 'var(--color-accent, var(--color-primary))',
              color: 'var(--color-accent-fg, #fff)',
            }}
          >
            ✓
          </div>
          <h2>Tack, din tid är bokad!</h2>
          <ul className="confirm-summary">
            <li>
              <span>Tjänst</span>
              <strong>{service.name}</strong>
            </li>
            <li>
              <span>Tid</span>
              <strong>{fmtDateTime(slot.start)}</strong>
            </li>
            {slot.staffTitle ? (
              <li>
                <span>Hos</span>
                <strong>{slot.staffTitle}</strong>
              </li>
            ) : null}
            <li>
              <span>Pris</span>
              <strong>{kr.format(service.priceCents / 100)}</strong>
            </li>
          </ul>

          <p className="confirm-note">Du betalar på plats vid besöket.</p>

          <div className={styles.confirmActions}>
            {bookingId ? (
              <Link
                href={`/boka/bekraftelse/${bookingId}`}
                className={styles.calendarBtn}
                aria-label="Visa kvitto och lägg till i kalender"
              >
                Visa kvitto
              </Link>
            ) : null}
            {onClose ? (
              <button type="button" className="btn-primary" onClick={finish}>
                Klar
              </button>
            ) : (
              <Link href="/" className="btn-primary">
                Till startsidan
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
