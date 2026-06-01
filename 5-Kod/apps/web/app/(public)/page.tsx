import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { pickHero } from '@/components/brand/variants'
import { ServiceList } from '@/components/brand/ServiceList'
import { BookCta } from '@/components/brand/BookCta'
import styles from '@/components/brand/brand.module.css'

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
        <div className={`section-inner ${styles.sectionInner}`}>
          <p className={styles.sectionEyebrow}>Utvalda behandlingar</p>
          <h2>Populära tjänster</h2>
          <ServiceList services={featured} />
          {services.length > featured.length ? (
            <p className="section-more">
              <Link href="/tjanster" className={styles.moreLink}>
                Se alla tjänster <span aria-hidden="true">→</span>
              </Link>
            </p>
          ) : null}
        </div>
      </section>

      <section className={`section ${styles.ctaBand}`}>
        <div className="section-inner section-cta">
          <p className={styles.sectionEyebrow}>Boka direkt</p>
          <h2>Redo att boka?</h2>
          <p className={styles.ctaLead}>
            Hitta en tid som passar dig och boka online på under en minut — bekräftelse direkt.
          </p>
          <BookCta />
        </div>
      </section>
    </>
  )
}
