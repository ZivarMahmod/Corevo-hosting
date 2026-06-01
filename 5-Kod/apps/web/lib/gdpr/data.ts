import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'

// GDPR data export (G10 step 2 — "rätt till tillgång/dataportabilitet"). Gathers
// everything we hold about ONE customer into a portable JSON document. Runs with
// the CALLER's client: the customer's own authed client (self-service) or an
// admin's (RLS scopes both correctly). No service-role needed for export.

export type CustomerExport = {
  exportedAt: string
  profile: {
    id: string
    email: string | null
    phone: string | null
    name: string | null
    status: string | null
    createdAt: string | null
  }
  bookings: Array<Record<string, unknown>>
  payments: Array<Record<string, unknown>>
}

export async function collectCustomerData(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CustomerExport> {
  const [{ data: authData }, { data: profile }, { data: bookings }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('users').select('id, email, phone, status, created_at').eq('id', userId).maybeSingle(),
    supabase
      .from('bookings')
      .select('id, status, start_ts, end_ts, price_cents, service_id, staff_id, note, created_at')
      .eq('customer_profile_id', userId)
      .order('start_ts', { ascending: true }),
  ])

  const bookingRows = bookings ?? []
  const bookingIds = bookingRows.map((b) => b.id)
  let payments: Array<Record<string, unknown>> = []
  if (bookingIds.length > 0) {
    const { data: pay } = await supabase
      .from('payments')
      .select('id, booking_id, amount_cents, currency, status, created_at')
      .in('booking_id', bookingIds)
    payments = (pay ?? []) as Array<Record<string, unknown>>
  }

  const fullName = ((authData?.user?.user_metadata ?? {}) as { full_name?: string }).full_name ?? null

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: userId,
      email: profile?.email ?? authData?.user?.email ?? null,
      phone: profile?.phone ?? null,
      name: fullName,
      status: profile?.status ?? null,
      createdAt: profile?.created_at ?? null,
    },
    bookings: bookingRows as Array<Record<string, unknown>>,
    payments,
  }
}
