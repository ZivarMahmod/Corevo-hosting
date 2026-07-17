import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getMyBookings } from '@/lib/kund/bookings'
import { getLoyaltyView, getCustomerLoyaltyPointsPerVisit } from '@/lib/kund/loyalty'
import { getCustomerId } from '@/lib/kund/customer'
import { getMyFavorites, getCustomerStaffFavorite } from '@/lib/kund/favorites'
import { IdentityHero } from '@/components/kund/IdentityHero'
import { StylistCard } from '@/components/kund/StylistCard'
import { AccountLoyalty } from '@/components/kund/AccountLoyalty'
import { UsualCard } from '@/components/kund/UsualCard'
import { AccountBookings, CancelledBookings } from '@/components/kund/AccountBookings'
import { AccountHistory } from '@/components/kund/AccountHistory'
import { AccountPrivacy, type NameMode } from '@/components/kund/AccountPrivacy'
import { PushOptIn } from '@/components/kund/PushOptIn'
import { FavoritesList } from '@/components/kund/FavoritesList'
import { getMyOrders, type KundOrder } from '@/lib/kund/shop-orders'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import { cleanTerminology, type Terminology } from '@/lib/platform/verticals-shared'
import account from '@/components/kund/account.module.css'
import kund from '@/components/kund/kund.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mina sidor' }

// Samma etiketter som /konto/bestallningar (kund-order-FSM:ens kundvända lägen).
const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Mottagen',
  confirmed: 'Bekräftad',
  ready: 'Klar att hämta',
  completed: 'Slutförd',
  cancelled: 'Avbruten',
}

function orderSummary(o: KundOrder): string {
  const first = o.items[0]
  if (!first) return '—'
  const more = o.items.length - 1
  return more > 0 ? `${first.productName} + ${more} till` : `${first.productName} × ${first.quantity}`
}

