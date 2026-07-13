import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { sendEmail, type SendResult } from './email'
import { shell, esc } from './templates'
import { loadEmailBrand } from './brand'

// Kontaktmeddelandet som mejl (goal-64). Ett meddelande som bara landar i en tabell
// är ett meddelande ingen läser — kunden lever i sin inkorg, inte i vår admin. Därför
// går varje rad i contact_messages OCKSÅ ut som ett mejl.
//
// RIKTNINGEN ÄR OMVÄND mot alla andra mejl i lib/notifications: här skriver BESÖKAREN
// till KUNDEN (salongen/floristen), inte tvärtom. Det ger två konsekvenser:
//   • `to`   = kundens egen inbox (tenant_settings.settings.contact.email — samma
//     värde som brand.replyTo). Saknas den kan vi inte nå någon → vi hittar ALDRIG på
//     en adress, vi hoppar över mejlet. Raden ligger kvar i inkorgen i admin.
//   • `replyTo` = BESÖKARENS e-post. Då kan kunden trycka "Svara" och hamna hos
//     besökaren direkt. (Brand.replyTo — kundens egen adress — vore meningslöst här:
//     det skulle få kunden att svara sig själv.)
//
// From-adressen är plattformens (booking@corevo.se, TVÅ o) med kundens namn som
// display — SPF/DKIM måste fortsätta stämma, så avsändaradressen byts aldrig ut.
//
// BEST-EFFORT BY CONTRACT: anropas EFTER en lyckad DB-write och får ALDRIG kasta.
// Allt fångas → { ok:false }. Ett mejlfel får aldrig radera besökarens meddelande
// eller krascha formuläret för henne.

const SANS = `-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

export async function sendContactMessageEmail(args: {
  supabase: SupabaseClient<Database>
  tenantId: string
  tenantName: string
  /** Besökarens uppgifter — det som ska nå kunden. */
  name: string
  email: string | null
  phone: string | null
  subject: string | null
  message: string
}): Promise<SendResult> {
  try {
    const brand = await loadEmailBrand(args.supabase, args.tenantId, args.tenantName)

    // Kundens egen inbox. Saknas den finns ingen att mejla — hoppa över (raden lever
    // vidare i admin-inkorgen, så inget går förlorat).
    const to = brand.replyTo
    if (!to) return { ok: false, skipped: true }

    // Meddelandet: tomrader → stycken, radbrytningar → <br/>. esc() på ALLT som kommer
    // från besökaren — det här är ren främlingsinput och går rakt in i ett HTML-mejl.
    const paragraphs = args.message
      .split(/\n\s*\n/)
      .map(
        (p) =>
          `<p style="margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:1.6">${esc(p.trim()).replace(/\n/g, '<br/>')}</p>`,
      )
      .join('')

    // Avsändarraden: bara de fält besökaren faktiskt lämnade (render-on-present —
    // vi ritar aldrig en tom "Telefon:"-rad).
    const facts = [
      ['Namn', args.name],
      ['E-post', args.email],
      ['Telefon', args.phone],
      ['Gäller', args.subject],
    ]
      .filter((row): row is [string, string] => Boolean(row[1]))
      .map(
        ([label, value]) =>
          `<p style="margin:0 0 4px;font-family:${SANS};font-size:13px;color:#6b6b66"><strong>${label}:</strong> ${esc(value)}</p>`,
      )
      .join('')

    const html = shell(
      'Nytt meddelande från din webbplats',
      `${facts}<div style="margin-top:16px">${paragraphs}</div>`,
      args.tenantName,
      'Kontakt',
      brand,
    )

    return await sendEmail({
      to,
      subject: `Nytt meddelande från ${args.name} — ${args.tenantName}`,
      html,
      from: brand.from,
      // Besökarens adress → kunden kan svara direkt. Saknas den faller svaret tillbaka
      // på From (plattformen), vilket är ärligare än att fabricera en adress.
      replyTo: args.email ?? undefined,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send_failed' }
  }
}
