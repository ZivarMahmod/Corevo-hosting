import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadShopData } from '@/lib/storefront/shop/load-shop'
import { CheckoutForm } from '@/app/butik/kassa/CheckoutForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kassa' }

// Webshop-kassa (goal-55 körning 7A): kassan bor nu i (public)-skalet så köparen
// ALDRIG byter värld — samma temade nav/footer + CartProvider som resten av
// storefronten ((public)/layout.tsx wrappar redan i CartProvider, så ingen egen
// provider här). Gatad på LIVE shop-modul; paused → ärlig "tillfälligt stängd"-vy.
export default async function KassaPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  if (!isModuleLive(states, 'shop')) {
    // Strandad varukorg (goal-54): PAUSED = tillfälligt stängd → ärlig vy i stället
    // för 404 (kunden kan ha en varukorg kvar). off/draft → notFound som tidigare.
    if (!isModulePaused(states, 'shop')) notFound()
    return (
      <section className="section" style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display, var(--font-body))', fontSize: 28, margin: '0 0 12px' }}>
          Butiken är tillfälligt stängd
        </h1>
        <p style={{ color: 'var(--color-text-muted, inherit)', margin: '0 0 24px' }}>
          Vi tar inte emot beställningar just nu. Din varukorg finns kvar — välkommen tillbaka snart.
        </p>
        <Link href="/" style={{ textDecoration: 'underline' }}>Till startsidan</Link>
      </section>
    )
  }

  const shop = await loadShopData(tenant.id, tenant.slug)
  const fulfilment = shop?.config.fulfilment ?? 'ship'

  // Kundkonto för handel (goal-55 körning 9): kassan ERBJUDER inloggning — aldrig
  // tvingar (gästköp förblir default). Samma session-seam som confirmOrder i
  // butik/actions.ts: authenticated server-klient → auth.getUser(). Inloggad kund
  // får sin order länkad till kontot av confirm_shop_order (p_customer=auth.uid()).
  const accountsEnabled = bundle.settings.customerAccountsEnabled
  let signedInEmail: string | null = null
  let signedIn = false
  if (accountsEnabled) {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    signedIn = !!auth?.user
    signedInEmail = auth?.user?.email ?? null
  }

  return (
    <section className="section" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontFamily: 'var(--font-display, var(--font-body))', fontSize: 28, margin: '0 0 24px' }}>Kassa</h1>
      {accountsEnabled && !signedIn ? (
        <p style={{ margin: '-12px 0 20px', fontSize: 14, opacity: 0.75 }}>
          Har du ett konto?{' '}
          <Link href="/login?next=/kassa" style={{ textDecoration: 'underline' }}>
            Logga in
          </Link>{' '}
          så sparas din beställning på Mina sidor.
        </p>
      ) : null}
      {accountsEnabled && signedIn && signedInEmail ? (
        <p style={{ margin: '-12px 0 20px', fontSize: 14, opacity: 0.75 }}>
          Inloggad som {signedInEmail} — beställningen sparas på Mina sidor.
        </p>
      ) : null}
      <CheckoutForm fulfilment={fulfilment} />
    </section>
  )
}
