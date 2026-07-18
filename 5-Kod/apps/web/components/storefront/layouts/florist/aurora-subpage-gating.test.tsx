import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { resolveThemeContent } from '../../theme-content'
import { AuroraTjanster } from './aurora.pages'
import type { ThemePageProps } from './types'

function render(offertReachable: boolean) {
  const props = {
    tenant: { id: 'tenant-1', name: 'Aurora', slug: 'aurora' },
    content: resolveThemeContent('aurora', null, null),
    services: [],
    location: null,
    contact: { email: null, phone: null },
    modules: { offertReachable, bookingReachable: false },
  } as unknown as ThemePageProps
  return renderToStaticMarkup(<AuroraTjanster {...props} />)
}

describe('Aurora services subpage module links', () => {
  it('keeps the private-event copy but removes the quote link when offert is unreachable', () => {
    const html = render(false)
    expect(html).toContain('Privat grupp eller möhippa?')
    expect(html).not.toContain('href="/offert"')
  })

  it('links to the quote route when offert is reachable', () => {
    expect(render(true)).toContain('href="/offert"')
  })
})
