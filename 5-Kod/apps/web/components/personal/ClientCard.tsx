'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  getClientCard,
  getCustomerContact,
  type ClientCardResult,
  type ContactResult,
} from '@/lib/personal/actions'
import { fmtDateTime } from '@/lib/personal/format'
import {
  Drawer,
  Badge,
  CustomerRecognition,
  LoyaltyBlock,
  Card,
  Icon,
  tierTone,
} from '@/components/portal/ui'
import { CustomerNotesForm } from './CustomerNotesForm'
import styles from './personal.module.css'

const STATUS_SV: Record<string, string> = {
  pending: 'Ej bekräftad',
  confirmed: 'Bekräftad',
  completed: 'Genomförd',
  cancelled: 'Avbokad',
  no_show: 'Uteblev',
}

/** Year-only "kund sedan" label from an ISO instant (e.g. "2024"). */
function sinceYear(iso: string | null): string | null {
  if (!iso) return null
  const y = new Date(iso).getUTCFullYear()
  return Number.isFinite(y) ? String(y) : null
}

/**
 * Client-card trigger + recognition drawer (M5 §2.2/§2.3, Staff.jsx
 * StaffRecognition). The frisör taps a customer's name on a day row → a drawer
 * loads the card lazily and leads with the shared CustomerRecognition header,
 * then surfaces what the frisör needs to "ha koll": the preferences they know,
 * the customer's note for this visit, loyalty, history, contact-PII (time-bound,
 * via PiiReveal) and the internal client-card form. Walk-ins / unlinked guests
 * have no customerId → no button (nothing to recognise).
 */
export function ClientCard({
  customerId,
  label,
  bookingNote = null,
}: {
  customerId: string | null
  label: string
  /** The customer-channel note on THIS booking (single shared bookings.note). */
  bookingNote?: string | null
}) {
  const [open, setOpen] = useState(false)
  if (!customerId) return null

  return (
    <>
      <button
        type="button"
        className={styles.cardLink}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {label}
      </button>
      {open ? (
        <ClientCardDrawer
          customerId={customerId}
          fallbackName={label}
          bookingNote={bookingNote}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

function ClientCardDrawer({
  customerId,
  fallbackName,
  bookingNote,
  onClose,
}: {
  customerId: string
  fallbackName: string
  bookingNote: string | null
  onClose: () => void
}) {
  const [data, setData] = useState<ClientCardResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getClientCard(customerId)
      .then((r) => {
        if (alive) setData(r)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [customerId])

  const ok = data && data.ok ? data : null
  const card = ok?.card ?? null
  const tier = card?.loyalty.tier ?? null
  const visits = card?.visits ?? null

  const accent =
    card && (tier || (visits != null && visits >= 5)) ? (
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {tier ? (
          <Badge tone={tierTone(tier)} dot={false}>
            {tier}
          </Badge>
        ) : null}
        {visits != null && visits >= 5 ? (
          <Badge tone="success" dot={false}>
            Stamkund · {visits} besök
          </Badge>
        ) : null}
      </div>
    ) : undefined

  return (
    <Drawer
      title={card ? card.displayName : fallbackName}
      sub="Klientkort"
      accent={accent}
      ariaLabel="Klientkort"
      onClose={onClose}
    >
      {loading ? (
        <p className="body">Laddar klientkort…</p>
      ) : !ok ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Klientkortet kunde inte laddas</p>
          <p className={styles.emptyHint}>Kunden hittades inte. Försök igen.</p>
        </div>
      ) : (
        <CardBody
          customerId={customerId}
          card={ok.card}
          notes={ok.notes}
          bookingNote={bookingNote}
        />
      )}
    </Drawer>
  )
}

function CardBody({
  customerId,
  card,
  notes,
  bookingNote,
}: {
  customerId: string
  card: Extract<ClientCardResult, { ok: true }>['card']
  notes: Extract<ClientCardResult, { ok: true }>['notes']
  bookingNote: string | null
}) {
  const tz = card.history[0]?.timeZone ?? 'Europe/Stockholm'
  const firstName = card.displayName.split(' ')[0]
  const prefs = notes.preferences

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {/* Recognition header — who is this customer (shared primitive). */}
      <CustomerRecognition
        name={card.displayName}
        protectedName={card.nameHidden}
        tier={card.loyalty.tier}
        visits={card.visits}
        since={sinceYear(card.firstSeenAt)}
      />

      {/* Quick recognition strip — senaste besök, brukar komma, bjuds på.
          cadence ("Brukar komma") + beverage ("Bjuds på") have NO backing column
          (data-gated absent, getCustomerCadenceHint/Beverage return null), so they
          render an honest "—" rather than the mock's placeholder sample values. */}
      <div
        style={{
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
          padding: '14px 16px',
          background: 'var(--c-paper-2)',
          borderRadius: 12,
        }}
      >
        <StripItem
          label="Senaste besök"
          value={card.lastVisitTs ? fmtDateTime(card.lastVisitTs, tz) : 'Inget än'}
        />
        <StripItem label="Brukar komma" value="—" />
        <StripItem label="Bjuds på" value="—" />
      </div>

      {/* "Inför besöket · från kunden" — the customer's note for THIS booking. */}
      {bookingNote ? (
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Inför besöket · från kunden
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: '11px 13px',
              background: 'var(--c-gold-100)',
              borderRadius: 11,
            }}
          >
            <Icon
              name="message"
              size={15}
              style={{ color: 'var(--c-gold-600)', flex: 'none', marginTop: 1 }}
            />
            <div style={{ fontSize: 13, color: 'var(--c-ink)', lineHeight: 1.45 }}>{bookingNote}</div>
          </div>
        </section>
      ) : null}

      {/* "Det du vet om {namn}" — the real preference chips (customer_notes). */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Det du vet om {firstName}
        </div>
        {prefs.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {prefs.map((p) => (
              <span
                key={p}
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--c-ink)',
                  background: 'var(--c-paper-2)',
                  border: '1px solid var(--c-line)',
                  borderRadius: 999,
                  padding: '5px 12px',
                }}
              >
                {p}
              </span>
            ))}
          </div>
        ) : (
          <p className="small" style={{ margin: 0 }}>
            Inget noterat än. Det du fyller i nedan dyker upp här nästa gång.
          </p>
        )}
      </section>

      {/* Loyalty — shared block in a paper card (read/derived only). */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Lojalitet
        </div>
        {card.loyalty.hasProgram ? (
          <Card>
            <LoyaltyBlock
              world="backoffice"
              tier={card.loyalty.tier}
              points={card.loyalty.points}
              nextTierAt={
                card.loyalty.toNext != null ? card.loyalty.points + card.loyalty.toNext : null
              }
            />
          </Card>
        ) : (
          <p className="small" style={{ margin: 0 }}>
            {card.loyalty.points === 0
              ? 'Inga poäng än. Poäng tjänas vid genomförda besök.'
              : `${card.loyalty.points.toLocaleString('sv-SE')} poäng. Nivåer är inte aktiverade för verksamheten.`}
          </p>
        )}
      </section>

      {/* Contact-PII — time-bound. Fetched on the operator's explicit "Visa"
          (fetch-on-intent), never eagerly: get_customer_contact is the gating
          RPC and access stays tied to a deliberate action. */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Kontakt · tidsbunden
        </div>
        <ContactSection customerId={customerId} nameHidden={card.nameHidden} />
      </section>

      {/* History */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Tidigare hos er
        </div>
        {card.history.length === 0 ? (
          <p className="small" style={{ margin: 0 }}>
            Inga tidigare bokningar.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 2 }}>
            {card.history.slice(0, 6).map((h, i, arr) => (
              <div
                key={h.bookingId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--c-line)' : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--c-ink)' }}>
                    {h.serviceName ?? 'Tjänst'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-ink-3)' }}>
                    {fmtDateTime(h.startTs, h.timeZone)}
                    {h.staffTitle ? ` · ${h.staffTitle}` : ''} · {STATUS_SV[h.status] ?? h.status}
                  </div>
                </div>
                <span className="num" style={{ fontSize: 12.5, color: 'var(--c-ink-2)', whiteSpace: 'nowrap' }}>
                  {h.priceCents != null ? `${Math.round(h.priceCents / 100)} kr` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Internal client-card form (staff-only). The preference chips above are
          the read-side of exactly these notes — editing here updates them. */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Klientkort · internt
        </div>
        <p className="small" style={{ margin: '0 0 4px' }}>
          Endast för dig och verksamheten. Visas aldrig för kunden.
        </p>
        <CustomerNotesForm customerId={customerId} notes={notes} />
      </section>
    </div>
  )
}

function StripItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--c-ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '.05em',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3, color: 'var(--c-ink)' }}>
        {value}
      </div>
    </div>
  )
}

