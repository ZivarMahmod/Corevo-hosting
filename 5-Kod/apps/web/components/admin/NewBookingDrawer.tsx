'use client'

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createAdminBooking,
  loadDaySlots,
  searchCustomers,
  type CreateBookingState,
  type CustomerHit,
} from '@/lib/admin/calendar-actions'
import type { AdminSlot } from '@/lib/admin/calendar-slots'
import { Button, Callout, Icon, Modal, useToast } from '@/components/portal/ui'
import styles from './calendar.module.css'

/** Skapa bokning — kalenderns viktigaste flöde (goal-66, B-11…B-17).
 *
 *  Wavys ordning, för den har lägst beslutskostnad:
 *    1. Tjänst  (systemet vet nu hur lång tiden är och vem som kan utföra den)
 *    2. Tid     (BARA giltiga luckor erbjuds — fel går inte att göra)
 *    3. Kund    (ETT fält som söker OCH skapar; bara namn krävs)
 *    4. Spara   (efter serverns bekräftelse, aldrig före)
 *
 *  Klickade man på en ledig yta i gridet ärvs resurs + tid därifrån och steg 2
 *  hoppas över — kontexten skrivs aldrig om (Wavys "nytt objekt ärver sin plats"). */

export type CalendarService = {
  id: string
  name: string
  durationMin: number
  priceCents: number | null
}

/** Förifylld kontext från ett klick i gridet. */
export type NewBookingSeed = {
  staffId: string
  staffName: string
  /** UTC ISO för den snappade starttiden. */
  startIso: string
}

const priceLabel = (cents: number | null) =>
  cents == null ? '' : `${(cents / 100).toLocaleString('sv-SE')} kr`

type CustomerSearchStatus = 'idle' | 'debouncing' | 'searching' | 'settled' | 'error'

const slotMatchesPicked = (
  picked: { staffId: string; startIso: string } | null,
  slots: AdminSlot[],
) =>
  Boolean(
    picked &&
    slots.some((slot) => slot.staffId === picked.staffId && slot.startIso === picked.startIso),
  )

