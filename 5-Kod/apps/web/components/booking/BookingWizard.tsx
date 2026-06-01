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

type WizardStaff = { id: string; title: string | null }
export type WizardService = {
  id: string
  name: string
  description: string | null
  durationMin: number
  priceCents: number
  staff: WizardStaff[]
}

const kr = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
})

// Gold "selected" fill via the product accent token. Applied inline because the
// frozen global selectors (.wizard-day.selected etc.) out-specify a module class.
const goldSelected = {
  background: 'var(--color-accent, var(--color-primary))',
  color: 'var(--color-fg, #15281f)',
  borderColor: 'var(--color-accent, var(--color-primary))',
} as const

// Card "selected" border-only highlight (gold ring, no fill).
const goldBorder = { borderColor: 'var(--color-accent, var(--color-primary))' } as const

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function BookingWizard({
  services,
  open,
  onClose,
}: {
  services: WizardService[]
  /** Drawer open-state (embedded only). On a closed→open rising edge AFTER a
   *  completed booking we reset the wizard, so a reopened drawer starts fresh
   *  rather than on a stale confirmation. Mid-flow closes (step 1–4) are NOT
   *  reset, so an accidental close still resumes where the customer left off. */
  open?: boolean
  /** Set when the wizard is embedded in the storefront drawer. Lets step 5's
   *  primary action close the drawer (instead of linking to "/"). */
  onClose?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

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

  function pickService(s: WizardService) {
    setService(s)
    setStaffChoice('any')
    setDate(null)
    setSlots([])
    setSlot(null)
    setSlotsError(null)
    setSlotTakenNotice(null)
    setError(null)
    setStep(2)
  }

  function pickStaff(choice: string) {
    setStaffChoice(choice)
    setDate(null)
    setSlots([])
    setSlot(null)
    setSlotsError(null)
    setSlotTakenNotice(null)
    setStep(3)
  }

  function pickDate(d: string) {
    if (!service) return
    setDate(d)
    setSlot(null)
    setError(null)
    setSlotsError(null)
    startTransition(async () => {
      const res = await getAvailableSlots(service.id, staffChoice === 'any' ? null : staffChoice, d)
      if (res.ok) {
        setSlots(res.slots)
        setTimeZone(res.timeZone)
      } else {
        setSlots([])
        setSlotsError(res.error)
      }
    })
  }

  function submit() {
    if (!service || !slot) return
    setError(null)
    startTransition(async () => {
      const res = await createBooking({
        serviceId: service.id,
        staffId: slot.staffId,
        startISO: slot.start,
        name: form.name,
        email: form.email,
        phone: form.phone,
        note: form.note,
      })
      if (res.ok) {
        // Online-betalning på (payments_enabled && charges_enabled) → Stripe Checkout.
        // Allt fel/degrade landar tyst på bekräftelsen (betala på plats).
        if (res.requiresPayment) {
          const pay = await startBookingCheckout(res.bookingId)
          if (pay.ok) {
            window.location.href = pay.url
            return
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
    setService(null)
    setStaffChoice('any')
    setDate(null)
    setSlots([])
    setSlot(null)
    setForm({ name: '', email: '', phone: '', note: '' })
    setError(null)
    setSlotsError(null)
    setSlotTakenNotice(null)
    setBookingId(null)
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

  const stepLabels = ['Tjänst', 'Personal', 'Tid', 'Uppgifter']

  return (
    <div className="wizard">
      {/* Steg-indikatorn göms på bekräftelsesteget (steg 5) — då är flödet klart
          och kvitto-vyn ska kännas ren, precis som /boka/bekraftelse-rutten. */}
      {step < 5 && (
      <ol className="wizard-steps">
        {stepLabels.map((label, i) => {
          const isActive = step === i + 1
          const isDone = step > i + 1
          return (
            <li key={label} className={isActive ? 'active' : isDone ? 'done' : ''}>
              <span
                className="wizard-step-num"
                // active dot = gold; completed dot = forest (the frozen default).
                style={isActive ? goldSelected : undefined}
              >
                {isDone ? '✓' : i + 1}
              </span>
              {label}
            </li>
          )
        })}
      </ol>
      )}

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

      {/* Step 2 — staff (or anyone) */}
      {step === 2 && service && (
        <div>
          <button type="button" className="wizard-back" onClick={() => setStep(1)}>
            ← {service.name}
          </button>
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
            {service.staff.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="wizard-card"
                  onClick={() => pickStaff(m.id)}
                  style={staffChoice === m.id ? goldBorder : undefined}
                >
                  <span className="wizard-card-main">
                    <strong>{m.title ?? 'Frisör'}</strong>
                  </span>
                  {staffChoice === m.id ? (
                    <span className={styles.pickedChip} aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
            {service.staff.length === 0 && (
              <li>
                <p className={styles.emptyText} style={{ padding: '0.5rem 0.25rem' }}>
                  Ingen specifik personal är kopplad — välj “Alla” för tidigast lediga tid.
                </p>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Step 3 — date + time */}
      {step === 3 && service && (
        <div>
          <button type="button" className="wizard-back" onClick={() => setStep(2)}>
            ← Välj personal
          </button>

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
                      setSlot(sl)
                      setSlotTakenNotice(null)
                      setStep(4)
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

      {/* Step 4 — details + confirm */}
      {step === 4 && service && slot && (
        <div>
          <button type="button" className="wizard-back" onClick={() => setStep(3)}>
            ← Välj tid
          </button>
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
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? 'Bokar…' : 'Bekräfta bokning'}
            </button>
          </form>
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
              color: 'var(--color-fg, #15281f)',
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
