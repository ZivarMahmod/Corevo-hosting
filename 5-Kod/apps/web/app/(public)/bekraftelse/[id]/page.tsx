import type { Metadata } from 'next'
import Link from 'next/link'
import { OrderConfirmation } from '@/app/butik/bekraftelse/[id]/OrderConfirmation'
import { currentTenant } from '@/lib/tenant-data'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tack för din beställning' }

// Orderbekräftelse (goal-55 körning 7A): bor nu i (public)-skalet — samma temade
// nav/footer som resten av storefronten (kassan slutar byta värld). Token-gatad:
// client-delen läser session-token ur localStorage och anropar get_public_shop_order
// (PII-gräns — ordern bär leveransadress, exponeras aldrig fritt by-id).
export default async function BekraftelsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Kundkonto för handel (goal-55 körning 9): bekräftelsen ERBJUDER konto (aldrig
  // tvingar) — bara när ägaren slagit på kundkonton OCH köparen inte redan är
  // inloggad. /registrera är den riktiga signup-ytan (gatad på samma setting).
  const bundle = await currentTenant()
  let offerAccount = false
  if (bundle?.settings.customerAccountsEnabled) {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    offerAccount = !auth?.user
  }

  return (
    <section className="section" style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
      <OrderConfirmation orderId={id} />
      {offerAccount ? (
        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 14, opacity: 0.75 }}>
          <Link href="/registrera" style={{ textDecoration: 'underline' }}>
            Skapa konto
          </Link>{' '}
          för att följa din beställning på Mina sidor.
        </p>
      ) : null}
    </section>
  )
}
