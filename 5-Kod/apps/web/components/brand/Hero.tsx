import { BookCta } from './BookCta'
import type { BrandProps } from './types'

/** Hero variant 1 — centered, large headline. */
export function Hero1({ tenant }: BrandProps) {
  return (
    <section className="hero hero-1">
      <div className="hero-inner">
        <h1>{tenant.name}</h1>
        <p className="hero-sub">
          Välkommen till {tenant.name}. Boka din tid online — enkelt, snabbt och när det passar dig.
        </p>
        <BookCta className="hero-cta" />
      </div>
    </section>
  )
}

/** Hero variant 2 — left-aligned with eyebrow label. */
export function Hero2({ tenant }: BrandProps) {
  return (
    <section className="hero hero-2">
      <div className="hero-inner">
        <p className="hero-eyebrow">Salong</p>
        <h1>{tenant.name}</h1>
        <p className="hero-sub">
          Hos {tenant.name} möts hantverk och omtanke. Välj en tid som passar dig.
        </p>
        <BookCta className="hero-cta" />
      </div>
    </section>
  )
}
