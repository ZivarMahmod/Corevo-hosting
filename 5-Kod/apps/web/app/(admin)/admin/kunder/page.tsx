import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listCustomers, customerStats } from '@/lib/admin/data'
import { getCustomerStaffFavorite } from '@/lib/kund/favorites'
import { formatDateTime } from '@/lib/admin/format'
import { CustomerExport, type ExportRow } from './CustomerExport'
import styles from '@/components/admin/kunder-v2.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kunder · Adminpanel' }

const TIER_LABEL: Record<'guld' | 'silver' | 'brons' | 'ny', string> = {
  guld: 'Guld',
  silver: 'Silver',
  brons: 'Brons',
  ny: 'Ny',
}

/** Tomma läget i master–detalj: ingen kund vald → överblick + bulk-export. Listan
 *  (layouten) står kvar till vänster; välj en kund för att öppna kortet till höger. */
export default async function CustomersIndexPage() {
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

  // Överblicken behöver aggregat + export-rader; listan i layouten är per-rad-lätt.
  // ponytail: en extra RPC-läsning, men BARA på bara /admin/kunder (utan vald kund).
  const everyone = await listCustomers(tenant.id)
  const visibleRows = everyone.filter((c) => !c.hidden)
  const stats = customerStats(visibleRows)
  const goldCount = visibleRows.filter((c) => c.tier === 'guld').length

  // Bulk-exporten omfattar HELA registret inkl. dolda kunder (gamla ?dolda=1-vägen
  // exporterade dolda separat — ett härledbart underlag ska aldrig tyst tappa rader).
  // Statistiken ovan räknar bara synliga; en dold kund ska inte spöka i siffrorna.
  const favs = await Promise.all(everyone.map((c) => getCustomerStaffFavorite(c.id)))
  const exportRows: ExportRow[] = everyone.map((c, i) => ({
    shownName: c.shownName,
    tier: TIER_LABEL[c.tier],
    visits: c.visits,
    lastVisit: c.lastVisitTs ? formatDateTime(c.lastVisitTs, tenant.timeZone) : '—',
    favStaff: favs[i]?.title?.trim() || '—',
    loyaltyPoints: c.loyaltyPoints,
  }))

  const cards: Array<[string, number | string]> = [
    ['Kunder totalt', stats.total],
    ['Återkommande', stats.returning],
    ['Guld-nivå', goldCount],
    ['Skyddat namn', stats.protectedNames],
  ]

  return (
    <div className={styles.pane}>
      <div className={styles.paneInner}>
        <div className={styles.prompt}>
          <div>
            <div className={styles.eyebrow}>KUNDREGISTER · {tenant.name.toUpperCase()}</div>
            <p style={{ margin: '10px 0 0', fontSize: 15, color: 'var(--c-ink-2)', maxWidth: 560 }}>
              Välj en kund i listan för att öppna kortet — anteckningar, favoriter,
              nyckeltal, besökshistorik och kontakt (i driftfönstret). Personalen känner
              igen återkommande kunder utan att personuppgifterna ligger exponerade.
            </p>
          </div>

          <div className={styles.stats} style={{ marginTop: 4 }}>
            {cards.map(([label, value]) => (
              <div key={label} className={styles.statCard}>
                <div className={styles.statNum}>{value}</div>
                <div className={styles.statLbl}>{label}</div>
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div className={styles.eyebrow}>SÅ BYGGS REGISTRET</div>
            <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--c-ink-2)' }}>
              Kunddatabasen byggs automatiskt från bokningarna — varje återkommande gäst får
              en stabil rad. Det finns ingen manuell &quot;skapa kund&quot;; en ny kund uppstår
              när första bokningen görs på din publika sajt eller i kalendern.
            </p>
            <div style={{ marginTop: 14 }}>
              <CustomerExport rows={exportRows} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
