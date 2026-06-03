'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, type IconName } from './Icon'

/** One go-to entry in the palette. Serializable so the server shell can build
 *  the list (role-keyed) and hand it to this client component. */
export type CommandItem = {
  /** Route to navigate to on select. */
  href: string
  /** Primary label (e.g. "Bokningar"). */
  label: string
  /** Lucide-derived glyph shown in the leading chip. */
  icon: IconName
  /** Small grouping label shown right-aligned (e.g. "Gå till"). */
  kind?: string
  /** Optional secondary text after the label (e.g. a subdomain). */
  sub?: string
}

/**
 * Command palette (⌘K) — playbook §4 chrome / handoff Shell.jsx CommandPalette
 * (276–329). A fuzzy "go to" list over the back-office routes for the active
 * role. Opened from the topbar trigger or ⌘K/Ctrl+K (handled in the topbar);
 * Esc closes, ↑/↓ move the highlight, Enter navigates. Presentational + routing
 * only — no data-layer import. Styling in app/portal-global.css (.bo-cmdk*).
 */
export function CommandPalette({
  open,
  onClose,
  items,
}: {
  open: boolean
  onClose: () => void
  items: ReadonlyArray<CommandItem>
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // reset query + highlight whenever the palette opens, and focus the input
  useEffect(() => {
    if (open) {
      setQ('')
      setHi(0)
      // focus after the open paint so the autofocus lands reliably
      const t = window.setTimeout(() => inputRef.current?.focus(), 20)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const matched = ql
      ? items.filter((it) =>
          `${it.label} ${it.kind ?? ''} ${it.sub ?? ''}`.toLowerCase().includes(ql),
        )
      : items
    return matched.slice(0, 9)
  }, [q, items])

  function run(it: CommandItem) {
    onClose()
    router.push(it.href)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHi((h) => Math.min(list.length - 1, h + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHi((h) => Math.max(0, h - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const it = list[hi]
        if (it) run(it)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // run() reads router/onClose via closure; list+hi are the live deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, list, hi, onClose])

  if (!open) return null

  return (
    <div className="bo-cmdk-overlay" role="presentation" onClick={onClose}>
      <div
        className="bo-cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Sök och gå till"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bo-cmdk-search">
          <Icon name="search" size={19} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setHi(0)
            }}
            placeholder="Sök sida eller åtgärd…"
            aria-label="Sök sida eller åtgärd"
          />
          <kbd>esc</kbd>
        </div>
        <div className="bo-cmdk-list">
          {list.length === 0 && (
            <div className="bo-cmdk-empty">Inget matchar &ldquo;{q}&rdquo;.</div>
          )}
          {list.map((it, i) => (
            <button
              key={it.href}
              type="button"
              className={`bo-cmdk-item${i === hi ? ' is-active' : ''}`}
              onMouseEnter={() => setHi(i)}
              onClick={() => run(it)}
            >
              <span className="bo-cmdk-item-chip" aria-hidden="true">
                <Icon name={it.icon} size={17} />
              </span>
              <span className="bo-cmdk-item-label">
                {it.label}
                {it.sub && <span className="bo-cmdk-item-sub">{it.sub}</span>}
              </span>
              {it.kind && <span className="bo-cmdk-item-kind">{it.kind}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
