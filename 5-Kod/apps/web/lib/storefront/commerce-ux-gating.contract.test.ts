import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('commerce and loyalty UX gating', () => {
  it('requires the live shop rail before showing gift-card or event checkout actions', () => {
    const sections = read('../../components/storefront/StorefrontModuleSections.tsx')
    const gift = read('../../components/storefront/PresentkortSection.tsx')
    const events = read('../../components/storefront/kurser/KurserSection.tsx')

    expect(sections).toContain("const checkoutLive = shopLive && commerceReleaseGate(tenantId).shop")
    expect(gift).toContain('!paused && checkoutLive && config.amountPresets.length > 0')
    expect(events).toContain("config.payment === 'checkout' && checkoutLive")

    const coursePage = read('../../app/(public)/kurser/page.tsx')
    const giftPage = read('../../app/(public)/presentkort/page.tsx')
    expect(coursePage).toContain('paused={köpIKassan && !checkoutLive}')
    expect(giftPage).toContain('paused={!checkoutLive}')
  })

  it('renders live loyalty and makes the homepage CTA a real route', () => {
    const publicPage = read('../../app/(public)/klubb/page.tsx')
    const previewPage = read('../../app/salong-preview/[slug]/klubb/page.tsx')
    const section = read('../../components/storefront/LojalitetSection.tsx')

    expect(publicPage).toContain('if (View)')
    expect(previewPage).toContain('else if (View)')
    expect(section).toContain('<Link href="/klubb"')
  })

  it('uses native checkout validation without touching the payment hook', () => {
    const checkout = read('../../app/butik/kassa/CheckoutForm.tsx')

    expect(checkout).toContain('<form onSubmit={onSubmit} className={s.form}>')
    expect(checkout).not.toContain('className={s.form} noValidate')
    expect(checkout).toMatch(/type="checkbox"\s+required/)
    expect(checkout).toContain('placeOrder({')
  })
})
