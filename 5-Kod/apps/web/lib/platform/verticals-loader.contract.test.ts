import { describe, expect, it, vi } from 'vitest'

const rows = {
  verticals: [
    {
      key: 'frisör',
      name: 'Frisör',
      default_template: 'kalla',
      default_modules: {},
      terminology: {},
    },
  ],
  modules: [{ key: 'booking', name: 'Bokning' }],
  templates: [
    {
      key: 'kalla',
      name: 'Källa',
      tags: { bransch: 'frisör' },
      status: 'active',
      selectable: true,
    },
    {
      key: 'salvia',
      name: 'Salvia',
      tags: { bransch: 'frisör' },
      status: 'active',
      selectable: false,
    },
  ],
}

function query<T extends Record<string, unknown>>(source: readonly T[]) {
  const filters: [string, unknown][] = []
  const builder = {
    select: () => builder,
    order: () => builder,
    eq: (field: string, value: unknown) => {
      filters.push([field, value])
      return builder
    },
    then: (resolve: (value: { data: T[] }) => unknown) =>
      resolve({
        data: source.filter((row) => filters.every(([field, value]) => row[field] === value)),
      }),
  }
  return builder
}

const from = vi.fn((table: keyof typeof rows) => query(rows[table]))

vi.mock('./guard', () => ({
  platformCtx: async () => ({ supabase: { from } }),
}))

import { loadVerticalPresets } from './verticals'

describe('Goal 93 onboarding catalog read', () => {
  it('returns only active and explicitly selectable templates', async () => {
    const presets = await loadVerticalPresets()

    expect(presets.templatesByVertical.frisör).toEqual([{ key: 'kalla', name: 'Källa' }])
  })
})
