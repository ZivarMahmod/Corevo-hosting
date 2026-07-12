'use client'

import { useEffect, useState } from 'react'
import styles from './cookie-consent.module.css'

// EU cookie-consent banner for the storefront (legal requirement for Swedish
// salon sites). Rendered only when the owner keeps it on
// (settings.cookieBannerEnabled, default true).
//
// goal-60: the form now lives in cookie-consent.module.css (was 5 inline style={{}}).
// This is the FIRST surface every visitor sees, on top of the template's hero — and
// inline styles could not carry :hover/:active/:focus-visible, nor could any TEMPLATE
// reach into them. So it was always the platform's grey slab. It now wears the
// template's button + radius tokens.
//
// FUNCTION UNCHANGED: the site sets no tracking/analytics cookies today beyond the
// strictly-necessary auth/session cookies, so "Endast nödvändiga" and "Acceptera alla"
// both simply record the choice in localStorage and dismiss; the hook is here for when
// analytics is added later. Declining sets NO analytics cookies — that is the point.
//
// NO DARK PATTERN: both buttons are equal affordances (same flex basis, same 48px
// height, same padding, same weight, same radius, same states). Declining must never be
// harder to click than accepting. See the contrast note in the CSS module.

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
    <div role="dialog" aria-label="Cookie-samtycke" aria-live="polite" className={styles.banner}>
      <p className={styles.text}>
        Vi använder nödvändiga cookies för att bokningen och inloggningen ska fungera. Du väljer själv om
        vi får använda fler.
      </p>
      <div className={styles.actions}>
        <button type="button" onClick={() => choose('accepted')} className={`${styles.btn} ${styles.accept}`}>
          Acceptera alla
        </button>
        <button
          type="button"
          onClick={() => choose('necessary')}
          className={`${styles.btn} ${styles.necessary}`}
        >
          Endast nödvändiga
        </button>
      </div>
    </div>
  )
}
