import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { BookingProvider } from '@/components/storefront/BookingProvider'
import { editorFieldTargets } from '@/components/platform/SidaStudioV2.pick'
import { buildSiteEditorManifest } from '@/lib/platform/site-editor-manifest'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { THEME_SUITES } from '@/lib/storefront/themes/registry'
import type { Service, StorefrontTheme } from '@/lib/tenant-data'
import { themePages } from './runtime'

const services = [{
  id: '00000000-0000-4000-8000-000000000001',
  tenant_id: 'tenant-test',
  name: 'Testtjänst',
  description: 'Beskrivning',
  duration_min: 30,
  price_cents: 50000,
  active: true,
}] as Service[]

const location = { id: 'location-test', name: 'Test', address: 'Storgatan 1', hours: [{ day: 'Måndag', time: '09–17' }] }
const contact = { email: 'hej@test.se', phone: '070 123 45 67' }
const modules = { bookingReachable: false, offertReachable: false }
const themes = [...THEME_SUITES.florist, ...THEME_SUITES.salong].map(({ key }) => key as StorefrontTheme)
const aboutFields = (theme: StorefrontTheme) => {
  if (theme === 'blomstertorget') return ['aboutTitle', 'teamTitle', 'aboutCopy', 'about_image']
  if (theme === 'calytrix') return ['aboutTitle', 'aboutCopy', 'italic', 'about_image', 'pillar1Title', 'pillar1Body']
  if (theme === 'lunaria') return ['teamEyebrow', 'aboutTitle', 'aboutCopy', 'closingLede', 'about_image']
  if (theme === 'snitt') return ['teamEyebrow', 'aboutTitle', 'aboutCopyHome', 'italic', 'about_image']
  return ['teamEyebrow', 'aboutTitle', 'aboutCopy', 'italic', 'about_image']
}

function renderPage(theme: StorefrontTheme, page: 'om' | 'tjanster' | 'kontakt') {
  const Page = themePages(theme)[page]!
  return renderToStaticMarkup(
    <BookingProvider tenantName="Test" services={[]} reachable={false}>
      <Page
        tenant={{ id: 'tenant-test', name: 'Test', slug: 'test' }}
        content={resolveThemeContent(theme, null, null)}
        services={services}
        location={location}
        contact={contact}
        modules={modules}
      />
    </BookingProvider>,
  )
}

function targetsFor(theme: StorefrontTheme) {
  const kind = theme === 'kalla' || theme === 'snitt' ? theme : 'generic'
  const manifest = buildSiteEditorManifest(kind, resolveThemeContent(theme, null, null), theme)
  return new Set(editorFieldTargets([...manifest.tabs, ...(manifest.modules ?? [])], 'hem').map(({ field }) => field))
}

describe('theme page SidaStudio markers', () => {
  it.each(themes)('%s exposes its rendered about-page fields to SidaStudio', (theme) => {
    const html = renderPage(theme, 'om')
    const targets = targetsFor(theme)
    for (const field of aboutFields(theme)) {
      expect(html).toContain(`data-corevo-editor-field="${field}"`)
      expect(targets).toContain(field)
    }
  })

  it.each(themes)('%s exposes its service-page heading to SidaStudio', (theme) => {
    const html = renderPage(theme, 'tjanster')
    expect(html).toContain('data-corevo-editor-field="servicesTitle"')
    expect(targetsFor(theme)).toContain('servicesTitle')
  })

  it.each(themes)('%s exposes contact facts to the existing Contact editor', (theme) => {
    const html = renderPage(theme, 'kontakt')
    const targets = targetsFor(theme)
    for (const field of [
      ...(theme === 'eloria' ? [] : ['contact.email']),
      'contact.phone',
      'location.address',
      'opening_hours.0.time',
    ]) {
      expect(html).toContain(`data-corevo-editor-field="${field}"`)
      expect(targets).toContain(field)
    }
  })
})
