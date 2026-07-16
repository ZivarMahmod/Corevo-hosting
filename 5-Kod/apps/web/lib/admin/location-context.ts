import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type AdminLocationPreferences = {
  accessScope: 'organization' | 'locations'
  primaryLocationId: string | null
}

/** Läser känslig platskontext från aktuell DB-rad, aldrig från en gammal JWT. */
export async function getAdminLocationPreferences(
  userId: string,
): Promise<AdminLocationPreferences> {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
  const row = data as unknown as {
    access_scope?: 'organization' | 'locations' | null
    primary_location_id?: string | null
  } | null
  return {
    accessScope: row?.access_scope === 'organization' ? 'organization' : 'locations',
    primaryLocationId: row?.primary_location_id ?? null,
  }
}
