'use client'

// fix-29 — last-resort error boundary. A route-segment error.tsx only catches throws
// inside its PAGE; an uncaught error in a LAYOUT (or a hydration mismatch from a
// stale cached bundle) escapes every segment boundary and Next renders its bare
// "Application error: a client-side exception has occurred" with no UI and no
// recovery. global-error is the only boundary that wraps the root layout, so it
// turns that dead screen into a calm, recoverable one.
//
// It REPLACES the root layout when it fires, so it must ship its own <html>/<body>.
// The clear-site-data hint is deliberate: the most common cause of a back-office
// client-side exception here is stale browser state (a pre-host-split *.corevo.se
// auth cookie colliding with the new host-locked one, or a cached old JS bundle) —
// the same class of issue as the demo.corevo.se "403" that was a stale Chrome
// profile, not the server. Reloading or clearing site-data resolves it.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="sv">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0f1c15',
          color: '#f4f1ea',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: '24px',
        }}
      >
        <main style={{ maxWidth: 460, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
            Något gick fel
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.5, opacity: 0.85, margin: '0 0 8px' }}>
            Sidan kunde inte visas just nu. Försök ladda om — det löser oftast problemet.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.6, margin: '0 0 24px' }}>
            Om det återkommer: logga ut och rensa webbplatsdata för corevo.se (eller öppna
            i ett privat fönster) och logga in igen.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              appearance: 'none',
              border: 'none',
              borderRadius: 10,
              padding: '11px 22px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              background: '#c8a24a',
              color: '#1a1208',
            }}
          >
            Ladda om
          </button>
        </main>
      </body>
    </html>
  )
}
