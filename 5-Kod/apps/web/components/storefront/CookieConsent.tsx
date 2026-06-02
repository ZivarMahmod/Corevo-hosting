'use client'

import { useEffect, useState } from 'react'

// EU cookie-consent banner for the storefront (legal requirement for Swedish
// salon sites). Self-contained + themed purely via the storefront CSS custom
// properties (--color-surface/-fg/-fg-2/-primary/-line/--sf-radius), so it adopts
// each salon's theme without touching any shared CSS module. Rendered only when
// the owner keeps it on (settings.cookieBannerEnabled, default true).
//
// The site sets no tracking/analytics cookies today beyond the strictly-necessary
// auth/session cookies, so "Endast nödvändiga" and "Acceptera" both simply dismiss
// + remember the choice; the hook is here for when analytics is added later.

const STORAGE_KEY = 'corevo-cookie-consent'

export function CookieConsent() {
  // Start hidden; reveal after mount only if no choice is stored (avoids SSR/
  // hydration mismatch and a flash for returning visitors).
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true)
    } catch {
      // localStorage blocked (private mode / cookies off) → don't nag.
    }
  }, [])

  function choose(value: 'accepted' | 'necessary') {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* ignore */
    }
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie-samtycke"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '1rem',
        right: '1rem',
        bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        zIndex: 1000,
        margin: '0 auto',
        maxWidth: '560px',
        background: 'var(--color-surface, #fff)',
        color: 'var(--color-fg, #232520)',
        border: '1px solid var(--color-line, #e2ded2)',
        borderRadius: 'var(--sf-radius, 12px)',
        boxShadow: 'var(--sf-shadow-card, 0 24px 60px rgba(0,0,0,.12))',
        padding: '1rem 1.15rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--color-fg-2, #5c5f55)' }}>
        Vi använder nödvändiga cookies för att bokningen och inloggningen ska fungera. Du väljer själv om
        vi får använda fler.
      </p>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => choose('accepted')}
          style={{
            flex: '1 1 auto',
            minHeight: '44px',
            padding: '0.6rem 1.1rem',
            borderRadius: 'var(--sf-radius, 12px)',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            background: 'var(--color-primary, #5e7361)',
            color: 'var(--color-surface, #fff)',
          }}
        >
          Acceptera alla
        </button>
        <button
          type="button"
          onClick={() => choose('necessary')}
          style={{
            flex: '1 1 auto',
            minHeight: '44px',
            padding: '0.6rem 1.1rem',
            borderRadius: 'var(--sf-radius, 12px)',
            border: '1px solid var(--color-line, #e2ded2)',
            cursor: 'pointer',
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--color-fg, #232520)',
          }}
        >
          Endast nödvändiga
        </button>
      </div>
    </div>
  )
}
