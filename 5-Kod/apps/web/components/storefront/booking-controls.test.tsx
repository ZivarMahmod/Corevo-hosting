import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { BookCta } from '@/components/brand/BookCta'
import { Bookable } from './Bookable'
import { BookingProvider } from './BookingProvider'

describe('booking controls fail closed', () => {
  it('renders no booking link when the caller marks booking unreachable', () => {
    const html = renderToStaticMarkup(<BookCta enabled={false} label="Boka" />)
    expect(html).not.toContain('href="/boka"')
    expect(html).toContain('aria-disabled="true"')
  })

  it('removes activation semantics from disabled bookable content', () => {
    const html = renderToStaticMarkup(<Bookable enabled={false}>Tjänst</Bookable>)
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain('role="button"')
    expect(html).not.toContain('tabindex="0"')
  })

  it('keeps paused/live-empty booking reachable but closes off/draft at provider level', () => {
    const paused = renderToStaticMarkup(
      <BookingProvider tenantName="Test" services={[]} reachable>
        <BookCta label="Boka" />
      </BookingProvider>,
    )
    const off = renderToStaticMarkup(
      <BookingProvider tenantName="Test" services={[]} reachable={false}>
        <BookCta label="Boka" />
      </BookingProvider>,
    )

    expect(paused).toContain('href="/boka"')
    expect(off).not.toContain('href="/boka"')
    expect(off).toContain('aria-disabled="true"')
  })

  it('uses one real external booking link when Corevo booking is unreachable', () => {
    const cta = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable={false}
        websiteOnly
        externalUrl="https://www.bokadirekt.se/places/test-123"
      >
        <BookCta enabled={false} label="Boka externt" />
      </BookingProvider>,
    )
    const row = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable={false}
        websiteOnly
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

  it('keeps a saved external URL inert unless booking is explicitly off', () => {
    const cta = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable={false}
        websiteOnly={false}
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
        websiteOnly={false}
        externalUrl="https://www.bokadirekt.se/places/test-123"
      >
        <Bookable enabled={false}>Klippning</Bookable>
      </BookingProvider>,
    )

    for (const html of [cta, row]) {
      expect(html).toContain('aria-disabled="true"')
      expect(html).not.toContain('bokadirekt.se')
      expect(html).not.toContain('href="/boka"')
    }
  })

  it('keeps paused booking inside Corevo even when an external URL is saved', () => {
    const html = renderToStaticMarkup(
      <BookingProvider
        tenantName="Test"
        services={[]}
        reachable
        websiteOnly={false}
        externalUrl="https://www.bokadirekt.se/places/test-123"
      >
        <BookCta label="Boka" />
      </BookingProvider>,
    )

    expect(html).toContain('href="/boka"')
    expect(html).not.toContain('bokadirekt.se')
  })
})
