import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { BookingProvider } from '@/components/storefront/BookingProvider'
import { buildSiteEditorManifest } from '@/lib/platform/site-editor-manifest'
import { editorFieldTargets } from '@/components/platform/SidaStudioV2.pick'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import type { Service, StorefrontTheme } from '@/lib/tenant-data'
import type { StorefrontLayoutProps } from './types'
import { EditLayout } from './EditLayout'
import { FloraLayout } from './FloraLayout'
import { AteljeVinterLayout } from './florist/AteljeVinterLayout'
import { EloriaLayout } from './florist/EloriaLayout'
import { AuroraLayout } from './florist/AuroraLayout'
import { BlomstertorgetLayout } from './florist/BlomstertorgetLayout'
import { CalytrixLayout } from './florist/CalytrixLayout'
import { LunariaLayout } from './florist/LunariaLayout'
import { SivSavLayout } from './florist/SivSavLayout'
import { SolSaltLayout } from './florist/SolSaltLayout'
import { OnyxLayout } from './florist/OnyxLayout'
import { ZentumLayout } from './ekonomi/ZentumLayout'
import { LeanderLayout } from './LeanderLayout'
import { LinneaLayout } from './LinneaLayout'
import { SalviaLayout } from './SalviaLayout'
import { ZiggeLayout } from './ZiggeLayout'
import { KallaLayout } from './salong/KallaLayout'
import { SnittLayout } from './salong/SnittLayout'
import { SiluettLayout } from './salong/SiluettLayout'

const modules = {
  bookingReachable: false,
  shopTeasers: [],
  bloggTeasers: [],
  presentkortReachable: false,
  shopReachable: false,
  bloggReachable: false,
  offertReachable: false,
  lojalitetReachable: false,
  kurserReachable: false,
  galleriReachable: false,
}

const services = [{
  id: '00000000-0000-4000-8000-000000000001',
  tenant_id: 'tenant-test',
  name: 'Testtjänst',
  description: 'Beskrivning',
  duration_min: 30,
  price_cents: 50000,
  active: true,
}] as Service[]

const location = {
  name: 'Test',
  address: 'Storgatan 1, 123 45 Teststad',
  hours: [{ day: 'Måndag', time: '09–17' }],
}

function renderLayout(
  theme: StorefrontTheme,
  Layout: ComponentType<StorefrontLayoutProps>,
  copy: Partial<StorefrontLayoutProps['content']> = {},
) {
  return renderToStaticMarkup(
    <BookingProvider tenantName="Test" services={[]} reachable={false}>
      <Layout
        tenant={{ id: 'tenant-test', name: 'Test', slug: 'test' }}
        theme={theme}
        content={{ ...resolveThemeContent(theme, null, null), ...copy }}
        services={services}
        location={location}
        modules={modules}
      />
    </BookingProvider>,
  )
}

