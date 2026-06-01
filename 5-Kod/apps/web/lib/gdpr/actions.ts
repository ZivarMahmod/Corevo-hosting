'use server'

import { redirect } from 'next/navigation'
import { requirePortal } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { eraseCustomerData } from './erase'

export type EraseState = { error?: string }

// Self-service "radera mitt konto" (G10 step 2). The customer must type RADERA to
// confirm. On success the account is anonymized/deleted (see lib/gdpr/erase.ts),
// the orphaned session is cleared, and we leave the portal.
export async function eraseMyAccount(_prev: EraseState, formData: FormData): Promise<EraseState> {
  const user = await requirePortal('kund')

  const confirm = String(formData.get('confirm') ?? '').trim()
  if (confirm !== 'RADERA') {
    return { error: 'Skriv RADERA (versaler) för att bekräfta.' }
  }
  if (!user.tenantId) {
    return { error: 'Kunde inte radera kontot. Kontakta salongen.' }
  }

  const result = await eraseCustomerData({ userId: user.id, tenantId: user.tenantId, actorId: user.id })
  if (!result.ok) {
    return {
      error:
        result.reason === 'unavailable'
          ? 'Radering är inte tillgänglig just nu. Kontakta salongen så hjälper de dig.'
          : 'Kunde inte radera kontot. Försök igen.',
    }
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
