import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { CartPageContents } from '@/components/storefront/shop/CartPageContents'
import { SubpageHero } from '@/components/storefront/sections'
import styles from './varukorg.module.css'

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
  const { tenant } = bundle

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

  return (
    <>
      <SubpageHero eyebrow="— Din beställning" title="Varukorg" />
      <section className={`section ${styles.page}`}>
        <CartPageContents />
      </section>
    </>
  )
}
