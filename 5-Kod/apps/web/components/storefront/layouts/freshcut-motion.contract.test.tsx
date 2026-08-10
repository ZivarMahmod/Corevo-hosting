import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { BookingProvider } from '@/components/storefront/BookingProvider'
import type { Service } from '@/lib/tenant-data'
import type { BookingExternalCtaUrls } from '@/lib/platform/booking-external-url'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { FreshCutMotionLayout, FreshCutMotionSceneVisual } from './FreshCutMotionLayout'
import { FRESHCUT_MOTION_SCENES, type FreshCutMotionScene } from './freshcut-motion-scenes'

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

function renderMotiontest(
  externalCtaUrls: BookingExternalCtaUrls = {},
  content = resolveThemeContent('freshcut', null, null),
) {
  return renderToStaticMarkup(
    <BookingProvider
      tenantName="FreshCut"
      services={[]}
      reachable
      provider="external"
      externalUrl={EXTERNAL_URL}
      externalCtaUrls={externalCtaUrls}
    >
      <FreshCutMotionLayout
        tenant={{ id: 'tenant-freshcut', name: 'FreshCut', slug: 'freshcut' }}
        theme="freshcut"
        content={content}
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
      'Klippt. Format. Klart.',
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
    for (const id of [
      'upplevelsen',
      'motion-scene-hero',
      'motion-scene-entrance',
      'motion-scene-chair',
      'motion-scene-craft',
      'motion-scene-range',
      'motion-scene-return',
      'motion-scene-mirror',
      'motion-scene-team',
      'tjanster',
      'salongen',
      'resultat',
      'om',
      'kontakt',
    ]) {
      expect(html).toContain(`id="${id}"`)
    }
    expect(html.match(/<section[^>]+data-motion-scene=/g)).toHaveLength(8)
    expect(html.match(/<[^>]*\sdata-motion-business-panel(?:="[^"]*")?[^>]*>/g)).toHaveLength(1)
    expect(html.match(/<[^>]*\sdata-motion-popular-services(?:="[^"]*")?[^>]*>/g)).toHaveLength(1)
    expect(html.match(/<[^>]*\sdata-motion-salon-selector(?:="[^"]*")?[^>]*>/g)).toHaveLength(1)
    expect(html).not.toContain('data-poster-composition=')
    expect(html).not.toContain('data-motion-layout-variant="mobile"')
    expect(html).not.toContain('href="/boka"')

    for (const [scene, placement] of [
      ['hero', 'left'],
      ['entrance', 'left'],
      ['chair', 'right'],
      ['craft', 'left'],
      ['range', 'left'],
      ['return', 'right'],
      ['mirror', 'right'],
      ['team', 'left'],
    ] as const) {
      expect(html).toMatch(
        new RegExp(
          `<section[^>]+data-motion-scene="${scene}"[^>]+data-motion-copy-placement="${placement}"`,
        ),
      )
    }
  })

  it('makes the first-view booking destination unambiguous for both salons', () => {
    const html = renderMotiontest()
    expect(html).toContain('Boka nu')
    expect(html).toContain('<span>Sankt Larsgatan 17, Linköping — bokningslänk kommer</span>')
    expect(html).not.toMatch(/<a[^>]*>[^<]*Sankt Larsgatan 17[^<]*<\/a>/)
  })

  it('projects every layer once with real responsive lazy picture delivery', () => {
    const html = renderMotiontest()

    expect(html.match(/data-motion-layer-kind="media"/g) ?? []).toHaveLength(8)
    expect(html.match(/data-motion-poster-image=/g) ?? []).toHaveLength(8)
    expect(html.match(/<source/g) ?? []).toHaveLength(16)
    expect(html).not.toContain('<video')

    for (const scene of FRESHCUT_MOTION_SCENES) {
      const section = html.match(
        new RegExp(`<section[^>]+data-motion-scene="${scene.id}"[\\s\\S]*?</section>`),
      )?.[0]
      expect(section).toBeDefined()
      expect(section).toContain(`data-motion-poster-scene="${scene.id}"`)
      expect(section).toContain(`data-motion-poster-owner="${scene.media.posterOwner}"`)
      expect(section).toContain(
        `<source media="(max-width: 1023px)" srcSet="${scene.media.mobilePoster}"/>`,
      )
      expect(section).toContain(
        `<source media="(min-width: 1024px)" srcSet="${scene.media.desktopPoster}"/>`,
      )
      expect(section).toContain(`src="${scene.media.desktopPoster}"`)
      expect(section).toContain(`loading="${scene.id === 'hero' ? 'eager' : 'lazy'}"`)
      expect(section).toContain(`fetchPriority="${scene.id === 'hero' ? 'high' : 'auto'}"`)
      for (const layer of scene.layers as unknown as readonly { token: string }[]) {
        expect(
          section?.match(new RegExp(`data-motion-layer="${layer.token}"`, 'g')) ?? [],
        ).toHaveLength(1)
      }
    }
  })

  it('gives desktop and mobile currentSrc candidates without a second Return fetch target', () => {
    const craft = FRESHCUT_MOTION_SCENES.find((scene) => scene.id === 'craft')!
    const returnScene = FRESHCUT_MOTION_SCENES.find((scene) => scene.id === 'return')!
    const returnHtml = renderToStaticMarkup(<FreshCutMotionSceneVisual scene={returnScene} />)

    expect(returnScene.media.desktopPoster).toBe(craft.media.desktopPoster)
    expect(returnScene.media.mobilePoster).toBe(craft.media.mobilePoster)
    expect(returnHtml).toContain(`media="(max-width: 1023px)" srcSet="${craft.media.mobilePoster}"`)
    expect(returnHtml).toContain(
      `media="(min-width: 1024px)" srcSet="${craft.media.desktopPoster}"`,
    )
  })

  it('emits only the existing media-layer host during SSR even for an approved cloned scene', () => {
    const source = FRESHCUT_MOTION_SCENES.find((candidate) => candidate.id === 'entrance')!
    const family = '/media/freshcut-motion/entrance-v1-a1b2c3d4e5f6'
    const base = `${family}/entrance-v1-a1b2c3d4e5f6`
    const scene = {
      ...source,
      media: {
        ...source.media,
        desktopPoster: `${base}-desktop-poster.webp`,
        mobilePoster: `${base}-mobile-poster.webp`,
        desktopWebm: `${base}-desktop.webm`,
        desktopMp4: `${base}-desktop.mp4`,
        mobileWebm: `${base}-mobile.webm`,
        mobileMp4: `${base}-mobile.mp4`,
        sourceStatus: 'approved-final',
        rightsStatus: 'approved-for-ai-transformation',
      },
    } as FreshCutMotionScene

    const html = renderToStaticMarkup(<FreshCutMotionSceneVisual scene={scene} />)

    expect(html).toContain('data-motion-media-host="entrance"')
    expect(html.match(/data-motion-layer-kind="media"/g) ?? []).toHaveLength(1)
    expect(html).not.toContain('<video')
    expect(html.match(/<source/g) ?? []).toHaveLength(2)
  })

  it('renders authoritative owner content with editor markers and no duplicate About body', () => {
    const content = {
      ...resolveThemeContent('freshcut', null, null),
      heroEyebrow: 'OWNER HERO EYEBROW',
      heroTitle: 'OWNER HERO TITLE',
      heroLede: 'OWNER HERO LEDE',
      servicesEyebrow: 'OWNER SERVICES EYEBROW',
      servicesTitle: 'OWNER SERVICES TITLE',
      servicesIntro: 'OWNER SERVICES INTRO',
      resultsEyebrow: 'OWNER RESULTS EYEBROW',
      homeSecondTitle: 'OWNER RESULTS TITLE',
      resultsLede: 'OWNER RESULTS LEDE',
      studioEyebrow: 'OWNER ABOUT EYEBROW',
      aboutTitle: 'OWNER ABOUT TITLE',
      aboutCopyHome: 'OWNER ABOUT BODY UNIQUE',
      teamEyebrow: 'OWNER TEAM EYEBROW',
      teamTitle: 'OWNER TEAM TITLE',
      teamLead: 'OWNER TEAM LEAD',
      contactEyebrow: 'OWNER CONTACT EYEBROW',
      contactTitle: 'OWNER CONTACT TITLE',
      contactLede: 'OWNER CONTACT LEDE',
    }
    const html = renderMotiontest({}, content)

    const fields = {
      heroEyebrow: content.heroEyebrow,
      heroTitle: content.heroTitle,
      heroLede: content.heroLede,
      servicesEyebrow: content.servicesEyebrow,
      servicesTitle: content.servicesTitle,
      servicesIntro: content.servicesIntro,
      resultsEyebrow: content.resultsEyebrow,
      homeSecondTitle: content.homeSecondTitle,
      resultsLede: content.resultsLede,
      studioEyebrow: content.studioEyebrow,
      aboutTitle: content.aboutTitle,
      aboutCopyHome: content.aboutCopyHome,
      teamEyebrow: content.teamEyebrow,
      teamTitle: content.teamTitle,
      teamLead: content.teamLead,
      contactEyebrow: content.contactEyebrow,
      contactTitle: content.contactTitle,
      contactLede: content.contactLede,
    }

    for (const [field, value] of Object.entries(fields)) {
      expect(html).toContain(`data-corevo-editor-field="${field}"`)
      expect(html).toContain(`data-corevo-editor-stable-field="${field}"`)
      expect(html).toContain(value)
    }
    expect(html.match(/OWNER ABOUT BODY UNIQUE/g)).toHaveLength(1)
    expect(html).not.toContain('Rent snitt. Ingen krångel.')
  })

  it('never presents an unverified Dam label as production data', () => {
    const html = renderMotiontest()

    expect(html).not.toContain('<li>Dam</li>')
    expect(html).toContain('Dam · preliminärt')
  })

  it('uses only registered page booking slots', () => {
    const canonical = {
      hero: 'https://slots.example/hero',
      results: 'https://slots.example/results',
      contact: 'https://slots.example/contact',
      studio: 'https://slots.example/studio',
      nav: 'https://slots.example/nav',
    }
    const forbidden = {
      'journey-craft': 'https://slots.example/forbidden-journey-craft',
      mirror: 'https://slots.example/forbidden-mirror',
      'location-primary': 'https://slots.example/forbidden-location-primary',
      about: 'https://slots.example/forbidden-about',
      'mobile-persistent': 'https://slots.example/forbidden-mobile-persistent',
    }
    const html = renderMotiontest({ ...canonical, ...forbidden })

    for (const url of Object.values(canonical)) expect(html).toContain(`href="${url}"`)
    for (const url of Object.values(forbidden)) expect(html).not.toContain(url)
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

    for (const name of [
      'Damklippning · prototyp',
      'Dam student · prototyp',
      'Dam pensionär · prototyp',
    ]) {
      const row = html.match(new RegExp(`<li data-prototype-service="${name}"[\\s\\S]*?</li>`))?.[0]

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
