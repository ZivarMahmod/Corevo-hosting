import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { pickHero } from '@/components/brand/variants'
import { ServiceMenu } from '@/components/storefront/ServiceMenu'
import { SectionHeader, AccentPhrase, StylistSpotlights, AboutSplit, LocationHours, ClosingCta } from '@/components/storefront/sections'
import { GallerySection } from '@/components/storefront/GallerySection'
import { Reveal } from '@/components/storefront/Reveal'
import styles from '@/components/storefront/storefront.module.css'

// Per-request, host-resolved tenant → never prerender.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle

  const Hero = pickHero(settings.layout.hero_variant)
  const services = await getServices(tenant.id, tenant.slug)
  const hasMore = services.length > 5

  return (
    <>
      {/* 3. HERO — full-bleed photo carousel + serif display headline + Boka */}
      <Hero
        tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
        branding={settings.branding}
      />

      {/* 4. Tjänster — numbered editorial menu (01–05) with real tenant prices */}
      <section className={`section ${styles.menuSection}`}>
        <div className="section-inner">
          <SectionHeader
            eyebrow="— Behandlingar"
            title="Tjänster & priser"
            lead="Varje behandling utförs med omsorg om dig och ditt hår."
          />
          <ServiceMenu services={services} limit={5} />
          {hasMore ? (
            <Reveal className="section-more">
              <Link href="/tjanster" className={styles.moreLink}>
                Se alla tjänster <span aria-hidden="true">→</span>
              </Link>
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* 5. Italic accent-phrase band — warmth */}
      <AccentPhrase text="Varje stol är en stund för sig själv." />

      {/* 6. Våra frisörer — stylist spotlights */}
      <StylistSpotlights salonName={tenant.name} />

      {/* 7. Galleri / Portfolio — image grid + lightbox */}
      <GallerySection />

      {/* 8. Om salongen — split photo/copy + stat-trio */}
      <AboutSplit salonName={tenant.name} />

      {/* 9. Plats & öppettider — address + hours + embedded OpenStreetMap */}
      <LocationHours salonName={tenant.name} />

      {/* 10. Closing CTA — full-bleed photo (parallax) + big serif + Boka */}
      <ClosingCta />
    </>
  )
}
