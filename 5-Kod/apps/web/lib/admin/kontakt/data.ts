import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { ContactMessage } from '@/components/platform/ContactInboxCard'

// Kontakt-inkorgens LÄSVÄG (goal-64). Speglar lib/admin/offert/data.ts.
//
// Körs med den inloggades cookie-klient: en platform-admin läser cross-tenant via
// platform_admin-claimet, en salongsadmin fångas av RLS (contact_messages_tenant_read
// i 0057 → tenant_id = private.tenant_id()). Vi lägger ÄNDÅ .eq('tenant_id', …) —
// app-lagret ska aldrig luta sig mot RLS ensamt.
//
// Ordning: nyast först. Statusen sorteras i vyn (olästa upp, arkiverade hopfällda) —
// inte här; en läsväg ska hämta, inte tycka.

export async function listContactMessages(tenantId: string): Promise<ContactMessage[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contact_messages')
    .select('id, name, email, phone, subject, message, status, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200)
  return (data ?? []) as ContactMessage[]
}