export function NewBookingDrawer({
  services,
  staffNames,
  date,
  tz,
  locationId,
  seed,
  onClose,
}: {
  services: CalendarService[]
  /** staffId → namn, för att kunna sätta etikett på en lucka. */
  staffNames: Map<string, string>
  date: string
  tz: string
  locationId?: string
  seed: NewBookingSeed | null
  onClose: () => void
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [state, formAction, pending] = useActionState<CreateBookingState, FormData>(
    createAdminBooking,
    {},
  )

  const [serviceId, setServiceId] = useState('')
  const [slots, setSlots] = useState<AdminSlot[]>([])
  const [slotsLoading, startSlots] = useTransition()
  const slotLoadSeq = useRef(0)
  // Vald tid. Kommer från gridklicket (seed) eller från en luckchip.
  const [picked, setPicked] = useState<{ staffId: string; startIso: string } | null>(
    seed ? { staffId: seed.staffId, startIso: seed.startIso } : null,
  )

  const [customerQuery, setCustomerQuery] = useState('')
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [customerSearchStatus, setCustomerSearchStatus] = useState<CustomerSearchStatus>('idle')
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null)
  const [chosen, setChosen] = useState<CustomerHit | null>(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [notifyChoice, setNotifyChoice] = useState<'ingen' | 'automatisk'>('ingen')
  // Samma intent-id lever genom fel/retry medan drawern är monterad. Ett förlorat
  // svar får då tillbaka samma bokning i stället för en falsk tidskonflikt.
  const [requestId] = useState(() => crypto.randomUUID())

  const service = services.find((s) => s.id === serviceId) ?? null

  // Luckor laddas när tjänsten valts — inte innan. Utan tjänst vet vi inte hur lång
  // tiden är, och kan alltså inte veta vad som får plats.
  useEffect(() => {
    const sequence = ++slotLoadSeq.current
    if (!serviceId) {
      setSlots([])
      return
    }
    startSlots(async () => {
      const res = await loadDaySlots({ serviceId, date, locationId })
      if (slotLoadSeq.current !== sequence) return
      if (res.error) {
        notify(res.error, 'warning')
        setSlots([])
        setPicked(null)
      } else {
        const nextSlots = res.slots ?? []
        setSlots(nextSlots)
        if (!slotMatchesPicked(picked, nextSlots)) setPicked(null)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, date, locationId])

  // Kundsök: en kontroll som söker OCH skapar. Debounce så vi inte skickar en fråga
  // per tangenttryck.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const customerSearchSeq = useRef(0)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const sequence = ++customerSearchSeq.current
    if (chosen) {
      setCustomerSearchStatus('idle')
      setCustomerSearchError(null)
      return
    }
    const q = customerQuery.trim()
    if (q.length < 2) {
      setHits([])
      setCustomerSearchError(null)
      setCustomerSearchStatus('idle')
      return
    }
    setHits([])
    setCustomerSearchError(null)
    setCustomerSearchStatus('debouncing')
    timer.current = setTimeout(async () => {
      setCustomerSearchStatus('searching')
      try {
        const result = await searchCustomers(q)
        if (customerSearchSeq.current !== sequence) return
        if (result.error) {
          setHits([])
          setCustomerSearchError(result.error)
          setCustomerSearchStatus('error')
          return
        }
        setHits(result.hits)
        setCustomerSearchStatus('settled')
      } catch {
        if (customerSearchSeq.current !== sequence) return
        setHits([])
        setCustomerSearchError('Kundsökningen gick inte att genomföra.')
        setCustomerSearchStatus('error')
      }
    }, 220)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      if (customerSearchSeq.current === sequence) customerSearchSeq.current += 1
    }
  }, [customerQuery, chosen])

  useEffect(() => {
    if (state.success) {
      notify(state.success, 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const slotsByStaff = useMemo(() => {
    const map = new Map<string, AdminSlot[]>()
    for (const s of slots) {
      const list = map.get(s.staffId) ?? []
      list.push(s)
      map.set(s.staffId, list)
    }
    return map
  }, [slots])

  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    )

  // Kontaktvägen avgör vad som KAN köas. Routern avgör sedan kanal från
  // kundens aktuella samtycke/preferenser; UI:t lovar aldrig en viss leverans.
  const contactEmail = chosen?.email ?? (email.trim() || null)
  const contactPhone = chosen?.phone ?? (phone.trim() || null)
  const canNotify = Boolean(contactEmail || contactPhone)

  const customerResolved = Boolean(chosen) || customerSearchStatus === 'settled'
  const readyToSave = Boolean(
    service &&
    slotMatchesPicked(picked, slots) &&
    customerResolved &&
    customerQuery.trim().length >= 2,
  )

  return (
    <Modal
      title="Ny bokning"
      sub={
        picked
          ? `${timeOf(picked.startIso)} · ${staffNames.get(picked.staffId) ?? ''}`
          : 'Välj tjänst och tid'
      }
      onClose={onClose}
      ariaLabel="Ny bokning"
      footer={
        <form action={formAction} style={{ width: '100%' }}>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="service" value={serviceId} />
          <input type="hidden" name="staff" value={picked?.staffId ?? ''} />
          <input type="hidden" name="start" value={picked?.startIso ?? ''} />
          <input type="hidden" name="location" value={locationId ?? ''} />
          <input type="hidden" name="customerId" value={chosen?.id ?? ''} />
          <input type="hidden" name="guestName" value={chosen ? '' : customerQuery.trim()} />
          <input type="hidden" name="guestEmail" value={chosen ? '' : email.trim()} />
          <input type="hidden" name="guestPhone" value={chosen ? '' : phone.trim()} />
          <input type="hidden" name="note" value={note.trim()} />
          {/* Notisvalet måste följa med till servern — annars visar drawern ett löfte
              som ingen infriar. Saknas kontaktväg tvingas valet till "ingen". */}
          <input type="hidden" name="notify" value={canNotify ? notifyChoice : 'ingen'} />
          <Button
            type="submit"
            variant="primary"
            icon="check"
            disabled={!readyToSave || pending}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {pending ? 'Sparar…' : 'Boka'}
          </Button>
        </form>
      }
    >
      <div style={{ display: 'grid', gap: 18 }}>
        {state.error && (
          <Callout tone="warning" icon="alert">
            {state.error}
          </Callout>
        )}

        {/* 1. TJÄNST — längd och pris syns vid valet, precis som i Wavy. */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Tjänst
          </div>
          <div className={styles.chipRow}>
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.chip}${serviceId === s.id ? ` ${styles.chipOn}` : ''}`}
                onClick={() => {
                  setServiceId(s.id)
                  setSlots([])
                  // Byter man tjänst kan den gamla tiden vara för kort — men en tid som
                  // ärvts från ett gridklick behålls: den är användarens uttryckliga val.
                  if (!seed) setPicked(null)
                }}
                aria-pressed={serviceId === s.id}
              >
                <span className={styles.chipName}>{s.name}</span>
                <span className={`num ${styles.chipMeta}`}>
                  {s.durationMin} min{s.priceCents != null ? ` · ${priceLabel(s.priceCents)}` : ''}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 2. TID — bara giltiga luckor erbjuds. Fel går inte att göra. */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Tid
          </div>

          {picked && (
            <div className={styles.pickedRow}>
              <Icon name="clock" size={15} />
              <span className="num">{timeOf(picked.startIso)}</span>
              <span>{staffNames.get(picked.staffId) ?? ''}</span>
              {service && <span className={styles.pickedMeta}>{service.durationMin} min</span>}
              <button type="button" className={styles.pickedChange} onClick={() => setPicked(null)}>
                Byt tid
              </button>
            </div>
          )}

          {!picked &&
            (!serviceId ? (
              <p className={styles.hint}>
                Välj en tjänst — då visas de tider som faktiskt får plats.
              </p>
            ) : slotsLoading ? (
              <p className={styles.hint}>Räknar ut lediga tider…</p>
            ) : slots.length === 0 ? (
              <Callout tone="info" icon="info">
                Inga lediga tider för den här tjänsten den valda dagen. Prova en annan dag, eller
                kontrollera arbetstiderna under Inställningar.
              </Callout>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {[...slotsByStaff.entries()].map(([staffId, list]) => (
                  <div key={staffId}>
                    <div className={styles.slotStaff}>{staffNames.get(staffId) ?? 'Personal'}</div>
                    <div className={styles.chipRow}>
                      {list.map((s) => (
                        <button
                          key={s.startIso}
                          type="button"
                          className={`num ${styles.slotChip}`}
                          onClick={() => setPicked({ staffId, startIso: s.startIso })}
                        >
                          {timeOf(s.startIso)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </section>

        {/* 3. KUND — ETT fält. Söker bland befintliga; ingen träff = det du skrev blir
            en ny kund. Bara namnet krävs. */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Kund
          </div>

          {chosen ? (
            <div className={styles.pickedRow}>
              <Icon name="user" size={15} />
              <span style={{ fontWeight: 600 }}>{chosen.name}</span>
              <span className={styles.pickedMeta}>
                {chosen.email ?? chosen.phone ?? 'ingen kontakt'}
              </span>
              <button
                type="button"
                className={styles.pickedChange}
                onClick={() => {
                  setChosen(null)
                  setCustomerQuery('')
                }}
              >
                Byt kund
              </button>
            </div>
          ) : (
            <>
              <input
                className={styles.input}
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Namn, e-post eller telefon"
                aria-label="Sök eller skapa kund"
                autoComplete="off"
              />
              {hits.length > 0 && (
                <ul className={styles.hitList}>
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        className={styles.hit}
                        onClick={() => {
                          setChosen(h)
                          setHits([])
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{h.name}</span>
                        <span className={styles.pickedMeta}>{h.email ?? h.phone ?? '—'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {(customerSearchStatus === 'debouncing' || customerSearchStatus === 'searching') && (
                <p className={styles.hint} role="status">
                  Söker kunder…
                </p>
              )}
              {customerSearchStatus === 'error' && (
                <Callout tone="warning" icon="alert">
                  {customerSearchError ?? 'Kundsökningen gick inte att genomföra.'} Försök igen
                  innan du bokar, så att ingen dubblett skapas.
                </Callout>
              )}
              {customerSearchStatus === 'settled' && hits.length === 0 && (
                <>
                  <p className={styles.hint}>
                    Ingen träff — <b>{customerQuery.trim()}</b> läggs upp som ny kund. E-post och
                    telefon är frivilliga.
                  </p>
                  <div className={styles.twoCol}>
                    <input
                      className={styles.input}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="E-post (frivillig)"
                      aria-label="E-post"
                      type="email"
                    />
                    <input
                      className={styles.input}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Telefon (frivillig)"
                      aria-label="Telefon"
                      type="tel"
                    />
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {/* 4. NOTIS — vad som faktiskt skickas, FÖRE spara. Utan kontaktväg är valet
            avstängt MED förklaring, inte bara grått. */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Meddelande till kunden
          </div>
          <div className={styles.radioList}>
            <label className={styles.radio}>
              <input
                type="radio"
                name="notify"
                checked={notifyChoice === 'ingen'}
                onChange={() => setNotifyChoice('ingen')}
              />
              <span>Skicka inget</span>
            </label>
            <label className={`${styles.radio}${canNotify ? '' : ` ${styles.radioOff}`}`}>
              <input
                type="radio"
                name="notify"
                checked={notifyChoice === 'automatisk'}
                disabled={!canNotify}
                onChange={() => setNotifyChoice('automatisk')}
              />
              <span>
                {canNotify ? (
                  <>
                    Köa bekräftelse via tillgänglig kanal
                    <span className="num"> {contactEmail ?? contactPhone}</span>
                  </>
                ) : (
                  'Kunden saknar e-post och telefon'
                )}
              </span>
            </label>
          </div>
          <p className={styles.hint}>
            Systemet väljer push, e-post eller SMS enligt kundens aktuella val. SMS levereras
            inte innan den separata SMS-grinden aktiveras.
          </p>
        </section>

        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Anteckning <span style={{ textTransform: 'none' }}>(syns aldrig för kunden)</span>
          </div>
          <textarea
            className={styles.input}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            aria-label="Intern anteckning"
          />
        </section>
      </div>
    </Modal>
  )
}
