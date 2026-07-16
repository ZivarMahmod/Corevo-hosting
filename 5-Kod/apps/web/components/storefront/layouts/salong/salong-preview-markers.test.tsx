import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Logo } from '@/components/brand/Logo'
import { KallaFooter } from './kalla.chrome'
import { KallaKontakt } from './kalla.pages'
import { SnittFooter } from './snitt.chrome'
import { SnittKontakt } from './snitt.pages'
import type { ThemeFooterProps, ThemePageProps } from './types'

const tenant = { id: 't1', name: 'Studio Test', slug: 'studio-test' }
const location = {
  id: 'l1',
  name: 'Studion',
  address: 'Storgatan 1',
  hours: [{ day: 'Måndag', time: '09–17' }],
}
const content = {
  contactTitle: 'Kontakt',
  closingLede: 'Välkommen',
  aboutCopy: 'Om oss',
  italic: 'Med omtanke',
}
const contact = { email: null, phone: null }

const footerProps = {
  tenant,
  tagline: 'Tagline',
  location,
  contact,
  social: { instagram: null, facebook: null, tiktok: null },
  links: [],
} as unknown as ThemeFooterProps

const pageProps = {
  tenant,
  content,
  services: [],
  location,
  contact,
} as unknown as ThemePageProps

describe('Källa/Snitt editor preview markers', () => {
  it('keeps company-name markers on every visible chrome wordmark', () => {
    const html = [
      renderToStaticMarkup(<Logo tenant={tenant} branding={{}} />),
      renderToStaticMarkup(<KallaFooter {...footerProps} />),
      renderToStaticMarkup(<SnittFooter {...footerProps} />),
    ].join('')

    expect(html).toContain('data-tenant-name="true"')
    expect(html.match(/data-corevo-editor-stable-field="tenant.name"/g)?.length).toBeGreaterThanOrEqual(5)
  })

  it('keeps footer tagline and first-social targets stable before values exist', () => {
    for (const Component of [KallaFooter, SnittFooter]) {
      const html = renderToStaticMarkup(<Component {...footerProps} />)
      expect(html).toContain('data-corevo-editor-stable-field="tagline"')
      expect(html).toContain('data-corevo-social-group="true"')
      for (const provider of ['instagram', 'facebook', 'tiktok']) {
        expect(html).toContain(`data-corevo-editor-stable-field="social.${provider}"`)
      }
    }
  })

  it('marks address and each time separately without changing their visible text', () => {
    for (const Component of [KallaKontakt, SnittKontakt]) {
      const html = renderToStaticMarkup(<Component {...pageProps} />)
      expect(html).toContain('data-corevo-editor-stable-field="location.address"')
      expect(html).toContain('data-corevo-editor-stable-field="opening_hours.0.time"')
      expect(html).toContain('Måndag')
      expect(html).toContain('09–17')
    }
  })

  it('keeps a hidden address target when the first address has not been published yet', () => {
    const emptyPage = {
      ...pageProps,
      location: { ...location, address: null },
    } as unknown as ThemePageProps
    const emptyFooter = {
      ...footerProps,
      location: { ...location, address: null },
    } as unknown as ThemeFooterProps

    for (const html of [
      renderToStaticMarkup(<KallaKontakt {...emptyPage} />),
      renderToStaticMarkup(<SnittKontakt {...emptyPage} />),
      renderToStaticMarkup(<SnittFooter {...emptyFooter} />),
    ]) {
      expect(html).toContain('data-corevo-fact-group="location.address"')
      expect(html).toContain('data-corevo-editor-stable-field="location.address"')
    }

    for (const Component of [KallaKontakt, SnittKontakt]) {
      const html = renderToStaticMarkup(<Component {...emptyPage} />)
      expect(html).toContain('data-corevo-contact-group="true"')
      expect(html).toContain('data-corevo-editor-stable-field="contact.email"')
      expect(html).toContain('data-corevo-editor-stable-field="contact.phone"')
    }

    const noHoursPage = {
      ...emptyPage,
      location: { ...location, address: null, hours: null },
    } as unknown as ThemePageProps
    for (const Component of [KallaKontakt, SnittKontakt]) {
      const html = renderToStaticMarkup(<Component {...noHoursPage} />)
      expect(html).toContain('data-corevo-opening-group="true"')
      expect(html).toContain('data-corevo-editor-stable-field="opening_hours.0.time"')
      expect(html).toContain('data-corevo-editor-stable-field="opening_hours.6.time"')
    }
  })
})
