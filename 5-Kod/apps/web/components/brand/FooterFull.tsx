import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import type { TenantLocation, TenantContact } from '@/lib/tenant-data'
import styles from './brand.module.css'

/**
 * FooterFull — the rich 3-column footer used on the Salvia home page (handoff
 * Chrome.jsx Footer): brand + tagline + socials | besök oss (address/contact) |
 * öppettider. Driven by REAL bundle data (address, derived hours, saved contact);
 * each block degrades gracefully when a field is empty. White-label always.
 *
 * Only used in app/(public)/layout.tsx for Salvia (where the full bundle is
 * available). The other themes + boka/avboka use the compact <Footer>.
 */
export function FooterFull({
  tenant,
  tagline,
  location,
  contact,
}: {
  tenant: { name: string }
  tagline: string
  location: TenantLocation | null
  contact: TenantContact
}) {
  const hours = location?.hours ?? null
  return (
    <footer className={`footer ${styles.fullFooter}`}>
      <div className={styles.fullGrid}>
        <div>
          <div className={styles.fullWordmark}>{tenant.name}</div>
          <p className={styles.fullTagline}>{tagline}.</p>
          <div className={styles.fullSocials}>
            <span className={styles.fullSocial} aria-hidden="true">
              <StorefrontIcon name="instagram" size={20} />
            </span>
            <span className={styles.fullSocial} aria-hidden="true">
              <StorefrontIcon name="facebook" size={20} />
            </span>
          </div>
        </div>

        <div>
          <h4 className={styles.fullHead}>Besök oss</h4>
          {location?.address ? (
            <p className={styles.fullText}>{location.address}</p>
          ) : (
            <p className={styles.fullText}>Adress visas snart</p>
          )}
          {contact.phone ? (
            <p className={styles.fullText}>
              <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className={styles.fullLink}>
                {contact.phone}
              </a>
            </p>
          ) : null}
          {contact.email ? (
            <p className={styles.fullText}>
              <a href={`mailto:${contact.email}`} className={styles.fullLink}>
                {contact.email}
              </a>
            </p>
          ) : null}
        </div>

        <div>
          <h4 className={styles.fullHead}>Öppettider</h4>
          {hours ? (
            hours.map((h) => (
              <div key={h.day} className={styles.fullHoursRow}>
                <span>{h.day}</span>
                <span>{h.time}</span>
              </div>
            ))
          ) : (
            <p className={styles.fullText}>Visas snart</p>
          )}
        </div>
      </div>
      <div className={styles.fullBottom}>
        <span>
          © {new Date().getFullYear()} {tenant.name}
        </span>
        <span className={styles.fullSign}>Designad med omsorg</span>
      </div>
    </footer>
  )
}
