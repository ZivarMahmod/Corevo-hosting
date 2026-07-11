import type { CSSProperties, ReactNode } from 'react'

/** Delade formulär-stilar för admin-modulernas drawers/formulär (goal-55 steg 1).
 *  Exakta värdena ur KursAdmin/BloggAdmin/ShopAdmin/MediaLibrary/OffertInbox —
 *  de fem lokala kopiorna var byte-identiska; detta är nu enda källan. */
export const inputStyle: CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
  fontSize: 14,
  width: '100%',
}

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 80,
}

export const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

/** Label-wrapper med eyebrow-rubrik (KursAdmin-mönstret). */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  )
}
