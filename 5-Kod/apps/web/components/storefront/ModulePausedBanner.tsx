// Storefront "stängt"-banner for a PAUSED module (multi-bransch spår 5).
//
// When a tenant's booking module sits at tenant_modules.state='paused', the
// storefront still renders (pages, content, photos) but booking is closed: this
// thin top banner says so and the "Boka tid" CTAs are made inert upstream (the
// layout passes the BookingProvider no services). A 'draft'/'off' module renders
// NOTHING public, so it never reaches this banner — only 'paused' does.
//
// Themed via the storefront tokens (no new palette): a soft accent-tinted strip
// that reads as a notice, not an error.

export function ModulePausedBanner({
  message = 'Bokningen är tillfälligt stängd. Vi öppnar igen snart.',
}: {
  message?: string
}) {
  return (
    <div
      role="status"
      style={{
        width: '100%',
        textAlign: 'center',
        padding: '10px 16px',
        fontFamily: 'var(--font-ui)',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
        color: 'var(--color-fg, #232520)',
        background: 'color-mix(in srgb, var(--color-accent, #C8A24A) 16%, transparent)',
        borderBottom: '1px solid color-mix(in srgb, var(--color-accent, #C8A24A) 32%, transparent)',
      }}
    >
      {message}
    </div>
  )
}
