import type { Metadata } from 'next'
import { OrderConfirmation } from '@/app/butik/bekraftelse/[id]/OrderConfirmation'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tack för din beställning' }

// Orderbekräftelse (goal-55 körning 7A): bor nu i (public)-skalet — samma temade
// nav/footer som resten av storefronten (kassan slutar byta värld). Token-gatad:
// client-delen läser session-token ur localStorage och anropar get_public_shop_order
// (PII-gräns — ordern bär leveransadress, exponeras aldrig fritt by-id).
export default async function BekraftelsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <section className="section" style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px' }}>
      <OrderConfirmation orderId={id} />
    </section>
  )
}
