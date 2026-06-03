import 'server-only'
import { createClient } from '@/lib/supabase/server'

// ── Favoriter (M4 §2.3) — read layer ─────────────────────────────────────────
// customer_favorites (migration 0011) holds a customer's saved staff OR service.
// RLS scopes a kund to their OWN rows (customer_id = private.current_customer_id());
// staff/admin see tenant-wide. We additionally filter by customer_id app-side for
// a tight, obvious query. Each favorite resolves a display name via its FK so the
// list reads as "Erik" / "Klippning", not raw ids.

export type FavoriteKind = 'staff' | 'service'

export type Favorite = {
  id: string
  kind: FavoriteKind
  /** staff_id when kind='staff', else null. */
  staffId: string | null
  /** service_id when kind='service', else null. */
  serviceId: string | null
  /** Resolved display name (staff.title / service.name), or a soft fallback. */
  name: string
  /** service price in cents when kind='service' (for a hint), else null. */
  priceCents: number | null
}

type FavoriteRow = {
  id: string
  kind: string
  staff_id: string | null
  service_id: string | null
  staff: { title: string | null } | null
  services: { name: string; price_cents: number | null } | null
}

const SELECT = 'id, kind, staff_id, service_id, staff(title), services(name, price_cents)'

/**
 * The signed-in customer's favorites for the current tenant. customerId is the
 * customers.id (resolve via lib/kund/customer.ts); null/empty → no favorites yet.
 * Staff favorites first (people before services), then by name.
 */
export async function getMyFavorites(customerId: string | null): Promise<Favorite[]> {
  if (!customerId) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('customer_favorites')
    .select(SELECT)
    .eq('customer_id', customerId)

  const rows = (data ?? []) as unknown as FavoriteRow[]
  const favs: Favorite[] = rows.map((r) => {
    const kind: FavoriteKind = r.kind === 'service' ? 'service' : 'staff'
    const name =
      kind === 'staff'
        ? (r.staff?.title?.trim() || 'Frisör')
        : (r.services?.name?.trim() || 'Tjänst')
    return {
      id: r.id,
      kind,
      staffId: r.staff_id,
      serviceId: r.service_id,
      name,
      priceCents: kind === 'service' ? (r.services?.price_cents ?? null) : null,
    }
  })
  favs.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'staff' ? -1 : 1
    return a.name.localeCompare(b.name, 'sv')
  })
  return favs
}

// ── DIN FRISÖR card (/konto, M7 P0) ──────────────────────────────────────────
// The relationship card surfaces the ONE staff member the customer has saved as
// a favorite. There is no schema constraint to exactly one, so we take the first
// favorited staff (alphabetical, mirroring getMyFavorites' ordering) and resolve
// its display title. null = the customer hasn't favorited anyone → the card shows
// its written empty-state ("Välj din frisör"), never a fabricated stylist.
//
// NOTE (data-gated): the mock's "minns om dig" memory chips and a personal
// stylist quote are NOT readable here — customer_notes is staff-only by RLS
// (0011:563, no customer-self-scope branch), so /konto cannot read a customer's
// own preference chips. Those parts of the card are an honest empty-state; this
// helper deliberately exposes ONLY what the customer can actually read (the
// favorited staff + title). It does not attempt to surface notes.

export type StaffFavorite = {
  staffId: string
  /** Resolved staff display title, or null when the staff row has no title. */
  title: string | null
}

/**
 * The customer's favorited staff member (DIN FRISÖR), or null when none is saved.
 * customerId is the resolved customers.id; null/empty → null. RLS scopes
 * customer_favorites to the caller's own rows.
 */
export async function getCustomerStaffFavorite(
  customerId: string | null,
): Promise<StaffFavorite | null> {
  if (!customerId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('customer_favorites')
    .select('staff_id, staff(title)')
    .eq('customer_id', customerId)
    .eq('kind', 'staff')

  type Row = { staff_id: string | null; staff: { title: string | null } | null }
  const rows = ((data ?? []) as unknown as Row[]).filter((r): r is Row & { staff_id: string } =>
    Boolean(r.staff_id),
  )
  if (rows.length === 0) return null
  // Stable pick: first by resolved title (mirrors getMyFavorites' name sort).
  rows.sort((a, b) =>
    (a.staff?.title ?? '').localeCompare(b.staff?.title ?? '', 'sv'),
  )
  const pick = rows[0]!
  return { staffId: pick.staff_id, title: pick.staff?.title?.trim() || null }
}
