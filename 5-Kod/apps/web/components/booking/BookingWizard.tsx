'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  getAvailableSlots,
  createBooking,
  startBookingCheckout,
  type SlotOption,
} from '@/app/boka/actions'

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

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function BookingWizard({ services }: { services: WizardService[] }) {
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

  function pickService(s: WizardService) {
    setService(s)
    setStaffChoice('any')
    setDate(null)
    setSlots([])
    setSlot(null)
    setStep(2)
  }

  function pickStaff(choice: string) {
    setStaffChoice(choice)
    setDate(null)
    setSlots([])
    setSlot(null)
    setStep(3)
  }

  function pickDate(d: string) {
    if (!service) return
    setDate(d)
    setSlot(null)
    setError(null)
    startTransition(async () => {
      const res = await getAvailableSlots(service.id, staffChoice === 'any' ? null : staffChoice, d)
      if (res.ok) {
        setSlots(res.slots)
        setTimeZone(res.timeZone)
      } else {
        setSlots([])
        setError(res.error)
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
        // Allt fel/degrade landar tyst på bekräftelsesidan (betala på plats).
        if (res.requiresPayment) {
          const pay = await startBookingCheckout(res.bookingId)
          if (pay.ok) {
            window.location.href = pay.url
            return
          }
        }
        router.push(`/boka/bekraftelse/${res.bookingId}`)
      } else {
        setError(res.message)
        if (res.reason === 'slot_taken' && date) {
          setStep(3)
          pickDate(date) // refresh slots
        }
      }
    })
  }

  return (
    <div className="wizard">
      <ol className="wizard-steps">
        {['Tjänst', 'Personal', 'Tid', 'Uppgifter'].map((label, i) => (
          <li key={label} className={step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}>
            <span className="wizard-step-num">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {/* Step 1 — service */}
      {step === 1 && (
        <ul className="wizard-list">
          {services.map((s) => (
            <li key={s.id}>
              <button type="button" className="wizard-card" onClick={() => pickService(s)}>
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
      )}

      {/* Step 2 — staff (or anyone) */}
      {step === 2 && service && (
        <div>
          <button type="button" className="wizard-back" onClick={() => setStep(1)}>
            ← {service.name}
          </button>
          <ul className="wizard-list">
            <li>
              <button type="button" className="wizard-card" onClick={() => pickStaff('any')}>
                <strong>Alla</strong>
                <span className="wizard-card-meta">Första lediga tid</span>
              </button>
            </li>
            {service.staff.map((m) => (
              <li key={m.id}>
                <button type="button" className="wizard-card" onClick={() => pickStaff(m.id)}>
                  <strong>{m.title ?? 'Frisör'}</strong>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 3 — date + time */}
      {step === 3 && service && (
        <div>
          <button type="button" className="wizard-back" onClick={() => setStep(2)}>
            ← Välj personal
          </button>
          <div className="wizard-days">
            {days.map((d) => {
              const key = ymd(d)
              return (
                <button
                  key={key}
                  type="button"
                  className={`wizard-day${date === key ? ' selected' : ''}`}
                  onClick={() => pickDate(key)}
                >
                  {fmtDay(d)}
                </button>
              )
            })}
          </div>

          {pending && <p className="wizard-muted">Hämtar lediga tider…</p>}
          {!pending && date && slots.length === 0 && (
            <p className="wizard-muted">Inga lediga tider denna dag. Välj en annan dag.</p>
          )}
          <div className="wizard-times">
            {slots.map((sl) => (
              <button
                key={sl.start + sl.staffId}
                type="button"
                className={`wizard-time${slot?.start === sl.start && slot?.staffId === sl.staffId ? ' selected' : ''}`}
                onClick={() => {
                  setSlot(sl)
                  setStep(4)
                }}
              >
                {fmtTime(sl.start)}
                {staffChoice === 'any' && sl.staffTitle ? (
                  <span className="wizard-time-staff">{sl.staffTitle}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4 — details + confirm */}
      {step === 4 && service && slot && (
        <div>
          <button type="button" className="wizard-back" onClick={() => setStep(3)}>
            ← Välj tid
          </button>
          <div className="wizard-summary">
            <strong>{service.name}</strong> · {fmtTime(slot.start)}
            {slot.staffTitle ? ` · ${slot.staffTitle}` : ''} · {kr.format(service.priceCents / 100)}
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
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="auth-field">
              <span>E-post</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="auth-field">
              <span>Telefon</span>
              <input
                required
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
    </div>
  )
}
