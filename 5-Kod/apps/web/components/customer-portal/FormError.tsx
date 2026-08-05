import type { ReactNode } from 'react'

export function FormError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p className="cp-form-error" id={id} role="alert">
      <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 6 6m0-6-6 6" />
      </svg>
      <span>{children}</span>
    </p>
  )
}
