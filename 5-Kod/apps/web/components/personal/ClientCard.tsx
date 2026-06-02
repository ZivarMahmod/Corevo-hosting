'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  getClientCard,
  getCustomerContact,
  type ClientCardResult,
  type ContactResult,
} from '@/lib/personal/actions'
import { fmtDateTime } from '@/lib/personal/format'
import { CustomerNotesForm } from './CustomerNotesForm'
import styles from './personal.module.css'

const STATUS_SV: Record<string, string> = {
  pending: 'Ej bekräftad',
  confirmed: 'Bekräftad',
  completed: 'Genomförd',
  cancelled: 'Avbokad',
  no_show: 'Uteblev',
}

/**
 * Client-card trigger + drawer (M5 §2.2/§2.3). The frisör clicks a customer's name
 * on a calendar row → a drawer loads the card lazily (identity / loyalty / history),
 * plus the internal notes form. Contact-PII is fetched separately on "Visa" and
 * only shown when the DB says we're in the operative window.
 *
 * Walk-ins / unlinked guests have no customerId → no button (nothing to show).
 */
export function ClientCard({
  customerId,
  label,
}: {
  customerId: string | null
  label: string
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
        <ClientCardDrawer customerId={customerId} onClose={() => setOpen(false)} />
      ) : null}
    </>
  )
}

function ClientCardDrawer({ customerId, onClose }: { customerId: string; onClose: () => void }) {
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

  return (
    <div className={styles.drawerOverlay} role="presentation" onClick={onClose}>
      <div
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Klientkort"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.drawerHead}>
          <h2 className={styles.drawerTitle}>
            {data && data.ok ? data.card.displayName : 'Klientkort'}
          </h2>
          <button type="button" className={styles.btn} onClick={onClose} aria-label="Stäng">
            Stäng
          </button>
        </div>

        {loading ? (
          <p className={styles.muted}>Laddar klientkort…</p>
        ) : !data || !data.ok ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Klientkortet kunde inte laddas</p>
            <p className={styles.emptyHint}>Kunden hittades inte. Försök igen.</p>
          </div>
        ) : (
          <CardBody customerId={customerId} data={data} />
        )}
      </div>
    </div>
  )
}

function CardBody({
  customerId,
  data,
}: {
  customerId: string
  data: Extract<ClientCardResult, { ok: true }>
}) {
  const { card, notes } = data

  return (
    <div className={styles.cardSections}>
      {/* Identity — persistent */}
      <section>
        <div className={styles.eyebrow}>Identitet · bestående</div>
        <div className={styles.detailGrid}>
          <Detail label="Återkommande" value={`${card.visits} ${card.visits === 1 ? 'besök' : 'besök'}`} />
          <Detail
            label="Senaste besök"
            value={card.lastVisitTs ? fmtDateTime(card.lastVisitTs, historyTz(card)) : 'Inget än'}
          />
          <Detail label="Favoritfrisör" value={card.favoriteStaffTitle ?? '–'} />
          <Detail label="Totalt bokningar" value={String(card.totalBookings)} />
        </div>
      </section>

      {/* Contact-PII — time-bound */}
      <ContactSection customerId={customerId} nameHidden={card.nameHidden} />

      {/* Loyalty — read/derived only */}
      <LoyaltySection loyalty={card.loyalty} />

      {/* History */}
      <section>
        <div className={styles.eyebrow}>Historik</div>
        {card.history.length === 0 ? (
          <p className={styles.muted}>Inga tidigare bokningar.</p>
        ) : (
          <ul className={styles.histList}>
            {card.history.map((h) => (
              <li key={h.bookingId} className={styles.histRow}>
                <div>
                  <div className={styles.histService}>{h.serviceName ?? 'Tjänst'}</div>
                  <div className={styles.histMeta}>
                    {fmtDateTime(h.startTs, h.timeZone)}
                    {h.staffTitle ? ` · ${h.staffTitle}` : ''} · {STATUS_SV[h.status] ?? h.status}
                  </div>
                </div>
                <span className={styles.histPrice}>
                  {h.priceCents != null ? `${Math.round(h.priceCents / 100)} kr` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Internal notes (staff-only) */}
      <section>
        <div className={styles.eyebrow}>Klientkort · internt</div>
        <p className={styles.muted}>
          Endast för dig och salongen. Visas aldrig för kunden.
        </p>
        <CustomerNotesForm customerId={customerId} notes={notes} />
      </section>
    </div>
  )
}

function historyTz(card: Extract<ClientCardResult, { ok: true }>['card']): string {
  return card.history[0]?.timeZone ?? 'Europe/Stockholm'
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={styles.detailLabel}>{label}</div>
      <div className={styles.detailValue}>{value}</div>
    </div>
  )
}

function ContactSection({ customerId, nameHidden }: { customerId: string; nameHidden: boolean }) {
  const [contact, setContact] = useState<ContactResult | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [pending, startTransition] = useTransition()

  const reveal = () => {
    startTransition(async () => {
      const r = await getCustomerContact(customerId)
      setContact(r)
      setRevealed(true)
    })
  }

  return (
    <section>
      <div className={styles.eyebrow}>Kontakt · tidsbunden</div>
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
            <Detail label="Telefon" value={contact.phone ?? '–'} />
            <Detail label="E-post" value={contact.email ?? '–'} />
          </div>
        ) : (
          <p className={styles.muted} style={{ margin: 0 }}>
            {nameHidden
              ? 'Kunden har dolt sina uppgifter, och det finns ingen bokning i driftfönstret just nu.'
              : 'Inga kontaktuppgifter i driftfönstret just nu — de visas automatiskt nära kundens bokning.'}
          </p>
        )}
      </div>
    </section>
  )
}

function LoyaltySection({
  loyalty,
}: {
  loyalty: Extract<ClientCardResult, { ok: true }>['card']['loyalty']
}) {
  return (
    <section>
      <div className={styles.eyebrow}>Lojalitet</div>
      {!loyalty.hasProgram ? (
        <p className={styles.muted}>
          {loyalty.points === 0
            ? 'Inga poäng än. Poäng tjänas vid genomförda besök.'
            : `${loyalty.points.toLocaleString('sv-SE')} poäng. Nivåer är inte aktiverade för salongen.`}
        </p>
      ) : (
        <>
          <div className={styles.loyaltyHead}>
            <span className={styles.loyaltyPoints}>
              {loyalty.points.toLocaleString('sv-SE')} <span style={{ fontSize: '0.9rem' }}>poäng</span>
            </span>
            {loyalty.tier ? <span className={styles.loyaltyTier}>{loyalty.tier}</span> : null}
          </div>
          {loyalty.toNext != null ? (
            <p className={styles.muted}>
              {loyalty.toNext.toLocaleString('sv-SE')} p kvar till nästa nivå.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
