import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { CartPageContents } from '@/components/storefront/shop/CartPageContents'
import { SubpageHero } from '@/components/storefront/sections'
import { CalytrixCart } from '@/components/storefront/layouts/florist/calytrix.cart'
import type { ComponentType } from 'react'
import styles from './varukorg.module.css'

// ZIVARS LAG (goal-62): MALLEN ÄGER SIDAN. Varukorgen är inte en delad vy som byter
// färg — en mall som vill ha ett eget packbord bygger sin EGEN komponent och
// registrerar den här. Funktionen är fortfarande en (useCart, samma localStorage,
// samma priser); bara scenen byts. Mallar utan egen korg får den delade — tills de
// bygger sin. Slutmålet är att VARJE mall står i den här tabellen.
const CART_VIEWS: Partial<Record<string, ComponentType>> = {
  calytrix: CalytrixCart,
}

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
  const OwnCart = CART_VIEWS[settings.theme]
  if (OwnCart) {
    return (
      <>
        <SubpageHero eyebrow="— Din beställning" title="Varukorg" />
        <section className={`section ${styles.page}`}>
          <OwnCart />
        </section>
      </>
    )
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
