import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { sendEmail, type SendResult } from './email'
import { shell, esc } from './templates'
import { loadEmailBrand } from './brand'

// Kurs-anmälans-BEKRÄFTELSEN som mejl (goal-54 körning 4). Samma ticket-shell +
// per-tenant brand som offert-/boknings-mejlen; Reply-To = tenantens egen inbox.
// Best-effort by contract: anropas EFTER lyckad DB-write och får aldrig kasta.

const SANS = `-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

export async function sendEventConfirmationEmail(args: {
  supabase: SupabaseClient<Database>
  tenantId: string
  tenantName: string
  to: string
  name: string
  eventTitle: string
  /** Datum/tid färdigformaterat (sv-SE, Europe/Stockholm). */
  startsAtText: string
  partySize: number
  /** Avgift i ören; 0 → "Gratis". */
  priceCents: number
}): Promise<SendResult> {
  try {
    const brand = await loadEmailBrand(args.supabase, args.tenantId, args.tenantName)
    const fee =
      args.priceCents > 0
        ? `${Math.round(args.priceCents / 100).toLocaleString('sv-SE')} kr per plats — betalas på plats`
        : 'Gratis'
    const row = (label: string, value: string) =>
      `<p style="margin:0 0 6px;font-family:${SANS};font-size:14px"><strong>${esc(label)}:</strong> ${esc(value)}</p>`
    const html = shell(
      'Du är anmäld!',
      `<p style="margin:0 0 12px;font-family:${SANS};font-size:14px">Hej ${esc(args.name)},</p>
       <p style="margin:0 0 14px;font-family:${SANS};font-size:14px;line-height:1.6">Tack för din anmälan — vi ses!</p>
       ${row('Kurs', args.eventTitle)}
       ${row('När', args.startsAtText)}
       ${row('Antal platser', String(args.partySize))}
       ${row('Avgift', fee)}`,
      args.tenantName,
      'Din anmälan',
      brand,
    )
    return await sendEmail({
      to: args.to,
      subject: `Du är anmäld — ${args.eventTitle}`,
      html,
      from: brand.from,
      replyTo: brand.replyTo,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send_failed' }
  }
}
