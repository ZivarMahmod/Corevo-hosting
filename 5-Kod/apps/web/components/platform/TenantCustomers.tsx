import { Icon, Stat, Badge, type BadgeTone } from '@/components/portal/ui'
import type { TenantCustomersData, TenantCustomer, CustomerBooking, CustomerInquiry } from '@/lib/platform/tenant-customers'
import styles from './platform.module.css'

/**
 * Super-admin Kunder-flik för EN salong — salongens slutkunder med boknings-frekvens,
 * senaste besök, av/uteblivna, och (om offert-modulen är på) förfrågningar. Server-
 * komponent: all data läses server-side i getTenantCustomers, här bara render. Varje
 * kund = hopfälld rad (native <details>); klick fäller ut bokningshistorik + kontakt +
 * förfrågningar. Ingen fabricerad data — allt härlett ur customers/bookings/offert.
 */

const kr = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 })
const dateFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Stockholm' })
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d)
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Väntar',
  confirmed: 'Bekräftad',
  completed: 'Genomförd',
  cancelled: 'Avbokad',
  no_show: 'Utebliven',
}
const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  confirmed: 'info',
  completed: 'success',
  cancelled: 'neutral',
  no_show: 'danger',
}
const INQUIRY_STATUS: Record<string, string> = {
  new: 'Ny',
  reviewing: 'Granskas',
  quoted: 'Offererad',
  accepted: 'Accepterad',
  declined: 'Avböjd',
  closed: 'Stängd',
}

export function TenantCustomers({ data }: { data: TenantCustomersData }) {
  const { customers, summary, unlinkedInquiries } = data
  return (
    <div>
      <div className="bo-stat-grid" style={{ marginBottom: 18 }}>
        <Stat label="Kunder" value={summary.total} icon="users" />
        <Stat label="Med bokning" value={summary.withBookings} icon="calendar" />
        <Stat label="Återkommande" value={summary.returning} icon="star" />
        <Stat label="Nya denna månad" value={summary.newThisMonth} icon="plus" />
      </div>

      {customers.length === 0 ? (
        <p className={styles.hint}>
          Inga kunder ännu — en stabil kund-rad skapas automatiskt när salongen tar emot sin första
          bokning (inloggad kund eller gäst).
        </p>
      ) : (
        customers.map((c) => <CustomerRow key={c.id} c={c} />)
      )}

      {unlinkedInquiries.length > 0 ? (
        <div className={styles.svcGroup}>
          <p className={styles.svcGroupTitle}>Förfrågningar utan kopplad kund · {unlinkedInquiries.length}</p>
          {unlinkedInquiries.map((q) => (
            <div key={q.id} className={styles.svcRow} style={{ padding: '10px 14px' }}>
              <div className={styles.svcSumName}>
                {q.subject || 'Förfrågan'}
                <Badge tone="neutral" dot={false}>
                  {INQUIRY_STATUS[q.status] ?? q.status}
                </Badge>
              </div>
              <div className={styles.svcSumMeta}>
                {q.customerName ?? 'Okänd'} · {fmtDate(q.createdAt)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CustomerRow({ c }: { c: TenantCustomer }) {
  const contact = c.email || c.phone || '—'
  const meta = [
    `${c.total} bokning${c.total === 1 ? '' : 'ar'}`,
    `${c.completed} genomförda`,
    c.upcoming > 0 ? `${c.upcoming} kommande` : null,
    c.lastVisit ? `senast ${fmtDate(c.lastVisit)}` : null,
    c.cancelled + c.noShow > 0 ? `${c.cancelled + c.noShow} av/uteblivna` : null,
    c.inquiries.length > 0 ? `${c.inquiries.length} förfrågning${c.inquiries.length === 1 ? '' : 'ar'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <details className={styles.svcRow}>
      <summary className={styles.svcSummary}>
        <span className={`${styles.svcThumb} ${styles.svcThumbEmpty}`}>
          <Icon name="user" size={16} />
        </span>
        <span className={styles.svcSumMain}>
          <span className={styles.svcSumName}>
            {c.name}
            {c.returning ? <span className={styles.svcBadge}>Återkommande</span> : null}
            {c.status !== 'Aktiv' ? <span className={styles.svcOff}>{c.status}</span> : null}
          </span>
          <span className={styles.svcSumMeta}>{meta}</span>
        </span>
        <span className={styles.svcSumMeta} style={{ marginTop: 0, whiteSpace: 'nowrap' }}>
          {contact}
        </span>
        <Icon name="chevronDown" size={16} className={styles.svcChev} />
      </summary>

      <div className={styles.svcBody}>
        <div className={styles.svcSub}>
          <p className={styles.svcSubTitle}>Bokningshistorik</p>
          {c.bookings.length === 0 ? (
            <p className={styles.hint} style={{ margin: 0 }}>
              Inga bokningar än.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ptable">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Tjänst</th>
                    <th>Personal</th>
                    <th>Status</th>
                    <th data-last="">Pris</th>
                  </tr>
                </thead>
                <tbody>
                  {c.bookings.map((b) => (
                    <BookingRowView key={b.id} b={b} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {c.inquiries.length > 0 ? (
          <div className={styles.svcSub}>
            <p className={styles.svcSubTitle}>Förfrågningar</p>
            {c.inquiries.map((q) => (
              <InquiryRow key={q.id} q={q} />
            ))}
          </div>
        ) : null}

        <div className={styles.svcSub}>
          <p className={styles.svcSubTitle}>Kontakt</p>
          <span className={styles.svcSumMeta} style={{ marginTop: 0 }}>
            {c.email ?? '— ingen e-post'} · {c.phone ?? 'ingen telefon'} · {c.role} ({c.auth}) · kund
            sedan {fmtDate(c.firstSeen)}
          </span>
        </div>
      </div>
    </details>
  )
}

function BookingRowView({ b }: { b: CustomerBooking }) {
  return (
    <tr>
      <td>{fmtDate(b.startTs)}</td>
      <td>{b.serviceName}</td>
      <td>{b.staffTitle}</td>
      <td>
        <Badge tone={STATUS_TONE[b.status] ?? 'neutral'} dot={false}>
          {STATUS_LABEL[b.status] ?? b.status}
        </Badge>
      </td>
      <td data-last="">{b.priceCents != null ? kr.format(b.priceCents / 100) : '—'}</td>
    </tr>
  )
}

function InquiryRow({ q }: { q: CustomerInquiry }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <Badge tone="neutral" dot={false}>
        {INQUIRY_STATUS[q.status] ?? q.status}
      </Badge>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{q.subject || 'Förfrågan'}</span>
      <span className={styles.svcSumMeta} style={{ marginTop: 0, whiteSpace: 'nowrap' }}>
        {fmtDate(q.createdAt)}
      </span>
    </div>
  )
}
