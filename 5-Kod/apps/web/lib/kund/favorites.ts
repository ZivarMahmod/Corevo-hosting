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
