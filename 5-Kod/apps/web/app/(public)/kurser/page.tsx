import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadUpcomingEvents } from '@/lib/storefront/kurser/load-kurser'
import { formatEventPrice, formatEventStart } from '@/lib/storefront/kurser/types'
import { KursAnmalanForm } from '@/components/storefront/KursAnmalanForm'
import { SectionHeader } from '@/components/storefront/sections'
import { pageMetadata } from '@/components/storefront/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('kurser')
}

/**
 * Kurser & event — kommande tillfällen (tenant_events) med anmälan per
 * tillfälle (goal-54 körning 4). Gate: booking-modulen live/paused (samma form
 * som /blogg-gaten); paused → listan utan formulär + "stängt"-notis.
 */
export default async function KurserPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'booking')
  if (!isModuleLive(states, 'booking') && !paused) notFound()

  const events = await loadUpcomingEvents(tenant.id, tenant.slug)

  return (
    <section className="section" data-module="kurser">
      <div className="section-inner">
        <SectionHeader
          eyebrow="— Kurser & event"
          title="Kommande tillfällen"
          lead="Anmäl dig och ditt sällskap — avgiften betalas på plats."
        />

        {paused ? (
          <p
            role="status"
            style={{
              marginTop: 8,
              fontFamily: 'var(--font-ui)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-fg, #232520)',
              background: 'color-mix(in srgb, var(--color-accent, #C8A24A) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-accent, #C8A24A) 30%, transparent)',
              borderRadius: 'var(--radius, 4px)',
              padding: '10px 14px',
            }}
          >
            Anmälan är stängd just nu — kommande tillfällen visas, men det går inte att anmäla sig för tillfället.
          </p>
        ) : null}

        {events.length === 0 ? (
          <p
            style={{
              marginTop: 16,
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'color-mix(in srgb, var(--color-fg, #232520) 70%, transparent)',
            }}
          >
            Inga kommande tillfällen just nu — titta in igen snart.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: '24px 0 0', padding: 0, display: 'grid', gap: 28 }}>
            {events.map((ev) => {
              const left = ev.taken != null ? ev.capacity - ev.taken : null
              const full = left != null && left <= 0
              return (
                <li
                  key={ev.id}
                  style={{
                    padding: '24px 26px',
                    border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 14%, transparent)',
                    borderRadius: 'var(--radius, 4px)',
                    background: 'var(--color-bg, #fff)',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-ui)',
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--color-accent, #C8A24A)',
                    }}
                  >
                    {formatEventStart(ev.startsAt)}
                  </p>
                  <h2
                    style={{
                      margin: '8px 0 0',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(22px, 3vw, 28px)',
                      fontWeight: 600,
                      color: 'var(--color-fg, #232520)',
                    }}
                  >
                    {ev.title}
                  </h2>
                  {ev.description ? (
                    <p
                      style={{
                        margin: '10px 0 0',
                        maxWidth: 620,
                        fontFamily: 'var(--font-body)',
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: 'color-mix(in srgb, var(--color-fg, #232520) 80%, transparent)',
                      }}
                    >
                      {ev.description}
                    </p>
                  ) : null}
                  <p
                    style={{
                      margin: '12px 0 0',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px 18px',
                      alignItems: 'center',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--color-fg, #232520)',
                    }}
                  >
                    <span>{formatEventPrice(ev.priceCents)}</span>
                    <span>{ev.durationMin} min</span>
                    <span>
                      {left != null
                        ? `${Math.max(0, left)} ${Math.max(0, left) === 1 ? 'plats' : 'platser'} kvar`
                        : `Max ${ev.capacity} platser`}
                    </span>
                    {full ? (
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 12.5,
                          background: 'color-mix(in srgb, #b00020 10%, transparent)',
                          border: '1px solid color-mix(in srgb, #b00020 28%, transparent)',
                        }}
                      >
                        Fullbokat
                      </span>
                    ) : null}
                  </p>

                  {!paused && !full ? (
                    <KursAnmalanForm eventId={ev.id} maxParty={left != null ? Math.min(8, left) : 8} />
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
