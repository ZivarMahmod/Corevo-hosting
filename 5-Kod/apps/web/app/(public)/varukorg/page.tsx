import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { CartPageContents } from '@/components/storefront/shop/CartPageContents'
import { SubpageHero } from '@/components/storefront/sections'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Varukorg' }

// Varukorgen som egen sida (goal-57 körning 11) — samma temade (public)-skal och
// modulgate som kassan: LIVE → korgen; PAUSED → ärlig stängd-vy (korgen finns kvar
// i localStorage); off/draft → notFound.
export default async function VarukorgPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  if (!isModuleLive(states, 'shop')) {
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

  return (
    <>
      <SubpageHero eyebrow="— Din beställning" title="Varukorg" />
      <section className="section" style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
        <CartPageContents />
      </section>
    </>
  )
}
