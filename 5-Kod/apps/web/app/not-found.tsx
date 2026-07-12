// Global 404 — rendered for unknown/reserved/root hosts (no resolvable tenant)
// and for missing pages. White-label neutral: no tenant theming, no Corevo brand.
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        padding: '3rem 1.5rem',
        textAlign: 'center',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}
    >
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Sidan kunde inte hittas
        </h1>
        <p style={{ opacity: 0.7 }}>
          Adressen finns inte, eller så är företaget inte tillgängligt.
        </p>
      </div>
    </main>
  )
}
