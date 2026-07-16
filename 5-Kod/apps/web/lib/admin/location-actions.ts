'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminArea } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export async function setAdminPrimaryLocation(
  locationId: string,
): Promise<{ success?: true; error?: string }> {
  await requireAdminArea('oversikt')
  if (!locationId) return { error: 'Välj en plats.' }
  const supabase = await createClient()
  const locationRpc = supabase as unknown as {
    rpc(
      name: 'set_my_primary_location',
      args: { p_location: string },
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>
  }
  const { error } = await locationRpc.rpc('set_my_primary_location', {
    p_location: locationId,
  })
  if (error) return { error: 'Platsen är inte längre tillgänglig.' }
  revalidatePath('/admin', 'layout')
  return { success: true }
}
