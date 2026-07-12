// Storefront "stängt"-banner for a PAUSED module (multi-bransch spår 5).
//
// When a tenant's booking module sits at tenant_modules.state='paused', the
// storefront still renders (pages, content, photos) but booking is closed: this
// thin top banner says so and the "Boka tid" CTAs are made inert upstream (the
// layout passes the BookingProvider no services). A 'draft'/'off' module renders
// NOTHING public, so it never reaches this banner — only 'paused' does. That
// condition is UNCHANGED and lives at the call site.
//
// goal-60: the form lives in module-paused.module.css (was 1 inline style={{}}), on the
// shared --sf-notice-* tokens — so a paused module looks the SAME wherever it appears,
// and a template can tune it once instead of never.

import styles from './module-paused.module.css'

export function ModulePausedBanner({
  message = 'Bokningen är tillfälligt stängd. Vi öppnar igen snart.',
}: {
  message?: string
}) {
  return (
    <div role="status" className={styles.banner}>
      {message}
    </div>
  )
}
