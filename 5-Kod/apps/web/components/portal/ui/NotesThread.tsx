'use client'

import { useState } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'

/** A channel-tagged note against a row (playbook §4.9 — "noteringar mot
 *  bokningsraden, INTE mejltråd"). `from` decides the bubble tint + the leading
 *  glyph: a customer message is gold-tinted (the salon should notice it), staff /
 *  system notes are neutral paper. */
export type ThreadNote = {
  /** Stable key (e.g. note row id, or index when ids are absent). */
  id: string | number
  /** Who wrote it. 'kund' = gold bubble; 'frisör'/'staff'/'system' = neutral. */
  from: 'kund' | 'frisör' | 'staff' | 'system'
  text: string
  /** Already-formatted author + time label (e.g. "Sara · nyss" / "System · 14:02"). */
  meta?: string
}

const isCustomer = (from: ThreadNote['from']) => from === 'kund'

/**
 * Notes thread (playbook §4.9 / Bokningar §3.2 + Frisör §2.2). Gold-100 chat
 * bubbles for the customer's messages against the booking row, neutral bubbles
 * for staff/system notes, plus an add-note input. Dumb + presentational: the
 * parent owns the data — it passes the resolved `notes[]` and an `onAddNote`
 * handler (which should mutate + fire the consequence toast). Empty state is
 * written, never blank (T10). Renders inside a drawer/card section.
 */
export function NotesThread({
  notes,
  onAddNote,
  placeholder = 'Lägg en notering…',
  emptyText = 'Inga noteringar än. Kundens meddelanden landar här — inte som mejltråd.',
  addLabel = 'Spara',
}: {
  notes: ReadonlyArray<ThreadNote>
  /** Called with the trimmed text when the operator adds a note. Omit to render read-only. */
  onAddNote?: (text: string) => void
  placeholder?: string
  emptyText?: string
  addLabel?: string
}) {
  const [draft, setDraft] = useState('')

  function submit() {
    const text = draft.trim()
    if (!text || !onAddNote) return
    onAddNote(text)
    setDraft('')
  }

  return (
    <div style={{ fontFamily: 'var(--font-ui)' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        {notes.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--c-ink-3)', padding: '4px 0' }}>{emptyText}</div>
        )}
        {notes.map((n) => {
          const cust = isCustomer(n.from)
          return (
            <div
              key={n.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                background: cust ? 'var(--c-gold-100)' : 'var(--c-paper-2)',
              }}
            >
              <Icon
                name={cust ? 'message' : 'info'}
                size={15}
                style={{
                  color: cust ? 'var(--c-gold-600)' : 'var(--c-ink-3)',
                  flex: 'none',
                  marginTop: 1,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--c-ink)', lineHeight: 1.45 }}>{n.text}</div>
                {n.meta && (
                  <div style={{ fontSize: 11, color: 'var(--c-ink-3)', marginTop: 3 }}>{n.meta}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {onAddNote && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--c-line)',
              background: 'var(--c-paper)',
              fontFamily: 'var(--font-ui)',
              fontSize: 13.5,
              color: 'var(--c-ink)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <Button variant="subtle" size="sm" icon="plus" onClick={submit}>
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
