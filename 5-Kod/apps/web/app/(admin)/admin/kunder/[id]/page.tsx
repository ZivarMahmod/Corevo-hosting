import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { resolveTerm } from '@/lib/platform/verticals-shared'
import { getCustomerDetail, getCustomerContact, getCustomerLoyalty } from '@/lib/admin/data'
import { getMyFavorites } from '@/lib/kund/favorites'
import { getCustomerNotes } from '@/lib/personal/customer'
import { formatDateTime, formatPrice, statusLabel } from '@/lib/admin/format'
import { todayInTz } from '@/lib/admin/dates'
import { staffColor } from '@/lib/admin/staff-colors'
import { CustomerNoteEditor } from '@/components/admin/CustomerNoteEditor'
import { CustomerFlags } from '@/components/admin/CustomerFlags'
import { CustomerPrivacyForm } from '@/components/admin/CustomerPrivacyForm'
import { CustomerContactCard } from '@/components/admin/CustomerContactCard'
import { CustomerDangerZone } from '@/components/admin/CustomerDangerZone'
import { CustomerExport, type ExportRow } from '../CustomerExport'
import styles from '@/components/admin/kunder-v2.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kund · Adminpanel' }

const TIER_LABEL: Record<'guld' | 'silver' | 'brons' | 'ny', string> = {
  guld: 'Guld',
  silver: 'Silver',
  brons: 'Brons',
  ny: 'Ny',
}

const CANCELLED = new Set(['cancelled', 'no_show'])

