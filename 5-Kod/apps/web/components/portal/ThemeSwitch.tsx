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
const THEME_EVENT = 'corevo-bo-theme-change'

const MODE_LABEL: Record<Mode, string> = {
  auto: 'Automatiskt läge',
  light: 'Ljust läge',
  dark: 'Mörkt läge',
}

export function nextThemeMode(mode: Mode): Mode {
  if (mode === 'auto') return 'light'
  if (mode === 'light') return 'dark'
  return 'auto'
}

function savedMode(): Mode {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'auto'
  } catch {
    return 'auto'
  }
}

function apply(mode: Mode) {
  const root = document.documentElement
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-bo-theme', mode)
  else root.removeAttribute('data-bo-theme')
}

export function ThemeSwitch({
  variant = 'segmented',
}: {
  variant?: 'segmented' | 'cycle'
} = {}) {
  // SSR renderar 'auto' — den sparade moden läses efter mount (ingen hydration-mismatch;
  // själva färgerna sattes redan av no-flash-scriptet).
  const [mode, setMode] = useState<Mode>('auto')
  useEffect(() => {
    setMode(savedMode())
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<Mode>).detail
      setMode(detail === 'light' || detail === 'dark' || detail === 'auto' ? detail : savedMode())
    }
    const syncStorage = (event: StorageEvent) => {
      if (event.key === KEY) setMode(savedMode())
    }
    window.addEventListener(THEME_EVENT, sync)
    window.addEventListener('storage', syncStorage)
    return () => {
      window.removeEventListener(THEME_EVENT, sync)
      window.removeEventListener('storage', syncStorage)
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
    // `storage` avfyras inte i samma dokument. Det egna eventet håller den synliga
    // mobilväljaren och den CSS-dolda desktopväljaren i exakt samma state vid resize.
    window.dispatchEvent(new CustomEvent<Mode>(THEME_EVENT, { detail: m }))
  }

  if (variant === 'cycle') {
    const next = nextThemeMode(mode)
    const title = `${MODE_LABEL[mode]} — byt till ${MODE_LABEL[next].toLocaleLowerCase('sv-SE')}`
    return (
      <div className="bo-theme bo-theme--compact">
        <button
          type="button"
          data-mode={mode}
          onClick={() => pick(next)}
          title={title}
          aria-label={title}
        >
          <span className="bo-theme-quick-icon" aria-hidden="true">
            ◐
          </span>
        </button>
      </div>
    )
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