describe('Generic storefront SidaStudio markers', () => {
  it.each([
    ['zigge', ZiggeLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'stats.0.value', 'stats.0.label']],
    ['leander', LeanderLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'italic', 'stats.0.value', 'stats.0.label']],
    ['linnea', LinneaLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'stats.0.value', 'stats.0.label']],
    ['edit', EditLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'about_image', 'italic', 'aboutCopyHome', 'stats.0.value', 'stats.0.label']],
    ['salvia', SalviaLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'servicesEyebrow', 'servicesTitle', 'about_image', 'italic', 'aboutCopyHome', 'stats.0.value', 'stats.0.label']],
    ['flora', FloraLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'hero_images.1', 'hero_images.2', 'pillar3Title', 'pillar3Body', 'italic', 'servicesEyebrow', 'servicesTitle', 'about_image', 'aboutTitle', 'aboutCopyHome', 'stats.0.value', 'stats.0.label', 'galleryEyebrow', 'findEyebrow', 'closingTitle', 'closingLede']],
    ['ateljevinter', AteljeVinterLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'homeGalleryEyebrow', 'italic', 'pillar1Title', 'pillar1Body', 'pillar2Title', 'pillar2Body', 'pillar3Title', 'pillar3Body']],
    ['eloria', EloriaLayout, ['hero_images.0', 'hero_images.1', 'italic']],
    ['aurora', AuroraLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'italic', 'about_image', 'teamEyebrow', 'aboutTitle', 'aboutCopy', 'closing_image']],
    ['blomstertorget', BlomstertorgetLayout, ['heroEyebrow', 'heroTitle', 'hero_images.0', 'homeGalleryEyebrow', 'findEyebrow', 'heroLede', 'shopCta', 'pillar1Title', 'pillar2Title', 'pillar2Body', 'pillar3Title', 'pillar3Body']],
    ['calytrix', CalytrixLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'tagline', 'gallery_images.0', 'findEyebrow', 'about_image', 'teamEyebrow', 'aboutTitle', 'aboutCopyHome', 'closing_image', 'closingTitle', 'closingLede']],
    ['lunaria', LunariaLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'italic', 'pillar1Title', 'pillar1Body', 'pillar2Title', 'pillar2Body', 'pillar3Title', 'pillar3Body']],
    ['sivsav', SivSavLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'pillar1Title', 'pillar1Body', 'pillar2Title', 'pillar2Body', 'pillar3Title', 'pillar3Body', 'homeGalleryEyebrow', 'aboutTitle', 'aboutCopyHome', 'about_image']],
    ['solsalt', SolSaltLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'utility', 'about_image', 'teamTitle', 'aboutCopyHome']],
    ['onyx', OnyxLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'findEyebrow', 'hero_images.0', 'homeGalleryEyebrow', 'italic', 'pillar1Title', 'pillar1Body', 'pillar2Title', 'pillar2Body', 'pillar3Title', 'pillar3Body', 'closing_image', 'closingTitle', 'closingLede']],
    ['zentum', ZentumLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'italic', 'servicesTitle', 'about_image', 'aboutTitle', 'aboutCopy', 'teamTitle']],
    ['kalla', KallaLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'homeGalleryEyebrow', 'pillar1Title', 'pillar1Body', 'servicesEyebrow', 'servicesTitle', 'aboutTitle', 'aboutCopyHome', 'about_image']],
    ['snitt', SnittLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'hero_images.1', 'hero_images.2', 'servicesEyebrow', 'pillar1Title', 'pillar1Body', 'pillar2Title', 'aboutTitle', 'aboutCopyHome', 'italic', 'findEyebrow', 'pillar3Title', 'location.address', 'opening_hours.0.time']],
    ['siluett', SiluettLayout, ['heroEyebrow', 'heroTitle', 'heroLede', 'hero_images.0', 'pillar1Title', 'pillar1Body', 'pillar2Title', 'pillar3Title', 'servicesEyebrow', 'servicesTitle', 'about_image', 'homeGalleryEyebrow', 'aboutTitle', 'aboutCopyHome', 'italic']],
  ] as const)('%s exposes the customer content it renders to SidaStudio', (theme, Layout, fields) => {
    const html = renderLayout(theme, Layout)
    const kind = theme === 'kalla' || theme === 'snitt' ? theme : 'generic'
    const targets = new Set(
      editorFieldTargets(
        buildSiteEditorManifest(kind, resolveThemeContent(theme, null, null), theme).tabs,
        'hem',
      ).map(({ field }) => field),
    )

    for (const field of fields) {
      expect(html).toContain(`data-corevo-editor-field="${field}"`)
      expect(targets).toContain(field)
    }
  })

  it('keeps Snitt statistics selectable when the owner has configured them', () => {
    const html = renderLayout('snitt', SnittLayout, { stats: [['5.0', 'Google-betyg']] })

    expect(html).toContain('data-corevo-editor-field="stats.0.value"')
    expect(html).toContain('data-corevo-editor-field="stats.0.label"')
  })
})
