import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/platform/actions', () => ({
  saveTenantStorefrontCopy: async () => ({ success: 'Sparat' }),
}))

import { CopyFieldsCard } from './CopyFieldsCard'

const fields = [
  { name: 'heroTitle', label: 'Hero-rubrik' },
  { name: 'oldTemplateRow', label: 'Gammal mallrad' },
]

function render(visibleFields: ReadonlySet<string> | null) {
  return renderToStaticMarkup(
    <CopyFieldsCard
      tenantId="tenant-1"
      fields={fields}
      overrides={{}}
      defaults={{ heroTitle: 'Verklig rubrik', oldTemplateRow: 'Finns inte' }}
      visibleFields={visibleFields}
      onFlashField={() => {}}
    />,
  )
}

describe('CopyFieldsCard storefront discovery', () => {
  it('renders only fields confirmed by the actual storefront DOM', () => {
    const html = render(new Set(['heroTitle']))
    expect(html).toContain('Hero-rubrik')
    expect(html).toContain('Verklig rubrik')
    expect(html).not.toContain('Gammal mallrad')
    expect(html.match(/Visa var/g)).toHaveLength(1)
  })

  it('never renders dead controls when the selected template exposes no matching field', () => {
    const html = render(new Set())
    expect(html).toContain('inga redigerbara texter')
    expect(html).not.toContain('Visa var')
    expect(html).not.toContain('Gammal mallrad')
  })

  it('shows an honest scan state instead of temporarily exposing every old field', () => {
    const html = render(null)
    expect(html).toContain('Läser av den valda mallens verkliga innehåll')
    expect(html).not.toContain('Visa var')
  })
})