export default async function CustomerCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireAdminArea('kunder')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <div className={styles.pane}>
        <div className={styles.paneInner}>
          <p className="prose">Inget företag är kopplat till ditt konto.</p>
        </div>
      </div>
    )
  }

  const customer = await getCustomerDetail(tenant.id, id)
  if (!customer) notFound()

  const [contact, favs, loyalty, notes] = await Promise.all([
    getCustomerContact(id),
    getMyFavorites(id),
    getCustomerLoyalty(tenant.id, id),
    getCustomerNotes(id),
  ])

  const tz = tenant.timeZone
  const staffTerm = resolveTerm(tenant.terminology, 'staff', 'Personal')
  const now = Date.now()

  // Härledda nyckeltal (ur historiken + ledger — aldrig fejkat).
  const totalCents = customer.history
    .filter((b) => !CANCELLED.has(b.status))
    .reduce((s, b) => s + (b.priceCents ?? 0), 0)
  const cancelCount = customer.history.filter((b) => CANCELLED.has(b.status)).length

  // NÄSTA = tidigaste kommande aktiva bokning (historiken är fallande sorterad).
  const upcoming = customer.history
    .filter((b) => !CANCELLED.has(b.status) && new Date(b.startTs).getTime() >= now)
    .sort((a, b) => new Date(a.startTs).getTime() - new Date(b.startTs).getTime())[0]

  const favStaff = favs.find((f) => f.kind === 'staff')
  const favService = favs.find((f) => f.kind === 'service')

  const initial = (customer.shownName.trim()[0] ?? '?').toUpperCase()
  const isNew = customer.firstSeenAt.slice(0, 7) === todayInTz(tz).slice(0, 7)

  const chips: Array<{ label: string; color: string }> = []
  if (customer.hidden) chips.push({ label: 'DOLD', color: 'var(--c-danger)' })
  else if (isNew) chips.push({ label: 'NY KUND', color: 'var(--c-gold)' })
  else if (customer.visits >= 5) chips.push({ label: 'STAMKUND', color: 'var(--c-ink-2)' })
  if (customer.nameHidden) chips.push({ label: 'SKYDDAT NAMN', color: 'var(--c-info)' })

  const phone = contact?.phone ?? null
  const email = contact?.email ?? null
  const channel = email ? 'E-POST ✓' : '—'
  // Varning bara när vi POSITIVT vet att kanaler saknas (i driftfönstret, inga fält).
  const noChannels = Boolean(contact?.piiVisible) && !email && !phone

  const exportRow: ExportRow[] = [
    {
      shownName: customer.shownName,
      tier: loyalty ? TIER_LABEL[loyalty.tier] : '—',
      visits: customer.visits,
      lastVisit: customer.lastSeenAt ? formatDateTime(customer.lastSeenAt, tz) : '—',
      favStaff: favStaff?.name ?? '—',
      loyaltyPoints: loyalty?.loyaltyPoints ?? 0,
    },
  ]

  return (
    <div className={styles.pane}>
      <div className={styles.paneInner}>
        <Link href="/admin/kunder" className={styles.back}>
          ← Kunder
        </Link>

        {/* ── header ── */}
        <div className={styles.header}>
          <div className={styles.headAvatar} aria-hidden="true">
            {initial}
          </div>
          <div className={styles.headMain}>
            <div className={styles.headName}>
              <h1>{customer.shownName}</h1>
              {chips.map((c) => (
                <span key={c.label} className={styles.headChip} style={{ color: c.color }}>
                  {c.label}
                </span>
              ))}
            </div>
            <div className={styles.headContact}>
              <span>{phone ?? 'Inget nummer i fönstret'}</span>
              <span className="muted">{email ?? '—'}</span>
              <span className="muted">kund sedan {formatDateTime(customer.firstSeenAt, tz)}</span>
            </div>
          </div>
          <div className={styles.headActions}>
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, '')}`} className={`${styles.btnGhost} ${styles.btnRing}`}>
                ✆ Ring
              </a>
            )}
            <Link href="/admin/bokningar" className={styles.btnPrimary}>
              Boka in
            </Link>
          </div>
        </div>

        {/* ── nyckeltal ── */}
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{customer.visits}</div>
            <div className={styles.statLbl}>besök</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{formatPrice(totalCents) || '0 kr'}</div>
            <div className={styles.statLbl}>totalt bokat</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{cancelCount}</div>
            <div className={styles.statLbl}>avbokningar</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{loyalty ? loyalty.loyaltyPoints.toLocaleString('sv-SE') : '—'}</div>
            <div className={styles.statLbl}>lojalitetspoäng</div>
          </div>
        </div>

        {/* ── NÄSTA ── */}
        <div className={styles.next}>
          {upcoming ? (
            <>
              <span className={styles.nextTag}>NÄSTA</span>
              <span className={styles.nextText}>
                {formatDateTime(upcoming.startTs, tz)} · {upcoming.serviceName}
              </span>
              <span className={styles.nextStaff}>
                <span
                  className={styles.dot}
                  style={{ background: staffColor(upcoming.staffId) }}
                  aria-hidden="true"
                />
                {upcoming.staffTitle}
              </span>
              <div style={{ flex: 1 }} />
              <Link href="/admin/bokningar" className={styles.link}>
                Visa i kalendern →
              </Link>
            </>
          ) : (
            <>
              <span className={`${styles.nextTag} ${styles.nextTagMuted}`}>NÄSTA</span>
              <span style={{ fontSize: 14, color: 'var(--c-ink-3)', fontStyle: 'italic' }}>
                Ingen kommande tid
              </span>
              <div style={{ flex: 1 }} />
              <Link href="/admin/bokningar" className={styles.btnPrimary} style={{ padding: '8px 14px' }}>
                Boka in
              </Link>
            </>
          )}
        </div>

        {/* ── två kolumner ── */}
        <div className={styles.cols}>
          <div className={styles.col}>
            <CustomerNoteEditor customerId={customer.id} initial={notes.internalNote ?? ''} />

            {/* FAVORITER */}
            <div className={styles.card}>
              <div className={styles.eyebrow} style={{ marginBottom: 12 }}>
                FAVORITER
              </div>
              {favStaff || favService ? (
                <div className={styles.favs}>
                  {favStaff && (
                    <span className={styles.favPill}>
                      <span
                        className={styles.dot}
                        style={{ background: staffColor(favStaff.staffId ?? favStaff.id) }}
                        aria-hidden="true"
                      />
                      {favStaff.name}
                    </span>
                  )}
                  {favService && (
                    <span className={`${styles.favPill} muted`}>✂ {favService.name}</span>
                  )}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--c-ink-3)', fontStyle: 'italic' }}>
                  Kunden har inte sparat någon favorit ännu.
                </p>
              )}
            </div>

            {/* KONTO & KOMMUNIKATION */}
            <div className={styles.card}>
              <div className={styles.eyebrow} style={{ marginBottom: 12 }}>
                KONTO &amp; KOMMUNIKATION
              </div>
              <div className={styles.kv}>
                <span>Kundkonto</span>
                <span className={styles.kvVal}>
                  <span
                    className={styles.dot}
                    style={{ background: customer.isLinkedAccount ? 'var(--c-ok, #9ac4a5)' : 'var(--c-ink-3)' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--c-ink-2)' }}>
                    {customer.isLinkedAccount ? 'Aktivt konto' : 'Gäst — inget konto'}
                  </span>
                </span>
              </div>
              <div className={styles.kv}>
                <span>Kan boka själv online</span>
                <span className={styles.kvMono}>{customer.selfBook ? 'PÅ' : 'AV'}</span>
              </div>
              <div className={styles.kv}>
                <span>Påminnelser</span>
                <span className={styles.kvMono}>{channel}</span>
              </div>
              <div className={styles.kv}>
                <span>Marknadsföring</span>
                <span className={styles.kvMono}>—</span>
              </div>
              {noChannels && (
                <div className={styles.warnRow}>
                  <span aria-hidden="true">⚠</span>
                  <span>Inga digitala kanaler — påminnelser hanteras manuellt</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.col}>
            {/* BESÖKSHISTORIK */}
            <div className={`${styles.card} ${styles.cardFlush}`}>
              <div className={styles.cardHead} style={{ padding: '10px 0 4px' }}>
                <div className={styles.eyebrow}>BESÖKSHISTORIK</div>
                <span className={styles.link}>{customer.visits} besök</span>
              </div>
              {customer.history.length === 0 ? (
                <div className={styles.emptyLine}>Inga bokningar kopplade till kunden ännu.</div>
              ) : (
                customer.history.map((b) => {
                  const cancelled = CANCELLED.has(b.status)
                  return (
                    <div key={b.id} className={styles.hRow}>
                      <span className={styles.hDate}>{formatDateTime(b.startTs, tz)}</span>
                      <span className={`${styles.hService} ${cancelled ? styles.hCancelled : ''}`}>
                        {b.serviceName}
                        {cancelled ? ` — ${statusLabel(b.status).toLowerCase()}` : ''}
                      </span>
                      <span className={styles.hStaff}>
                        <span
                          className={styles.dot}
                          style={{ background: staffColor(b.staffId) }}
                          aria-hidden="true"
                        />
                        {b.staffTitle}
                      </span>
                      <span className={`${styles.hPrice} ${cancelled ? styles.hPriceCancelled : ''}`}>
                        {cancelled ? '—' : formatPrice(b.priceCents)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>

            {/* SENASTE UTSKICK — goal-68 (communication_events) ej byggt → ärligt tomt. */}
            <div className={`${styles.card} ${styles.cardFlush}`}>
              <div className={styles.cardHead} style={{ padding: '10px 0 4px' }}>
                <div className={styles.eyebrow}>SENASTE UTSKICK</div>
              </div>
              <div className={styles.emptyLine}>Inga utskick — kunden nås manuellt.</div>
            </div>
          </div>
        </div>

        {/* ── Fler: dölj/självbokning, visningsnamn, kontakt-PII, export ── */}
        <details className={styles.fler}>
          <summary>⋯ Fler inställningar för kunden</summary>
          <div className={styles.flerBody}>
            <div className={styles.card}>
              <div className={styles.eyebrow} style={{ marginBottom: 12 }}>
                STYRNING
              </div>
              <CustomerFlags
                customerId={customer.id}
                hidden={customer.hidden}
                selfBook={customer.selfBook}
              />
            </div>
            <div className={styles.card}>
              <div className={styles.eyebrow} style={{ marginBottom: 12 }}>
                VISNINGSNAMN · KUNDENS VAL
              </div>
              <CustomerPrivacyForm
                customerId={customer.id}
                nameHidden={customer.nameHidden}
                displayName={customer.displayName}
              />
            </div>
            <div className={styles.card}>
              <div className={styles.eyebrow} style={{ marginBottom: 12 }}>
                KONTAKT-PII · TIDSBUNDEN
              </div>
              <CustomerContactCard
                contact={contact}
                customerId={customer.id}
                canEdit={customer.status === 'active'}
              />
            </div>
            <div className={styles.card}>
              <div className={styles.eyebrow} style={{ marginBottom: 12 }}>
                EXPORT · {staffTerm.toUpperCase()}
              </div>
              <CustomerExport rows={exportRow} />
            </div>
            {/* FAROZON (plan 007): GDPR-radera — ENDAST ägaren ser den (personal har
                ingen raderingsrätt; servern vaktar dessutom i eraseCustomer). Döljs
                för redan anonymiserade kort — radering är enkelriktad. */}
            {(user.roleLevel >= 6 || user.platformAdmin) && customer.status === 'active' ? (
              <div className={styles.card}>
                <div className={styles.eyebrow} style={{ marginBottom: 12 }}>
                  FAROZON · GDPR
                </div>
                <CustomerDangerZone customerId={customer.id} />
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  )
}
