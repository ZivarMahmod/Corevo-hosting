import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { CartPageContents } from '@/components/storefront/shop/CartPageContents'
import { SubpageHero } from '@/components/storefront/sections'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import styles from './varukorg.module.css'

// ZIVARS LAG (goal-62): MALLEN ÄGER SIDAN. Varukorgen är inte en delad vy som byter
// färg — en mall som vill ha ett eget packbord bygger sin EGEN komponent.
// Funktionen är fortfarande en (useCart, samma localStorage, samma priser); bara
// scenen byts. Mallar utan egen korg får den delade — tills de bygger sin.
//
// goal-64: registreringen bodde i en HÅRDKODAD tabell här (CART_VIEWS). Nu deklarerar
// mallen sin korg i sin egen <key>.theme.ts (moduleViews.cart) och vi slår upp den —
// samma väg som butiken och bloggen. En ny mall rör inte längre den här filen.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Varukorg' }

// Varukorgen som egen sida (goal-57 körning 11) — samma temade (public)-skal och
// modulgate som kassan: LIVE → korgen; PAUSED → ärlig stängd-vy (korgen finns kvar
// i localStorage); off/draft → notFound.
//
// goal-60: skalet bär varukorg.module.css (var 5 inline style={{}}). Gaten är
// oförändrad — samma tre utfall, samma villkor.
export default async function VarukorgPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  if (!isModuleLive(states, 'shop')) {
    if (!isModulePaused(states, 'shop')) notFound()
    return (
      <section className={`section ${styles.closed}`}>
        <h1 className={styles.closedTitle}>Butiken är tillfälligt stängd</h1>
        <p className={styles.closedText}>
          Vi tar inte emot beställningar just nu. Din varukorg finns kvar — välkommen tillbaka snart.
        </p>
        <Link href="/" className={styles.closedLink}>
          Till startsidan
        </Link>
      </section>
    )
  }

  // Mallens egen korg vinner; den delade är bara fallback tills varje mall byggt sin.
  //
  // goal-64 (regression): SubpageHero renderades HÄR OVANPÅ mallens egen vy oavsett —
  // en mall som ritar sin egen rubrik ("dina förvärv") fick då ETT extra generiskt
  // rubrikband stapla ovanpå den. En mall som äger sidan äger HELA sidan, inklusive
  // rubriken — samma regel som offert/presentkort/kurser.
  const OwnCart = themeModuleViews(settings.theme).cart
  if (OwnCart) {
    return <OwnCart />
  }

  return (
    <>
      <SubpageHero eyebrow="— Din beställning" title="Varukorg" />
      <section className={`section ${styles.page}`}>
        <CartPageContents />
      </section>
    </>
  )
}
