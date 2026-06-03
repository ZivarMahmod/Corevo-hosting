'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Back-office detail Drawer (playbook §4.9) — the shared right-anchored surface
 * for booking / customer / staff detail. Green-tinted scrim, slide-in panel
 * (translateX 102%→0, .34s ease-out), Playfair header with an optional accent
 * (badge) slot + sub, a scrolling body and a sticky footer for status-aware
 * actions. Escape + scrim-click close (with an exit animation); body scroll is
 * locked while open. Render it conditionally from the parent — mounting opens it.
 *
 * Styling lives in app/portal-global.css (.bo-drawer*), so this only owns markup
 * + behaviour, matching the .pbtn/.ptable convention.
 */
export function Drawer({
  title,
  sub,
  accent,
  footer,
  onClose,
  children,
  ariaLabel,
}: {
  title: ReactNode
  sub?: ReactNode
  /** Badge / pill slot above the title (e.g. status badge). */
  accent?: ReactNode
  /** Sticky footer actions. */
  footer?: ReactNode
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)

  // animate out, then unmount via the parent's onClose
  function close() {
    if (closingRef.current) return
    closingRef.current = true
    overlayRef.current?.classList.add('is-closing')
    panelRef.current?.classList.add('is-closing')
    window.setTimeout(onClose, 330)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
    // mount/unmount only — close() reads refs, not state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const label = ariaLabel ?? (typeof title === 'string' ? title : 'Detalj')

  return (
    <div ref={overlayRef} className="bo-drawer-overlay" role="presentation" onClick={close}>
      <div
        ref={panelRef}
        className="bo-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bo-drawer-head">
          <div className="bo-drawer-head-text">
            {accent && <div style={{ marginBottom: 8 }}>{accent}</div>}
            <h2 className="bo-drawer-title">{title}</h2>
            {sub && <p className="bo-drawer-sub">{sub}</p>}
          </div>
          <button type="button" className="bo-drawer-close" onClick={close} aria-label="Stäng">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="bo-drawer-body">{children}</div>
        {footer && <div className="bo-drawer-foot">{footer}</div>}
      </div>
    </div>
  )
}
