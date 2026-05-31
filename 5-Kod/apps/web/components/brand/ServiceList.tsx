import type { Service } from '@/lib/tenant-data'

const kr = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
})

/** Renders a tenant's services. `.service-card` is a custom_override hook (nivå 3). */
export function ServiceList({ services }: { services: Service[] }) {
  if (services.length === 0) {
    return <p className="service-empty">Inga tjänster är publicerade ännu.</p>
  }
  return (
    <ul className="service-grid">
      {services.map((s) => (
        <li key={s.id} className="service-card">
          <div className="service-head">
            <h3>{s.name}</h3>
            <span className="service-price">{kr.format(s.price_cents / 100)}</span>
          </div>
          {s.description ? <p className="service-desc">{s.description}</p> : null}
          <span className="service-meta">
            {s.duration_min} min{s.category ? ` · ${s.category}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}
