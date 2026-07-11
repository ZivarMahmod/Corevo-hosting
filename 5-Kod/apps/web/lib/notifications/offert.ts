import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { sendEmail, type SendResult } from './email'
import { shell, esc } from './templates'
import { loadEmailBrand } from './brand'

// Offert-SVARET som mejl (goal-54 körning 3, A4: statusen "Offererad" ljög — inget
// nådde någonsin kunden). Samma ticket-shell + per-tenant brand som boknings-mejlen;
// From bär kundens (tenantens) namn, Reply-To = tenantens egen inbox så kundens svar
// landar hos verksamheten, aldrig hos plattformen. Best-effort by contract: anropas
// EFTER lyckad DB-write och får aldrig kasta.

const SANS = `-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

export async function sendOffertReplyEmail(args: {
  supabase: SupabaseClient<Database>
  tenantId: string
  tenantName: string
  to: string
  customerName: string | null
  subject: string | null
  replyMessage: string
  /** Prisuppskattning i ören; null → ingen prisrad i mejlet. */
  estimateCents: number | null
}): Promise<SendResult> {
  try {
    const brand = await loadEmailBrand(args.supabase, args.tenantId, args.tenantName)
    const hello = args.customerName?.trim() ? `Hej ${esc(args.customerName.trim())},` : 'Hej,'
    const paragraphs = args.replyMessage
      .split(/\n\s*\n/)
      .map((p) => `<p style="margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:1.6">${esc(p.trim()).replace(/\n/g, '<br/>')}</p>`)
      .join('')
    const estimate =
      args.estimateCents != null
        ? `<p style="margin:14px 0 0;font-family:${SANS};font-size:14px"><strong>Prisuppskattning:</strong> ${(args.estimateCents / 100).toLocaleString('sv-SE')} kr</p>`
        : ''
    const about = args.subject?.trim()
      ? `<p style="margin:0 0 12px;font-family:${SANS};font-size:13px;color:#6b6b66">Gäller: ${esc(args.subject.trim())}</p>`
      : ''
    const html = shell(
      'Svar på din förfrågan',
      `<p style="margin:0 0 12px;font-family:${SANS};font-size:14px">${hello}</p>${about}${paragraphs}${estimate}`,
      args.tenantName,
      'Offert',
      brand,
    )
    return await sendEmail({
      to: args.to,
      subject: `Svar på din förfrågan — ${args.tenantName}`,
      html,
      from: brand.from,
      replyTo: brand.replyTo,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send_failed' }
  }
}
