import styles from '@/components/brand/brand.module.css'
import { headers } from 'next/headers'
import { storefrontExperienceFromHeader } from '@/lib/storefront/experience'
import HomePage from './page'

/** Shared storefront loading skeleton (hero band + service-grid). Renders while
 *  the per-request tenant + services resolve. Covers every (public) route.
 *
 *  NOTE: the skeleton intentionally does NOT use the `.hero` class — the nav
 *  shell detects `.hero` to go transparent (white text), which would be
 *  illegible over this cream skeleton. Keeping a plain section means the fixed
 *  nav stays SOLID during loading. */
export default async function PublicLoading() {
  const experience = storefrontExperienceFromHeader(
    (await headers()).get('x-corevo-storefront-experience'),
  )

  return (
    <>
      {experience === 'freshcut-motiontest' ? (
        <noscript>
          <style>{'[data-public-storefront-loading] { display: none !important; }'}</style>
          <HomePage />
        </noscript>
      ) : null}

      <section data-public-storefront-loading className="section" aria-hidden="true">
        <div className={styles.heroSkeleton}>
          <div className={`${styles.skeletonBar} ${styles.skeletonTiny}`} />
          <div className={`${styles.skeletonBar} ${styles.skeletonHeadline}`} />
          <div className={`${styles.skeletonBar} ${styles.skeletonShort}`} />
          <div className={`${styles.skeletonBar} ${styles.skeletonCta}`} />
        </div>
      </section>

      <section data-public-storefront-loading className="section">
        <div className="section-inner">
          <span className={styles.srOnly} role="status">
            Laddar…
          </span>
          <ul className={`service-grid`} aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className={styles.skeleton}>
                <div className={styles.skeletonBar} />
                <div className={`${styles.skeletonBar} ${styles.skeletonShort}`} />
                <div className={`${styles.skeletonBar} ${styles.skeletonTiny}`} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
