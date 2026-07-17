import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { sendEmail } from './email'
import { shell, esc } from './templates'
import { loadEmailBrand } from './brand'
import { logger } from '@/lib/observability'

// PRESENTKORTET NÅR MOTTAGAREN (goal-64).
//
// Kortet UTFÄRDAS i databasen (migration 0059: _commit_shop_order_stock skapar
// gift_cards-raden med kod + saldo när ordern är betald). Det som återstår är att
// leverera koden — och det kan bara TS-lagret göra, för mejl-rälsen bor här.
//
// IDEMPOTENS — DET SVÅRA STÄLLET. Webhooken kan levereras två gånger, och två
// samtidiga leveranser kan köra den här funktionen PARALLELLT. Ett "läs → skicka →
// märk skickat" hade då mejlat samma kod två gånger. Vi tar därför raden med ett
// VILLKORAT UPDATE (emailed_at is null → now()) och skickar BARA de rader vårt eget
// UPDATE fick tillbaka: databasen utser en vinnare, förloraren får noll rader och
// skickar ingenting.
//
// Om relayen uttryckligen nekar leveransen släpper vi just VÅR claim med CAS
// (`emailed_at = claimedAt`). En annan körning kan då försöka igen, men vi kan aldrig
// nollställa en senare lyckad claim. Fönstret mellan claim och transport är fortfarande
// avsiktligt låst så parallella callbacks inte mejlar samma värdebevis två gånger.
//
// Best-effort by contract: kastar aldrig, blockerar aldrig ett genomfört köp.

