import { EventSeatBuy } from '@/components/storefront/shop/EventSeatBuy'
import { SubpageHero, SectionHeader } from '@/components/storefront/sections'
import { loadKurserConfig, loadUpcomingEvents } from '@/lib/storefront/kurser/load-kurser'
import { formatEventPrice, formatEventStart } from '@/lib/storefront/kurser/types'
import { KursAnmalanForm } from '@/components/storefront/KursAnmalanForm'
import s from './kurser-section.module.css'

export async function KurserSection({
  tenantId,
  slug,
  checkoutLive = false,
  limit,
  moreHref,
  pageHero = false,
}: {
  tenantId: string
  slug: string
  checkoutLive?: boolean
  limit?: number
  moreHref?: string
  pageHero?: boolean
}) {
  const [events, config] = await Promise.all([
    loadUpcomingEvents(tenantId, slug),
    loadKurserConfig(tenantId, slug),
  ])

  if (typeof limit === 'number' && events.length === 0) return null

  const shownEvents = typeof limit === 'number' ? events.slice(0, limit) : events
  const registrationClosed = config.payment === 'checkout' && !checkoutLive
  const lead =
    config.payment === 'checkout' && checkoutLive
      ? 'Boka din plats direkt — kursplatsen läggs i varukorgen och betalas i kassan.'
      : config.payment === 'checkout'
        ? 'Onlineköp av kursplatser är inte öppet just nu.'
        : 'Anmäl dig och ditt sällskap — avgiften betalas på plats.'

  return (
    <>
      {pageHero ? (
        <SubpageHero eyebrow="— Kurser & event" title="Kommande tillfällen" lede={lead} />
      ) : null}
      <section className="section" data-module="kurser">
        <div className="section-inner">
          {!pageHero ? (
            <SectionHeader eyebrow="— Kurser & event" title="Kommande tillfällen" lead={lead} />
          ) : null}

          {registrationClosed ? (
            <p role="status" className={s.closed}>
              Anmälan är stängd just nu — kommande tillfällen visas, men det går inte
              att anmäla sig för tillfället.
            </p>
          ) : null}

          {events.length === 0 ? (
            <p className={s.empty}>Inga kommande tillfällen just nu — titta in igen snart.</p>
          ) : (
            <ul className={s.list}>
              {shownEvents.map((event) => {
                const remaining = event.taken == null ? null : Math.max(0, event.capacity - event.taken)
                const full = remaining != null && remaining === 0
                return (
                  <li key={event.id} className={full ? `${s.card} ${s.cardFull}` : s.card}>
                    <p className={s.when}>{formatEventStart(event.startsAt)}</p>
                    <h2 className={s.title}>{event.title}</h2>
                    {event.description ? <p className={s.lede}>{event.description}</p> : null}
                    <p className={s.facts}>
                      <span className={s.price}>{formatEventPrice(event.priceCents)}</span>
                      <span className={s.fact}>{event.durationMin} min</span>
                      <span className={full ? s.fact : s.seats}>
                        {remaining == null
                          ? `Max ${event.capacity} platser`
                          : `${remaining} ${remaining === 1 ? 'plats' : 'platser'} kvar`}
                      </span>
                      {full ? <span className={s.fullBadge}>Fullbokat</span> : null}
                    </p>

                    {!registrationClosed && !full ? (
                      config.payment === 'checkout' && checkoutLive ? (
                        <EventSeatBuy
                          eventId={event.id}
                          title={event.title}
                          priceCents={event.priceCents}
                          seatsLeft={remaining}
                        />
                      ) : config.payment === 'onsite' ? (
                        <KursAnmalanForm
                          eventId={event.id}
                          maxParty={remaining == null ? 8 : Math.min(8, remaining)}
                        />
                      ) : null
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}

          {moreHref && events.length > 0 ? (
            <p className={s.moreWrap}>
              <a href={moreHref} className={s.more}>
                Visa hela kurslistan →
              </a>
            </p>
          ) : null}
        </div>
      </section>
    </>
  )
}
