import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { BookingProvider } from '@/components/storefront/BookingProvider'
import type { Service } from '@/lib/tenant-data'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { FreshCutMotionLayout } from './FreshCutMotionLayout'

const EXTERNAL_URL = 'https://www.bokadirekt.se/places/freshcut-123'

const SERVICES = [
  ['Herrklippning', 30, 36900],
  ['Herrklippning Student', 30, 32900],
  ['Herrklippning, långt skägg, varm handduk', 45, 45900],
  ['Herrklippning, kort skägg, varm handduk', 30, 41900],
  ['Pensionärsklippning', 30, 32900],
  ['Barnklippning, upp till 8 år', 30, 29900],
  ['Skäggtrimning', 15, 22900],
].map(([name, duration_min, price_cents], index) => ({
  id: `freshcut-service-${index + 1}`,
  tenant_id: 'tenant-freshcut',
  name,
  description: null,
  duration_min,
  price_cents,
  active: true,
})) as Service[]

function renderMotiontest() {
  return renderToStaticMarkup(
    <BookingProvider
      tenantName="FreshCut"
      services={[]}
      reachable
      provider="external"
      externalUrl={EXTERNAL_URL}
    >
      <FreshCutMotionLayout
        tenant={{ id: 'tenant-freshcut', name: 'FreshCut', slug: 'freshcut' }}
        theme="freshcut"
        content={resolveThemeContent('freshcut', null, null)}
        services={SERVICES}
        location={{
          name: 'FreshCut Bokhållaregatan',
          address: 'Bokhållaregatan 2, 582 24 Linköping',
          hours: null,
        }}
        contact={{ email: 'info@freshcut.se', phone: '073 876 71 44' }}
        social={{ instagram: null, facebook: null, tiktok: null }}
        modules={{
          bookingReachable: true,
          shopTeasers: [],
          bloggTeasers: [],
          presentkortReachable: false,
          shopReachable: false,
          bloggReachable: false,
          offertReachable: false,
          lojalitetReachable: false,
          kurserReachable: false,
          galleriReachable: false,
        }}
      />
    </BookingProvider>,
  )
}

describe('FreshCut motiontest server markup', () => {
  it('renders the complete booking-first experience without media or JavaScript', () => {
    const html = renderMotiontest()

    for (const expected of [
      'Rent snitt. Ingen krångel.',
      'Boka via Bokadirekt',
      'Två salonger i Linköping',
      'Bokhållaregatan 2',
      'Sankt Larsgatan 17',
      '369 kr',
      'Damklippning',
      'data-provenance="prototype"',
      'data-storefront-experience="freshcut-motiontest"',
      'Bokningslänk kommer',
    ]) {
      expect(html).toContain(expected)
    }
    for (const id of ['upplevelsen', 'tjanster', 'salongen', 'resultat', 'om', 'kontakt']) {
      expect(html).toContain(`id="${id}"`)
    }
    expect(html.match(/data-poster-composition=/g)).toHaveLength(3)
    expect(html).not.toContain('href="/boka"')
  })

  it('routes every verified service id to the saved external destination', () => {
    const html = renderMotiontest()

    for (const service of SERVICES) {
      const row = html.match(
        new RegExp(`<article data-service-id="${service.id}"[\\s\\S]*?</article>`),
      )?.[0]

      expect(row).toBeDefined()
      expect(row).toContain(`href="${EXTERNAL_URL}"`)
      expect(row).toContain(`data-booking-slot="service:${service.id}"`)
    }
  })

  it('never gives prototype services or Sankt Larsgatan a production booking path', () => {
    const html = renderMotiontest()

    for (const name of ['Damklippning', 'Dam student', 'Dam pensionär']) {
      const row = html.match(
        new RegExp(`<li data-prototype-service="${name}"[\\s\\S]*?</li>`),
      )?.[0]

      expect(row).toBeDefined()
      expect(row).not.toContain('<a ')
      expect(row).not.toContain('data-service-id=')
      expect(row).not.toContain('data-booking-slot=')
    }

    const location = html.match(
      /<article data-location-key="sankt-larsgatan"[\s\S]*?<\/article>/,
    )?.[0]
    expect(location).toBeDefined()
    expect(location).toContain('Bokningslänk kommer')
    expect(location).not.toContain('<a ')
  })
})
