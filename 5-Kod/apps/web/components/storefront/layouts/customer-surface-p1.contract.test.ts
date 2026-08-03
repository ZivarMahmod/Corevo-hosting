import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(import.meta.dirname, '../../..')
const read = (path: string) => readFileSync(resolve(webRoot, path), 'utf8')

describe('customer surface P1 contracts', () => {
  it('keeps the open mobile menu above the fixed FreshCut booking action', () => {
    const freshcut = read('components/storefront/layouts/freshcut.module.css')
    const navigation = read('components/brand/nav-shell.module.css')

    expect(freshcut).toMatch(/\.mobileBooking\s*\{[\s\S]*?z-index:\s*50;/)
    expect(navigation).toMatch(/\.overlay\s*\{[\s\S]*?z-index:\s*60;/)
  })

  it('returns empty checkout and order confirmation actions to the shop', () => {
    const checkout = read('app/butik/kassa/CheckoutForm.tsx')
    const confirmation = read('app/butik/bekraftelse/[id]/OrderConfirmation.tsx')

    expect(checkout).toMatch(/href="\/shop"[\s\S]{0,120}Tillbaka till butiken/)
    expect(confirmation.match(/href="\/shop"/g)).toHaveLength(2)
  })

  it('keeps the privacy compatibility route inside the customer portal', () => {
    const privacy = read('app/(customer-portal)/mina/integritet/page.tsx')

    expect(privacy).toContain("redirect('/mina/profil')")
  })
})
