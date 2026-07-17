import { createServiceClient } from '@/lib/platform/service'
import { authorizedCronRequest } from '@/lib/security/cron-auth'

// Pending-expiry cron endpoint. Invoked by an EXTERNAL scheduler — a Cloudflare
// Cron Trigger hitting this URL, or any scheduler that can send the shared-secret
// header (same contract as cron/reminders).
//
// Auth: a static bearer in CRON_SECRET (Worker secret). Not user-facing; rejects
// anything without the exact secret so the endpoint can't be triggered to mass-cancel
// bookings. Sweeps abandoned online-checkout 'pending' bookings whose payment never
// completed past the TTL (expire_abandoned_pending_bookings RPC, service_role-only).
// Degrades to a no-op when SUPABASE_SERVICE_ROLE_KEY is unset (local/dev).

export const dynamic = 'force-dynamic'

async function run(req: Request): Promise<Response> {
  if (!(await authorizedCronRequest(req))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const admin = createServiceClient()
  if (!admin) {
    return new Response(JSON.stringify({ error: 'service_unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  }

  const [bookings, shop, slotHolds] = await Promise.all([
    admin.rpc('expire_abandoned_pending_bookings', { p_ttl_min: 30 }),
    admin.rpc('prune_expired_shop_reserves'),
    admin.rpc('prune_expired_slot_holds'),
  ])
  if (bookings.error || shop.error || slotHolds.error) {
    return new Response(JSON.stringify({ error: 'cron_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({
    swept: bookings.data ?? 0,
    shopReservationsPruned: shop.data ?? 0,
    slotHoldsPruned: slotHolds.data ?? 0,
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

export async function POST(req: Request): Promise<Response> {
  return run(req)
}

// GET supported too (Cloudflare Cron Triggers can fire a scheduled fetch).
export async function GET(req: Request): Promise<Response> {
  return run(req)
}