export default async function KontoPage() {
  const user = await requirePortal('kund')
  const tenantId = user.tenantId ?? ''
  const supabase = await createClient()

  // Person name lives only in auth user_metadata (a kund account has no name on
  // public.users) — read it for the greeting + name-display derivation. Generic
  // fallback when absent (never fabricated).
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const fullName = ((authUser?.user_metadata ?? {}) as { full_name?: string }).full_name?.trim() || null
  const firstName = fullName ? fullName.split(/\s+/)[0]! : null

  // Durable customer id (favorites + loyalty ledger key on it). null for a
  // never-booked account → all reads degrade to honest empty-states.
  const customerId = await getCustomerId(user.id, tenantId)

  // Bransch terminology overlay (verticals.terminology) → universal kund-portal
  // surfaces speak the tenant's bransch instead of a hardcoded 'Frisör'. Mirrors
  // getAdminTenant's SEPARATE read (not an embedded join): verticals_read is
  // SELECT-open to authenticated (a kund IS authenticated), and on ANY miss the
  // overlay stays {} → every wired leaf falls back to its EXACT current word, so a
  // no-override / 'generell' tenant renders precisely today's text (DIFF-0). The
  // resolved object is plain serialisable JSON → safe to pass to client leaves.
  let terminology: Terminology = {}
  let tenantSlug: string | null = null
  if (tenantId) {
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('vertical_id, slug')
      .eq('id', tenantId)
      .maybeSingle()
    tenantSlug = (tenantRow?.slug as string | null) ?? null
    const verticalId = (tenantRow?.vertical_id as string | null) ?? null
    if (verticalId) {
      const { data: vertical } = await supabase
        .from('verticals')
        .select('terminology')
        .eq('key', verticalId)
        .maybeSingle()
      terminology = cleanTerminology(vertical?.terminology)
    }
  }

  // Kundkonto för handel (goal-55 körning 9): kontot får butik-vinkel ENDAST när
  // tenantens shop-modul är LIVE — annars renderas exakt dagens bokningscentrerade
  // ordning (FreshCut oförändrad). Senaste ordrarna återanvänder samma läsning som
  // /konto/bestallningar (getMyOrders).
  // TODO (framtid): kursanmälningar (event_registrations) har ingen user-koppling —
  // raderna bär bara email. När en säker email-match finns (verifierad e-post på
  // kontot == registration email) kan "Mina kursanmälningar" lyftas in här.
  const shopLive = tenantSlug
    ? isModuleLive(await getTenantModuleStates(tenantId, tenantSlug), 'shop')
    : false
  const recentOrders: KundOrder[] = shopLive
    ? await getMyOrders(customerId).then(({ active, completed }) => [...active, ...completed].slice(0, 3))
    : []

  const [{ upcoming, past }, loyalty, favorites, staffFavorite, pointsPerVisit] = await Promise.all([
    getMyBookings(user.id),
    getLoyaltyView(user.id, tenantId, customerId),
    getMyFavorites(customerId),
    getCustomerStaffFavorite(customerId),
    getCustomerLoyaltyPointsPerVisit(customerId),
  ])

  // The customer's OWN display-name choice (readable under customers_rls own-row
  // branch). Reflected READ-ONLY in the Integritet panel — there is no customer-
  // callable save action in the frozen lib, so we never render a saving control
  // (see AccountPrivacy's persistence FLAG).
  let nameMode: NameMode = 'full'
  let displayName: string | null = null
  let phone: string | null = null
  if (customerId) {
    const { data: row } = await supabase
      .from('customers')
      .select('display_name, name_hidden, phone')
      .eq('id', customerId)
      .maybeSingle()
    if (row) {
      displayName = (row.display_name as string | null) ?? null
      phone = (row.phone as string | null) ?? null
      nameMode = row.name_hidden ? 'initial' : displayName ? 'first' : 'full'
    }
  }
  if (!phone) {
    // Fall back to the kund account's own contact phone (public.users).
    const { data: u } = await supabase.from('users').select('phone').eq('id', user.id).maybeSingle()
    phone = (u?.phone as string | null) ?? null
  }

  const next = upcoming.find((b) => b.status === 'pending' || b.status === 'confirmed') ?? null
  const cancelled = past.filter((b) => b.status === 'cancelled')
  const historyTimeZone = past[0]?.timeZone ?? upcoming[0]?.timeZone ?? 'Europe/Stockholm'
  const favoriteStaffIds = favorites
    .filter((f) => f.kind === 'staff' && f.staffId)
    .map((f) => f.staffId as string)

  return (
    <div className={account.page}>
      <IdentityHero firstName={firstName} next={next} />

      {/* Plan 015: push-nudgen — renderar sig själv bara när push är möjligt
          (VAPID byggd, webbläsarstöd, ej redan prenumererad). */}
      <PushOptIn />

      {/* Butik-vinkel (körning 9): "Mina beställningar" som eget kort HÖGT upp när
          shop-modulen är live. Ej live → kortet finns inte alls (dagens ordning). */}
      {shopLive ? (
        <section>
          <h2 className={account.sectionTitle}>Mina beställningar</h2>
          <div className={account.card}>
            {recentOrders.length === 0 ? (
              <p className={kund.notice} style={{ margin: 0 }}>
                Du har inga beställningar än.
              </p>
            ) : (
              <ul className={kund.list}>
                {recentOrders.map((o) => (
                  <li key={o.id} className={kund.item}>
                    <Link href={`/konto/bestallningar/${o.id}`} className={kund.link}>
                      <span className={kund.main}>
                        <strong>#{o.id.slice(0, 8)}</strong>
                        <span className={kund.sub}>{orderSummary(o)}</span>
                      </span>
                      <span className={kund.meta}>
                        <span>{formatShopPrice(o.totalCents, o.currency)}</span>
                        <span className={kund.badge}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ margin: '12px 0 0' }}>
              <Link href="/konto/bestallningar" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                Alla beställningar →
              </Link>
            </p>
          </div>
        </section>
      ) : null}

      <StylistCard
        favorite={staffFavorite}
        staffBands={loyalty.staffBands}
        favoriteStaffIds={favoriteStaffIds}
        terminology={terminology}
      />

      <AccountLoyalty view={loyalty} />

      <UsualCard bookings={[...past, ...upcoming]} timeZone={historyTimeZone} />

      <AccountBookings upcoming={upcoming} />
      <CancelledBookings cancelled={cancelled} />

      <AccountHistory past={past} pointsPerVisit={pointsPerVisit} />

      {/* Shipped capability preserved (the §4.8 mock shows only the favorited
          stylist; the full favorites list — saved services + quick-rebook +
          remove — is restyled here, not dropped). */}
      {favorites.length > 0 ? (
        <section>
          <h2 className={account.sectionTitle}>Sparade favoriter</h2>
          <FavoritesList favorites={favorites} terminology={terminology} />
        </section>
      ) : null}

      <AccountPrivacy
        fullName={fullName}
        email={user.email}
        phone={phone}
        nameMode={nameMode}
        displayName={displayName}
      />

      <p style={{ textAlign: 'center', margin: 0, display: 'flex', gap: 20, justifyContent: 'center' }}>
        <Link href="/konto/bestallningar" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          Mina beställningar →
        </Link>
        <Link href="/konto/profil" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          Min profil →
        </Link>
      </p>
    </div>
  )
}
