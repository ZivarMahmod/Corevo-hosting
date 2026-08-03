import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { BookCta } from '@/components/brand/BookCta'
import { Bookable } from './Bookable'
import { BookingProvider } from './BookingProvider'
import { InlineBooking } from './InlineBooking'

describe('booking controls fail closed', () => {
  it('renders no booking link when the caller marks booking unreachable', () => {
    const html = renderToStaticMarkup(<BookCta enabled={false} label="Boka" />)
    expect(html).toBe('')
  })

  it('removes activation semantics from disabled bookable content', () => {
    const html = renderToStaticMarkup(<Bookable enabled={false}>Tjänst</Bookable>)
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain('role="button"')
    expect(html).not.toContain('tabindex="0"')
  })

  it('keeps live-empty booking reachable but hides booking when the module is off', () => {
    const live = renderToStaticMarkup(
      <BookingProvider tenantName="Test" services={[]} reachable>
        <BookCta label="Boka" />
      </BookingProvider>,
    )
    const off = renderToStaticMarkup(
      <BookingProvider tenantName="Test" services={[]} reachable={false}>
        <BookCta label="Boka" />
      </BookingProvider>,
    )

    expect(live).toContain('href="/boka"')
    expect(off).toBe('')
  })

  it('uses one real external booking link when the module is on with external provider', () => {
    const cta = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable
        provider="external"
        externalUrl="https://www.bokadirekt.se/places/test-123"
      >
        <BookCta enabled={false} label="Boka externt" />
      </BookingProvider>,
    )
    const row = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable
        provider="external"
        externalUrl="https://www.bokadirekt.se/places/test-123"
      >
        <Bookable enabled={false} label="Boka klippning">Klippning</Bookable>
      </BookingProvider>,
    )

    for (const html of [cta, row]) {
      expect(html).toContain('href="https://www.bokadirekt.se/places/test-123"')
      expect(html).toContain('target="_blank"')
      expect(html).toContain('rel="noopener noreferrer"')
      expect(html).not.toContain('aria-disabled="true"')
      expect(html).not.toContain('href="/boka"')
    }
  })

  it('uses a button override first and the global external URL as fallback', () => {
    const html = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable
        provider="external"
        externalUrl="https://example.com/default"
        externalCtaUrls={{ hero: 'https://example.com/hero' }}
      >
        <BookCta enabled={false} slotId="hero" label="Hero" />
        <Bookable enabled={false} slotId="service:missing">Tjänst</Bookable>
      </BookingProvider>,
    )

    expect(html).toContain('href="https://example.com/hero"')
    expect(html).toContain('href="https://example.com/default"')
  })

  it('keeps a saved external URL inert for the Corevo provider', () => {
    const cta = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable={false}
        provider="corevo"
        externalUrl="https://www.bokadirekt.se/places/test-123"
      >
        <BookCta enabled={false} label="Boka" />
      </BookingProvider>,
    )
    const row = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable={false}
        provider="corevo"
        externalUrl="https://www.bokadirekt.se/places/test-123"
      >
        <Bookable enabled={false}>Klippning</Bookable>
      </BookingProvider>,
    )

    expect(cta).toBe('')
    expect(row).toContain('aria-disabled="true"')
    expect(row).not.toContain('bokadirekt.se')
    expect(row).not.toContain('href="/boka"')
  })

  it('keeps Corevo booking inside Corevo even when an external URL is saved', () => {
    const html = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable
        provider="corevo"
        externalUrl="https://www.bokadirekt.se/places/test-123"
      >
        <BookCta label="Boka" />
      </BookingProvider>,
    )

    expect(html).toContain('href="/boka"')
    expect(html).not.toContain('bokadirekt.se')
  })

  it('renders no external booking link when the module is off', () => {
    const html = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable={false}
        provider="external"
        externalUrl="https://example.com/external"
      >
        <BookCta label="Boka" />
      </BookingProvider>,
    )

    expect(html).toBe('')
  })

  it('never renders the Corevo inline engine for an external provider', () => {
    const html = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable
        provider="external"
        externalUrl="https://example.com/external"
      >
        <InlineBooking services={[]} tenantName="Test" />
      </BookingProvider>,
    )

    expect(html).toBe('')
  })
})
