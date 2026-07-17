import { sendDueReminders } from '@/lib/notifications/reminders'
import { authorizedCronRequest } from '@/lib/security/cron-auth'

// Reminder cron endpoint (G10 step 3). Invoked by an EXTERNAL scheduler — a
// Cloudflare Cron Trigger (recommended; see docs/ops/backup-restore.md) hitting
// this URL, or any scheduler that can send the shared-secret header.
//
// Auth: a static bearer in CRON_SECRET (Worker secret). Not user-facing; rejects
// anything without the exact secret so the endpoint can't be triggered to fan out
// mail. Degrades to a no-op when SUPABASE_SERVICE_ROLE_KEY / the email relay
// (EMAIL_RELAY_URL/EMAIL_RELAY_SECRET) is unset.

export const dynamic = 'force-dynamic'

async function run(req: Request): Promise<Response> {
  if (!(await authorizedCronRequest(req))) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const result = await sendDueReminders()
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'cron_failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}

export async function POST(req: Request): Promise<Response> {
  return run(req)
}

// GET supported too (Cloudflare Cron Triggers can fire a scheduled fetch).
export async function GET(req: Request): Promise<Response> {
  return run(req)
}
