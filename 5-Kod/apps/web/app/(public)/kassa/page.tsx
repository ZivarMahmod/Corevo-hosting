import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadShopData } from '@/lib/storefront/shop/load-shop'
import { loadCheckoutOptions } from '@/lib/storefront/shop/checkout-options'
import { CheckoutForm } from '@/app/butik/kassa/CheckoutForm'
import { SubpageHero } from '@/components/storefront/sections'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import s from './kassa.module.css'

// ZIVARS LAG (goal-62): MALLEN ÄGER SIDAN. En mall med egen kassa-scen bygger sin egen;
// funktionen (reserve/confirm, valideringar, CheckoutLoader) är EN och delad. Mallar
// utan egen kassa får den delade — tills de bygger sin.
//
// goal-64: registreringen bodde i en HÅRDKODAD tabell här (CHECKOUT_VIEWS). Nu deklarerar
// mallen sin kassa i sin egen <key>.theme.ts (moduleViews.checkout).

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
      <section className={`section ${s.closed}`}>
        <h1 className={s.closedTitle}>Butiken är tillfälligt stängd</h1>
        <p className={s.closedText}>
          Vi tar inte emot beställningar just nu. Din varukorg finns kvar — välkommen tillbaka snart.
        </p>
        <Link href="/" className={s.link}>
          Till startsidan
        </Link>
      </section>
    )
  }

  const shop = await loadShopData(tenant.id, tenant.slug)
  const fulfilment = shop?.config.fulfilment ?? 'ship'

  // goal-64 — KASSANS VAL, server-side. Leveransvalen kommer ur kundens egna
  // shop_shipping_options; betalsätten är snittet av vad kunden slagit på och vad som
  // FAKTISKT är kopplat (Stripe godkänd / PayPal-nycklar satta). Vyn får dem som props
  // och räknar aldrig ut dem själv — ett betalsätt som inte är konfigurerat får inte
  // ens kunna renderas.
  const checkout = shop
    ? await loadCheckoutOptions(tenant.id, tenant.slug, shop.config)
    : { shippingOptions: [], paymentMethods: [] }

  // Mallens egen kassa vinner; den delade är bara fallback (samma mönster som korgen).
  const OwnCheckout = themeModuleViews(bundle.settings.theme).checkout

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
    <>
      <SubpageHero eyebrow="— Snart klart" title="Kassa" />
    <section className={`section ${s.shell}`}>
      {accountsEnabled && !signedIn ? (
        <p className={s.account}>
          Har du ett konto?{' '}
          <Link href="/login?next=/kassa" className={`${s.link} ${s.accountLink}`}>
            Logga in
          </Link>{' '}
          så sparas din beställning på Mina sidor.
        </p>
      ) : null}
      {accountsEnabled && signedIn && signedInEmail ? (
        <p className={s.account}>Inloggad som {signedInEmail} — beställningen sparas på Mina sidor.</p>
      ) : null}
      {OwnCheckout ? (
        <OwnCheckout
          fulfilment={fulfilment}
          shippingOptions={checkout.shippingOptions}
          paymentMethods={checkout.paymentMethods}
        />
      ) : (
        <CheckoutForm
          fulfilment={fulfilment}
          shippingOptions={checkout.shippingOptions}
          paymentMethods={checkout.paymentMethods}
        />
      )}
    </section>
    </>
  )
}
