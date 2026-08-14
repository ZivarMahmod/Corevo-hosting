import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import type { Service } from '@/lib/tenant-data'
import { BookingProvider } from '@/components/storefront/BookingProvider'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { THEME_LOADS_LAYOUT_MODULES, THEME_OWNS_MODULES } from './runtime'
import { FreshCutFooter, FreshCutWordmark, freshCutNavigationLinks } from './FreshCutChrome'
import { FreshCutLayout } from './FreshCutLayout'

const EXTERNAL_URL = 'https://www.bokadirekt.se/places/freshcut-123'

const SERVICES = [
  ['Herrklippning', 'Klippning, styling och finish.', 30, 36900],
  ['Herrklippning Student', null, 30, 32900],
  ['Klippning + långt skägg', null, 45, 45900],
  ['Klippning + kort skägg', null, 30, 41900],
  ['Pensionärsklippning', null, 30, 32900],
  ['Barnklippning upp till 8 år', null, 30, 29900],
  ['Skäggtrim', null, 15, 22900],
].map(([name, description, duration_min, price_cents], index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  tenant_id: 'tenant-freshcut',
  name,
  description,
  duration_min,
  price_cents,
  active: true,
})) as Service[]

function renderFreshCut(copy?: Record<string, string>, bookingReachable = true) {
  return renderToStaticMarkup(
    <BookingProvider
      tenantName="FreshCut"
      services={[]}
      reachable={bookingReachable}
      provider="external"
      externalUrl={EXTERNAL_URL}
    >
      <FreshCutLayout
        tenant={{ id: 'tenant-freshcut', name: 'FreshCut', slug: 'freshcut' }}
        theme="freshcut"
        content={resolveThemeContent('freshcut', null, copy ?? null)}
        services={SERVICES}
        location={{
          name: 'FreshCut',
          address: 'Bokhållaregatan 2, 582 24 Linköping',
          hours: null,
        }}
        contact={{ email: 'info@freshcut.se', phone: '073 876 71 44' }}
        social={{ instagram: 'https://instagram.com/freshcut.lkpg', facebook: null, tiktok: null }}
        modules={{
          bookingReachable,
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

function renderFreshCutWithOverrides() {
  return renderToStaticMarkup(
    <BookingProvider
      tenantName="FreshCut"
      services={[]}
      reachable
      provider="external"
      externalUrl={EXTERNAL_URL}
      externalCtaUrls={{
        hero: 'https://www.bokadirekt.se/places/freshcut-hero',
        'service:00000000-0000-4000-8000-000000000001': 'https://www.bokadirekt.se/places/freshcut-service-1',
      }}
    >
      <FreshCutLayout
        tenant={{ id: 'tenant-freshcut', name: 'FreshCut', slug: 'freshcut' }}
        theme="freshcut"
        content={resolveThemeContent('freshcut', null, null)}
        services={SERVICES}
        location={null}
        contact={{ email: null, phone: null }}
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

describe('FreshCut v2 customer-locked website', () => {
  it('owns the FreshCut wordmark in one reusable chrome component', () => {
    expect(renderToStaticMarkup(<FreshCutWordmark name="FreshCut" />)).toBe(
      'FRESH<span>CUT</span><i>.</i>',
    )
    expect(renderToStaticMarkup(<FreshCutWordmark name="Annan salong" />)).toBe(
      'Annan salong<i>.</i>',
    )
  })

  it('loads booking state without taking ownership of future generic modules', () => {
    expect(THEME_LOADS_LAYOUT_MODULES.has('freshcut')).toBe(true)
    expect(THEME_OWNS_MODULES.has('freshcut')).toBe(false)
  })

  it('keeps the approved one-page navigation and appends future modules', () => {
    expect(freshCutNavigationLinks([
      { href: '/', label: 'Hem' },
      { href: '/tjanster', label: 'Tjänster' },
      { href: '/team', label: 'Team' },
      { href: '/om', label: 'Om oss' },
      { href: '/kontakt', label: 'Kontakt' },
      { href: '/blogg', label: 'Blogg' },
    ])).toEqual([
      { href: '/#tjanster', label: 'Tjänster' },
      { href: '/#resultat', label: 'Resultat' },
      { href: '/#salongen', label: 'Salongen' },
      { href: '/#kontakt', label: 'Kontakt' },
      { href: '/blogg', label: 'Blogg' },
    ])
  })

  it('renders the approved source structure and real service data', () => {
    const html = renderFreshCut()

    for (const copy of [
      'Klippt.',
      'Format.',
      'Klart.',
      'Välj ditt upplägg.',
      'Detaljerna gör',
      'skillnaden.',
      'Din lokala barberare.',
      'Vi ses i stolen.',
    ]) {
      expect(html).toContain(copy)
    }

    for (const service of SERVICES) {
      expect(html).toContain(service.name)
      expect(html).toContain(`${service.duration_min} min`)
      expect(html).not.toContain(`${Math.round(service.price_cents / 100)} kr`)
    }
    expect(html).toContain('Bokhållaregatan 2')
    expect(html).toContain('073 876 71 44')
    expect(html).toContain('info@freshcut.se')
    expect(html).toContain('@freshcut.lkpg')
  })

  it('routes every booking surface through the safe external contract', () => {
    const html = renderFreshCut()
    const externalLinks = [...html.matchAll(new RegExp(`href="${EXTERNAL_URL}"`, 'g'))]

    expect(externalLinks.length).toBeGreaterThanOrEqual(12)
    expect(html).not.toContain('href="/boka"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('routes named and service buttons through their own saved destinations', () => {
    const html = renderFreshCutWithOverrides()
    expect(html).toContain('href="https://www.bokadirekt.se/places/freshcut-hero"')
    expect(html).toContain('href="https://www.bokadirekt.se/places/freshcut-service-1"')
    expect(html).toContain(`href="${EXTERNAL_URL}"`)
  })

  it('does not present Corevo as FreshCuts booking engine', () => {
    const html = renderToStaticMarkup(
      <FreshCutFooter
        tenant={{ id: 'tenant-freshcut', name: 'FreshCut', slug: 'freshcut' }}
        tagline=""
        location={null}
        contact={{ email: null, phone: null }}
        social={{ instagram: null, facebook: null, tiktok: null }}
        links={[]}
      />,
    )

    expect(html).toContain('Webb via Corevo')
    expect(html).not.toContain('bokning via Corevo')
  })

  it('shows a booking button on every service', () => {
    const html = renderFreshCut()

    expect(html.match(/Boka <i aria-hidden="true">↗<\/i>/g)).toHaveLength(SERVICES.length)
  })

  it('keeps services visible but hides every booking control when the module is off', () => {
    const html = renderFreshCut(undefined, false)

    for (const service of SERVICES) expect(html).toContain(service.name)
    expect(html).not.toContain('Boka direkt')
    expect(html).not.toContain('Boka <i')
    expect(html).not.toContain(EXTERNAL_URL)
    expect(html).not.toContain('href="/boka"')
  })

  it('keeps owner copy above the customer template default', () => {
    const html = renderFreshCut({ heroTitle: 'FreshCut Linköping — kundens rubrik' })

    expect(html).toContain('FreshCut Linköping — kundens rubrik')
    expect(html).not.toContain('Klippt.<')
  })

  it('marks every editable section of the actual one-page layout for SidaStudio', () => {
    const html = renderFreshCut()

    for (const field of [
      'heroEyebrow', 'heroTitle', 'heroLede', 'servicesEyebrow', 'servicesTitle', 'servicesIntro',
      'resultsEyebrow', 'homeSecondTitle', 'resultsLede', 'resultImage1Caption',
      'studioImageCaption', 'studioEyebrow', 'aboutTitle', 'aboutCopyHome', 'studioPoint1',
      'whySub', 'whyTitle', 'contactEyebrow', 'contactTitle', 'contactLede',
      'location.address', 'contact.phone', 'contact.email', 'social.instagram',
    ]) {
      expect(html).toContain(`data-corevo-editor-field="${field}"`)
    }
  })
})
