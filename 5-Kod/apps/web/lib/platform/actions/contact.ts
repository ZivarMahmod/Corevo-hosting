'use server'

import { revalidatePath } from 'next/cache'
import { sidaCtx } from '../guard'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// ── Kontakt-INKORGEN: markera läst / arkivera (goal-64) ────────────────────────
// Kontaktformuläret skriver rader i contact_messages och mejlar dem till kunden. Men
// mejl försvinner i en inkorg — kunden måste också kunna LÄSA och beta av dem här.
// Status-FSM:n är avsiktligt trivial: new → read → archived (och tillbaka), inget mer.

const CONTACT_STATUSES = ['new', 'read', 'archived'] as const
type ContactStatus = (typeof CONTACT_STATUSES)[number]

/**
 * Sätt status på ETT kontaktmeddelande. tenant_id tas ur sidaCtx (super-admin ur
 * formuläret, salongsadmin tvingat ur JWT) och läggs som .eq-filter på UPDATE:n —
 * så en kund kan aldrig röra en annan kunds meddelande, oavsett vilket id klienten
 * skickar in.
 */
export async function setContactMessageStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  const id = String(fd.get('id') ?? '').trim()
  const status = String(fd.get('status') ?? '').trim() as ContactStatus
  if (!id) return { error: 'Saknar meddelande.' }
  if (!CONTACT_STATUSES.includes(status)) return { error: 'Ogiltig status.' }

  const { error } = await supabase.rpc('platform_set_contact_message_status', {
    p_tenant: tenantId,
    p_message: id,
    p_status: status,
  })
  if (error) {
    await reportActionError('setContactMessageStatus', error, { tenantId })
    return { error: GENERIC }
  }

  revalidatePath(`/kunder/${tenantId}`)
  revalidatePath('/admin/kontakt')
  return { success: status === 'archived' ? 'Meddelandet arkiverat.' : 'Meddelandet markerat som läst.' }
}
