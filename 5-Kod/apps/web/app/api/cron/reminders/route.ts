import { sendDueReminders } from '@/lib/notifications/reminders'

// Reminder cron endpoint (G10 step 3). Invoked by an EXTERNAL scheduler — a
// Cloudflare Cron Trigger (recommended; see docs/ops/backup-restore.md) hitting
// this URL, or any scheduler that can send the shared-secret header.
//
// Auth: a static bearer in CRON_SECRET (Worker secret). Not user-facing; rejects
// anything without the exact secret so the endpoint can't be triggered to fan out
// mail. Degrades to a no-op when SUPABASE_SERVICE_ROLE_KEY / the email relay
// (EMAIL_RELAY_URL/EMAIL_RELAY_SECRET) is unset.

export const dynamic = 'force-dynamic'

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // unconfigured → closed (never open)
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${secret}`
}

async function run(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  const result = await sendDueReminders()
  return new Response(JSON.stringify({ ok: true, ...result }), {
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
