'use client'

import { useEffect, useState } from 'react'
import { Icon } from './ui/Icon'
import { ThemeSwitch } from './ThemeSwitch'
import { CommandPalette, type CommandItem } from './ui/CommandPalette'

/**
 * Back-office topbar (playbook §4.1 / handoff Shell.jsx Topbar 253–271). Replaces
 * the plain inert search input with a ⌘K command-palette trigger (kbd hint). Owns
 * the document-level ⌘K/Ctrl+K shortcut and renders the CommandPalette overlay.
 * Sign-out + the page
 * title/user meta are passed in from the (server) PortalShell so this client
 * island stays thin. CHROME — present on every back-office surface, never /konto.
 *
 * Styling in app/portal-global.css (.portal-topbar*, .bo-cmdk-trigger).
 */
export function PortalTopbar({
  placeholder,
  paletteItems,
  contextLink,
  extra,
}: {
  /** Context-aware search placeholder (super vs salon copy). */
  placeholder: string
  /** Role-keyed go-to list for the palette (built server-side, serializable). */
  paletteItems: ReadonlyArray<CommandItem>
  /** Topbar context link — mock shows "Se din sida" (salon) → public storefront.
   *  User identity + sign-out live in the sidebar footer (handoff Shell.jsx). */
  contextLink?: { label: string; href: string }
  /** Extra chrome-kontroll (t.ex. butik-väljaren) — renderas först i höger-gruppen. */
  extra?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    // platform read is client-only (avoids SSR/hydration mismatch)
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ''))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="portal-topbar">
      <button
        type="button"
        className="bo-cmdk-trigger"
        onClick={() => setOpen(true)}
        aria-label="Sök — öppna kommandopaletten"
        aria-haspopup="dialog"
      >
        <Icon name="search" size={17} />
        <span className="bo-cmdk-trigger-text">{placeholder}</span>
        <kbd className="bo-cmdk-trigger-kbd">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <div className="portal-topbar-right">
        {extra}
        <ThemeSwitch />
        {contextLink ? (
          <a
            className="portal-topbar-sitelink"
            href={contextLink.href}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="external" size={15} />
            {contextLink.label}
          </a>
        ) : null}
      </div>
      <CommandPalette open={open} onClose={() => setOpen(false)} items={paletteItems} />
    </header>
  )
}