function ContactSection({ customerId, nameHidden }: { customerId: string; nameHidden: boolean }) {
  const [contact, setContact] = useState<ContactResult | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [pending, startTransition] = useTransition()

  // Fetched ONLY on the operator's explicit "Visa" (fetch-on-intent), never on
  // open. get_customer_contact is the gating RPC: it returns phone/email only when
  // a booking is in the operative window (or the caller is the customer); outside
  // it, pii_visible=false and the values stay null. Access stays a deliberate act.
  const reveal = () => {
    startTransition(async () => {
      const r = await getCustomerContact(customerId)
      setContact(r)
      setRevealed(true)
    })
  }

  return (
    <div className={styles.piiBox}>
      {!revealed ? (
        <>
          <p className={styles.muted} style={{ margin: 0 }}>
            Telefon och e-post visas bara i driftfönstret kring kundens bokning.
          </p>
          <button type="button" className={styles.btn} onClick={reveal} disabled={pending}>
            {pending ? 'Hämtar…' : 'Visa kontaktuppgifter'}
          </button>
        </>
      ) : contact && contact.piiVisible ? (
        <div className={styles.piiGrid}>
          <PiiValue label="Telefon" value={contact.phone ?? '–'} />
          <PiiValue label="E-post" value={contact.email ?? '–'} />
        </div>
      ) : (
        <p className={styles.muted} style={{ margin: 0 }}>
          {nameHidden
            ? 'Kunden har dolt sina uppgifter, och det finns ingen bokning i driftfönstret just nu.'
            : 'Inga kontaktuppgifter i driftfönstret just nu — de visas automatiskt nära kundens bokning.'}
        </p>
      )}
    </div>
  )
}

function PiiValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={styles.detailLabel}>{label}</div>
      <div className={styles.detailValue}>{value}</div>
    </div>
  )
}