const SANS = `-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

type GiftRow = {
  id: string
  code: string
  initial_amount_cents: number
  currency: string
  delivery_mode: string | null
  recipient_name: string | null
  recipient_email: string | null
  message: string | null
}

/**
 * Mejla ut alla ÄNNU OMEJLADE presentkort som ordern utfärdade.
 *
 * Anropas med SERVICE-klienten (gift_cards är inte anon-läsbar — koder och saldon är
 * känsliga och får aldrig läcka; RLS släpper bara in tenanten själv).
 *
 * Ett fysiskt kort ('in_store') mejlas inte: det hämtas i butiken, och att skicka
 * koden i förväg vore att ge bort värdet innan kunden hämtat kortet. Raden märks ändå
 * som hanterad, så den inte ligger kvar och pollas i evighet.
 */
export async function deliverIssuedGiftCards(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  orderId: string,
): Promise<{ attempted: number; failed: number }> {
  // failed = RETRY-BARA misslyckanden (claim släppt → nästa försök kan claima om).
  // Anroparen (settle) använder det för giftDeliveryPending → PayPal-webhooken
  // begär re-leverans. Tidigare returnerade funktionen void och svalde allt —
  // pending-flaggan kunde ALDRIG bli sann och ett relayfel = tyst aldrig-levererat
  // presentkort (CodeRabbit-fynd).
  let failed = 0
  let attempted = 0
  try {
    // Varumärke + tenant-namn läses FÖRE claimen: fönstret claim→send ska vara så
    // smalt som möjligt (en krasch däremellan lämnar kortet märkt som mejlat utan
    // mejl — claimen saknar lease, se maintenance-notering).
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle()
    const tenantName = tenant?.name ?? 'Företaget'
    const brand = await loadEmailBrand(supabase, tenantId, tenantName)

    const claimedAt = new Date().toISOString()
    // Ta ALLA omejlade kort för ordern i ETT villkorat UPDATE. `.is('emailed_at', null)`
    // är låset: bara en samtidig körning kan matcha raden och få den i sitt RETURNING.
    const { data: claimed, error } = await supabase
      .from('gift_cards')
      .update({ emailed_at: claimedAt })
      .eq('tenant_id', tenantId) // app-lager-fence utöver RLS (service-rollen bypassar RLS)
      .eq('order_id', orderId)
      .is('emailed_at', null)
      .select(
        'id, code, initial_amount_cents, currency, delivery_mode, recipient_name, recipient_email, message',
      )

    if (error) {
      logger.warn('gift.deliver.claim_failed', { orderId, error: error.message })
      // Claim-fel = inget claimat = helt retry-bart.
      return { attempted: 0, failed: 1 }
    }
    const rows = (claimed ?? []) as GiftRow[]
    if (rows.length === 0) return { attempted: 0, failed: 0 } // inget att skicka (eller redan skickat)

    async function releaseClaim(giftCardId: string): Promise<void> {
      const { error: releaseError } = await supabase
        .from('gift_cards')
        .update({ emailed_at: null })
        .eq('id', giftCardId)
        .eq('tenant_id', tenantId)
        .eq('order_id', orderId)
        .eq('emailed_at', claimedAt)
      if (releaseError) {
        logger.warn('gift.deliver.release_failed', {
          orderId,
          giftCardId,
          error: releaseError.message,
        })
      }
    }

    for (const g of rows) {
      // Fysiskt kort → hämtas i butik. Ingen kod på mejl (se headern).
      if (g.delivery_mode === 'in_store') continue
      const to = g.recipient_email
      if (!to) {
        logger.warn('gift.deliver.no_recipient', { orderId, giftCardId: g.id })
        continue
      }
      attempted++

      const amount = `${Math.round(g.initial_amount_cents / 100).toLocaleString('sv-SE')} ${
        g.currency === 'SEK' ? 'kr' : g.currency
      }`
      const hälsning = g.recipient_name ? `Hej ${esc(g.recipient_name)},` : 'Hej,'
      const html = shell(
        'Ditt presentkort',
        `<p style="margin:0 0 12px;font-family:${SANS};font-size:14px">${hälsning}</p>
         <p style="margin:0 0 14px;font-family:${SANS};font-size:14px;line-height:1.6">
           Du har fått ett presentkort hos ${esc(tenantName)} på <strong>${esc(amount)}</strong>.
         </p>
         ${
           g.message
             ? `<p style="margin:0 0 14px;padding:12px 14px;background:#f6f5f2;font-family:${SANS};font-size:14px;line-height:1.6;font-style:italic">${esc(
                 g.message,
               )}</p>`
             : ''
         }
         <p style="margin:0 0 6px;font-family:${SANS};font-size:14px">Din kod:</p>
         <p style="margin:0 0 14px;font-family:${SANS};font-size:22px;letter-spacing:0.12em;font-weight:700">${esc(
           g.code,
         )}</p>
         <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:#666">
           Ange koden vid köp eller bokning. Saknas något — svara på det här mejlet.
         </p>`,
        tenantName,
        'Presentkort',
        brand,
      )

      let res
      try {
        res = await sendEmail({
          to,
          subject: `Ditt presentkort hos ${tenantName}`,
          html,
          from: brand.from,
          replyTo: brand.replyTo,
        })
      } catch (err) {
        // sendEmail:s kontrakt fångar normala transportfel och returnerar !ok.
        // Ett oväntat kast har okänd leveransstatus; behåll därför claimen så en
        // retry aldrig riskerar att mejla samma värdebevis två gånger.
        logger.warn('gift.deliver.send_threw', {
          orderId,
          giftCardId: g.id,
          error: err instanceof Error ? err.message : String(err),
        })
        continue
      }
      if (!res.ok) {
        // Relayen bekräftade ingen leverans. Släpp bara vår egen tidsstämplade
        // claim; CAS-villkoret skyddar en eventuell senare vinnare. RETRY-BART →
        // räknas som failed så webhooken kan begära re-leverans.
        await releaseClaim(g.id)
        failed++
        logger.warn('gift.deliver.send_failed', { orderId, giftCardId: g.id, error: res.error })
      }
    }
  } catch (err) {
    logger.warn('gift.deliver.failed', {
      orderId,
      error: err instanceof Error ? err.message : String(err),
    })
    // Oväntat kast: leveransstatus okänd, claims kan sitta kvar (ej retry-bara).
    // Räknas INTE som failed — en pending-retry skulle ändå no-op:a mot claimen.
  }
  return { attempted, failed }
}
