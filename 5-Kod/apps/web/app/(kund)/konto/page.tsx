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
import { FavoritesList } from '@/components/kund/FavoritesList'
import account from '@/components/kund/account.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mina sidor' }

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

      <StylistCard
        favorite={staffFavorite}
        staffBands={loyalty.staffBands}
        favoriteStaffIds={favoriteStaffIds}
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
          <FavoritesList favorites={favorites} />
        </section>
      ) : null}

      <AccountPrivacy
        fullName={fullName}
        email={user.email}
        phone={phone}
        nameMode={nameMode}
        displayName={displayName}
      />

      <p style={{ textAlign: 'center', margin: 0 }}>
        <Link href="/konto/profil" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          Min profil →
        </Link>
      </p>
    </div>
  )
}
