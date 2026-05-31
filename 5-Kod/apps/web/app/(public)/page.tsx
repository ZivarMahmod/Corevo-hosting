import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { pickHero } from '@/components/brand/variants'
import { ServiceList } from '@/components/brand/ServiceList'
import { BookCta } from '@/components/brand/BookCta'

export default async function HomePage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle

  const Hero = pickHero(settings.layout.hero_variant)
  const services = await getServices(tenant.id, tenant.slug)
  const featured = services.slice(0, 3)

  return (
    <>
      <Hero
        tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
        branding={settings.branding}
      />

      <section className="section">
        <div className="section-inner">
          <h2>Populära tjänster</h2>
          <ServiceList services={featured} />
          {services.length > featured.length ? (
            <p className="section-more">
              <Link href="/tjanster">Se alla tjänster →</Link>
            </p>
          ) : null}
        </div>
      </section>

      <section className="section section-muted">
        <div className="section-inner section-cta">
          <h2>Redo att boka?</h2>
          <p>Hitta en tid som passar dig — boka direkt online.</p>
          <BookCta />
        </div>
      </section>
    </>
  )
}
