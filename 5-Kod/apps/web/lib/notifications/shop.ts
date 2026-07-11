import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { sendEmail } from './email'
import { loadEmailBrand } from './brand'
import { shell } from './templates'
import { logger } from '@/lib/observability'
import { formatCents } from '@/lib/admin/shop/types'

// Webshop-kundmejl (goal-54): statusmejl till kunden när en order bekräftas,
// blir redo eller slutförs. Best-effort som all annan notifiering — ett mejlfel
// får ALDRIG blockera status-writen (try/catch runt allt, kastar aldrig).
// PII-not: customer_email läses tenant-scopat direkt ur shop_orders — samma
// åtkomstväg som admin-orderlistan (lib/admin/shop/data.listShopOrders); den
// token-gatade PII-vägen gäller den PUBLIKA order-uppslagningen, inte admin.

type MailableStatus = 'confirmed' | 'ready' | 'completed'

const COPY: Record<MailableStatus, { title: string; lead: string }> = {
  confirmed: {
    title: 'Beställningen är bekräftad',
    lead: 'Tack! Vi har tagit emot och bekräftat din beställning:',
  },
  ready: {
    title: 'Beställningen är redo',
    lead: 'Goda nyheter — din beställning är redo:',
  },
  completed: {
    title: 'Tack för din beställning',
    lead: 'Din beställning är nu slutförd. Här är en sammanfattning:',
  },
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

/**
 * Skicka statusmejl till orderns kund. Endast confirmed|ready|completed —
 * andra statusar är tyst no-op. Anropas EFTER lyckad status-write.
 */
export async function sendOrderStatusEmail(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  orderId: string,
  status: string,
): Promise<void> {
  if (status !== 'confirmed' && status !== 'ready' && status !== 'completed') return
  try {
    type OrderJoined = {
      id: string
      customer_email: string | null
      total_cents: number
      currency: string
      tracking_number: string | null
      carrier: string | null
      shop_order_items: { product_name: string; quantity: number; unit_price_cents: number }[] | null
    }
    const { data } = await supabase
      .from('shop_orders')
      .select(
        'id,customer_email,total_cents,currency,tracking_number,carrier,' +
          'shop_order_items(product_name,quantity,unit_price_cents)',
      )
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    // Cast som i lib/admin/shop/data.ts — de genererade DB-typerna parser inte
    // den joinade select-strängen (samma workaround, samma fältnamn).
    const order = (data ?? null) as OrderJoined | null
    const to = order?.customer_email?.trim()
    if (!order || !to) {
      logger.info('shop.notify.skipped_no_recipient', { orderId, status })
      return
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle()
    const tenantName = tenant?.name ?? 'Corevo'
    const brand = await loadEmailBrand(supabase, tenantId, tenantName)

    const items = order.shop_order_items ?? []
    const rows = items
      .map(
        (it) =>
          `<tr><td style="padding:6px 0;font-size:14px;color:#211C17">${esc(it.product_name)} × ${it.quantity}</td>` +
          `<td style="padding:6px 0;font-size:14px;color:#211C17;text-align:right;white-space:nowrap">${esc(formatCents(it.unit_price_cents * it.quantity, order.currency))}</td></tr>`,
      )
      .join('')
    const tracking = order.tracking_number
      ? `<p style="margin:14px 0 0;font-size:14px;color:#6A5F52">Spårningsnummer: <strong>${esc(order.tracking_number)}</strong>${order.carrier ? ` (${esc(order.carrier)})` : ''}</p>`
      : ''
    const copy = COPY[status]
    const body = `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#6A5F52">${esc(copy.lead)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E4DAC6">
        ${rows}
        <tr><td style="padding:10px 0 0;border-top:1px solid #E4DAC6;font-size:14px;font-weight:600;color:#211C17">Totalt</td>
        <td style="padding:10px 0 0;border-top:1px solid #E4DAC6;font-size:14px;font-weight:600;color:#211C17;text-align:right;white-space:nowrap">${esc(formatCents(order.total_cents, order.currency))}</td></tr>
      </table>
      ${tracking}`

    const res = await sendEmail({
      to,
      subject: `${copy.title} — ${tenantName}`,
      html: shell(copy.title, body, tenantName, 'Din beställning', brand),
      from: brand.from,
      replyTo: brand.replyTo,
    })
    if (res.ok) logger.info('shop.notify.sent', { orderId, status, to })
    else if (!res.skipped) logger.warn('shop.notify.failed', { orderId, status, error: res.error })
  } catch (err) {
    logger.warn('shop.notify.threw', {
      orderId,
      status,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
