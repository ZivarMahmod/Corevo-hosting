import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { collectCustomerData } from '@/lib/gdpr/data'

// GDPR self-service export (G10 step 2). Returns everything we hold about the
// signed-in customer as a downloadable JSON document. Authed via the session
// cookie; RLS scopes the reads to the caller's own data.

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const user = await getCurrentUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = await createClient()
  const data = await collectCustomerData(supabase, user.id)

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="mina-uppgifter-${user.id}.json"`,
      'cache-control': 'no-store',
    },
  })
}
