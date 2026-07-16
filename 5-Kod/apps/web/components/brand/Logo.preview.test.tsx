import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Logo } from './Logo'

const tenant = { id: 'tenant-1', name: 'Corevo Kund', slug: 'corevo-kund' }

describe('Logo preview structure', () => {
  it('keeps a stable image/text pair while preserving the visible fallback', () => {
    const withoutLogo = renderToStaticMarkup(<Logo tenant={tenant} branding={{}} />)
    expect(withoutLogo).toContain('data-corevo-logo-image="true"')
    expect(withoutLogo.match(/<img[^>]*data-corevo-logo-image="true"[^>]*>/)?.[0]).toContain('hidden=""')
    expect(withoutLogo).toContain('data-corevo-logo-text="true"')

    const withLogo = renderToStaticMarkup(<Logo tenant={tenant} branding={{ logo_url: '/logo.svg' }} />)
    expect(withLogo.match(/<img[^>]*data-corevo-logo-image="true"[^>]*>/)?.[0]).toContain('src="/logo.svg"')
    expect(withLogo.match(/<span[^>]*data-corevo-logo-text="true"[^>]*>/)?.[0]).toContain('hidden=""')
  })
})
