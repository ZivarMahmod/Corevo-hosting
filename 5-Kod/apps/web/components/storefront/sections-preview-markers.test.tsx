import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tenantState = vi.hoisted(() => ({
  contact: { email: null as string | null, phone: null as string | null },
}))

vi.mock('@/lib/tenant-data', () => ({
  currentTenant: vi.fn(async () => ({
    location: { address: null, hours: null },
    settings: {
      contact: tenantState.contact,
      social: { instagram: null, facebook: null, tiktok: null },
      map: null,
    },
  })),
}))

import { LocationHours } from './sections'

describe('generic storefront preview markers', () => {
  beforeEach(() => {
    tenantState.contact = { email: null, phone: null }
  })

  it('keeps stable empty address, contact and seven-day opening targets', async () => {
    const html = renderToStaticMarkup(await LocationHours({ salonName: 'Studio Test' }))

    expect(html).toContain('data-corevo-fact-group="location.address"')
    expect(html).toContain('data-corevo-editor-stable-field="location.address"')
    expect(html).toContain('data-corevo-address-placeholder="true"')
    expect(html).toContain('data-corevo-contact-group="true"')
    expect(html).toContain('data-corevo-contact-phone-row="true"')
    expect(html).toContain('data-corevo-contact-email-row="true"')
    expect(html).toContain('data-corevo-editor-stable-field="contact.email"')
    expect(html).toContain('data-corevo-editor-stable-field="contact.phone"')
    expect(html).toContain('data-corevo-opening-group="true"')
    expect(html).toContain('data-corevo-opening-placeholder="true"')
    expect(html.match(/data-corevo-opening-row="\d"/g)).toHaveLength(7)
    expect(html).toContain('data-corevo-editor-stable-field="opening_hours.0.time"')
    expect(html).toContain('data-corevo-editor-stable-field="opening_hours.6.time"')
    expect(html).toContain('data-corevo-map-link="true"')
    expect(html).toContain('data-corevo-map-link-group="true"')
    expect(html).toContain('data-corevo-map-group="true"')
    expect(html).toContain('data-corevo-map-embed="true"')
  })

  it.each([
    {
      name: 'email-only',
      contact: { email: 'hej@example.se', phone: null },
      visible: 'data-corevo-contact-email-row="true"><a href="mailto:hej@example.se"',
      hidden: 'data-corevo-contact-phone-row="true" hidden=""',
    },
    {
      name: 'phone-only',
      contact: { email: null, phone: '070 123 45 67' },
      visible: 'data-corevo-contact-phone-row="true"><a href="tel:0701234567"',
      hidden: 'data-corevo-contact-email-row="true" hidden=""',
    },
  ])('keeps the old visible contact row shape for $name data', async ({ contact, visible, hidden }) => {
    tenantState.contact = contact
    const html = renderToStaticMarkup(await LocationHours({ salonName: 'Studio Test' }))

    expect(html).toContain(visible)
    expect(html).toContain(hidden)
  })
})
