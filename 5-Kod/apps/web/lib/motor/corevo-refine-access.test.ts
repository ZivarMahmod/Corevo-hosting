import { describe, expect, it } from 'vitest'
import { canUseCorevoResource, type CorevoServiceCapabilities } from './corevo-refine-access'

const capabilities: CorevoServiceCapabilities = {
  list: true,
  create: true,
  edit: false,
  delete: false,
}

describe('Corevo Refine resource access', () => {
  it('uses the server-approved action snapshot for services', () => {
    expect(canUseCorevoResource('services', 'list', capabilities)).toBe(true)
    expect(canUseCorevoResource('services', 'create', capabilities)).toBe(true)
    expect(canUseCorevoResource('services', 'edit', capabilities)).toBe(false)
    expect(canUseCorevoResource('services', 'delete', capabilities)).toBe(false)
  })

  it('fails closed for unknown resources and actions', () => {
    expect(canUseCorevoResource('staff', 'list', capabilities)).toBe(false)
    expect(canUseCorevoResource('services', 'export', capabilities)).toBe(false)
    expect(canUseCorevoResource(undefined, 'list', capabilities)).toBe(false)
  })
})
