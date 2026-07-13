import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadUpcomingEvents, loadKurserConfig } from '@/lib/storefront/kurser/load-kurser'
import { formatEventPrice, formatEventStart } from '@/lib/storefront/kurser/types'
import { KursAnmalanForm } from '@/components/storefront/KursAnmalanForm'
import { EventSeatBuy } from '@/components/storefront/shop/EventSeatBuy'
import { SubpageHero } from '@/components/storefront/sections'
import { pageMetadata } from '@/components/storefront/seo'
import s from './kurser.module.css'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('kurser')
}

/**
 * Kurser & event — kommande tillfällen (tenant_events) med anmälan per
 * tillfälle (goal-54 körning 4). Gate: EGEN kurser-modul (migration 0056) —
 * tidigare hängde den på booking, vilket gav alla booking-kunder kurser
 * automatiskt. paused → listan utan formulär + "stängt"-notis.
 */
export default async function KurserPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'kurser')
  if (!isModuleLive(states, 'kurser') && !paused) notFound()

  const [events, kurserConfig] = await Promise.all([
    loadUpcomingEvents(tenant.id, tenant.slug),
    loadKurserConfig(tenant.id, tenant.slug),
  ])
  const köpIKassan = kurserConfig.payment === 'checkout'

  return (
    <>
      <SubpageHero
        eyebrow="— Kurser & event"
        title="Kommande tillfällen"
        // Ledtexten måste säga SANNINGEN om hur den här kunden tar betalt. "Betalas på
        // plats" ovanför en kassa-knapp är precis den sortens lilla lögn som gör att
        // ingen litar på resten av sidan.
        lede={
          köpIKassan
            ? 'Boka din plats direkt — kursplatsen läggs i varukorgen och betalas i kassan.'
            : 'Anmäl dig och ditt sällskap — avgiften betalas på plats.'
        }
      />
    <section className="section" data-module="kurser">
      <div className="section-inner">

        {paused ? (
          <p role="status" className={s.paused}>
            Anmälan är stängd just nu — kommande tillfällen visas, men det går inte att anmäla sig för tillfället.
          </p>
        ) : null}

        {events.length === 0 ? (
          <p className={s.empty}>Inga kommande tillfällen just nu — titta in igen snart.</p>
        ) : (
          <ul className={s.list}>
            {events.map((ev) => {
              const left = ev.taken != null ? ev.capacity - ev.taken : null
              const full = left != null && left <= 0
              const seatsLeft = left != null ? Math.max(0, left) : null
              return (
                <li key={ev.id} className={full ? `${s.card} ${s.cardFull}` : s.card}>
                  {/* Datum + tid = fakta man scannar: mikrotext, spärrad. */}
                  <p className={s.when}>{formatEventStart(ev.startsAt)}</p>

                  <h2 className={s.title}>{ev.title}</h2>

                  {ev.description ? <p className={s.lede}>{ev.description}</p> : null}

                  <p className={s.facts}>
                    <span className={s.price}>{formatEventPrice(ev.priceCents)}</span>
                    <span className={s.fact}>{ev.durationMin} min</span>
                    {/* Platsräkningen är oförändrad — bara klädd. */}
                    <span className={full ? s.fact : s.seats}>
                      {seatsLeft != null
                        ? `${seatsLeft} ${seatsLeft === 1 ? 'plats' : 'platser'} kvar`
                        : `Max ${ev.capacity} platser`}
                    </span>
                    {full ? <span className={s.fullBadge}>Fullbokat</span> : null}
                  </p>

                  {/* Ett fullbokat tillfälle SÄGER varför anmälan saknas — tomhet är inget besked. */}
                  {full && !paused ? (
                    <p className={s.fullNote}>
                      Det här tillfället är fullbokat. Håll utkik — vi lägger ut fler datum löpande.
                    </p>
                  ) : null}

                  {/* goal-64: TVÅ VÄGAR IN, kundens val (config.payment) avgör vilken.
                      'checkout' → kursplatsen är ett KÖP: den läggs i varukorgen (håller
                      en plats i capacity) och betalas i kassan. Anmälan skapas när ordern
                      är betald. 'onsite' (default) → anmälningsformuläret, ORÖRT: avgiften
                      visas och betalas på plats, precis som förut. */}
                  {!paused && !full ? (
                    kurserConfig.payment === 'checkout' ? (
                      <EventSeatBuy
                        eventId={ev.id}
                        title={ev.title}
                        priceCents={ev.priceCents}
                        seatsLeft={seatsLeft}
                      />
                    ) : (
                      <KursAnmalanForm eventId={ev.id} maxParty={left != null ? Math.min(8, left) : 8} />
                    )
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
    </>
  )
}
