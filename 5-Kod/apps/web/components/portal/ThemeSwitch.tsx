'use client'

import { useEffect, useState } from 'react'
import { Icon } from './ui/Icon'

/**
 * Back-office tema-väljare — Auto (enhetens inställning) / Ljus / Mörk (artifact-
 * mocken, Zivar: "man ska kunna välja ljust eller mörkt tema … eller enhetens").
 * Valet sparas i localStorage och stämplas som data-bo-theme på <html>; Auto tar
 * bort attributet så prefers-color-scheme styr. Ett no-flash-script i app/layout.tsx
 * sätter attributet FÖRE första render, så mörkt läge aldrig blinkar ljust.
 * Bara back-office-tokens ([data-world="backoffice"], tokens.css) lyssnar på
 * attributet — storefronts och /konto påverkas aldrig.
 */
type Mode = 'auto' | 'light' | 'dark'
const KEY = 'corevo-bo-theme'

function apply(mode: Mode) {
  const root = document.documentElement
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-bo-theme', mode)
  else root.removeAttribute('data-bo-theme')
}

export function ThemeSwitch() {
  // SSR renderar 'auto' — den sparade moden läses efter mount (ingen hydration-mismatch;
  // själva färgerna sattes redan av no-flash-scriptet).
  const [mode, setMode] = useState<Mode>('auto')
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      if (saved === 'light' || saved === 'dark') setMode(saved)
    } catch {
      /* private mode etc — auto gäller */
    }
  }, [])

  const pick = (m: Mode) => {
    setMode(m)
    try {
      localStorage.setItem(KEY, m)
    } catch {
      /* ignore */
    }
    apply(m)
  }

  return (
    <div className="bo-theme" role="group" aria-label="Tema">
      <button
        type="button"
        className={mode === 'auto' ? 'is-on' : ''}
        onClick={() => pick('auto')}
        title="Följ enhetens inställning"
      >
        <Icon name="monitor" size={13} />
        Auto
      </button>
      <button
        type="button"
        className={mode === 'light' ? 'is-on' : ''}
        onClick={() => pick('light')}
        title="Ljust tema"
        aria-label="Ljust tema"
      >
        <Icon name="sun" size={13} />
      </button>
      <button
        type="button"
        className={mode === 'dark' ? 'is-on' : ''}
        onClick={() => pick('dark')}
        title="Mörkt tema"
        aria-label="Mörkt tema"
      >
        <Icon name="moon" size={13} />
      </button>
    </div>
  )
}
