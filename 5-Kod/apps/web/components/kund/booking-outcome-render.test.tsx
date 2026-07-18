import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { KundBooking } from '@/lib/kund/bookings'
import { AccountHistory } from './AccountHistory'
import { deriveUsual } from './UsualCard'

function booking(status: string, id: string, serviceId = 'service-1'): KundBooking {
  return {
    id,
    status,
    startTs: '2026-07-17T10:00:00.000Z',
    endTs: '2026-07-17T10:30:00.000Z',
    priceCents: 30_000,
    serviceId,
    staffId: 'staff-1',
    serviceName: `Tjänst ${id}`,
    staffTitle: 'Alex',
    timeZone: 'Europe/Stockholm',
    note: null,
  }
}

describe('kundportalens bokningsutfall', () => {
  it('visar completed som besök och övriga statusar separat', () => {
    const html = renderToStaticMarkup(
      <AccountHistory
        past={[
          booking('completed', 'klar'),
          booking('no_show', 'uteblev'),
          booking('confirmed', 'olost'),
          booking('cancelled', 'avbokad'),
        ]}
        pointsPerVisit={[{ bookingId: 'klar', pointsDelta: 50 }]}
      />,
    )
    expect(html).toContain('Tidigare besök')
    expect(html).toContain('Tjänst klar')
    expect(html).toContain('+50 p')
    expect(html).toContain('Övriga bokningar')
    expect(html).toContain('Uteblev')
    expect(html).toContain('Väntar på avslut från verksamheten')
    expect(html).toContain('Avbokad')
  })

  it('låter bara completed-besök skapa en vana', () => {
    expect(
      deriveUsual(
        [booking('confirmed', 'framtid-1'), booking('no_show', 'uteblev-2')],
        'Europe/Stockholm',
      ),
    ).toBeNull()
    expect(
      deriveUsual(
        [
          booking('completed', 'klar-1'),
          { ...booking('completed', 'klar-2'), startTs: '2026-08-14T10:00:00.000Z' },
        ],
        'Europe/Stockholm',
      ),
    ).not.toBeNull()
  })
})
