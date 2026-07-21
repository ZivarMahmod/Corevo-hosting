import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(web, relative), 'utf8')

describe('pilot commerce release fence', () => {
  it('gates every public commerce entry route before module-state rendering', () => {
    for (const route of [
      'app/(public)/shop/page.tsx',
      'app/(public)/presentkort/page.tsx',
      'app/(public)/kassa/page.tsx',
      'app/(public)/varukorg/page.tsx',
    ]) {
      expect(read(route), route).toContain('commerceReleaseGate(tenant.id)')
    }
  })

  it('does not emit shop or gift-card teaser links while commerce is unreleased', () => {
    const source = read('components/storefront/layouts/load-module-teasers.ts')
    expect(source).toContain('const commerceRelease = commerceReleaseGate(tenantId)')
    expect(source).toContain("commerceRelease.shop && reachableState('shop')")
    expect(source).toContain("commerceRelease.presentkort && reachableState('presentkort')")
  })

  it('fails closed inside commerce data loaders as a defense against preview/direct callers', () => {
    expect(read('lib/storefront/shop/load-shop.ts')).toContain('commerceReleaseGate(tenantId).shop')
    expect(read('lib/storefront/presentkort/load-presentkort.ts')).toContain(
      'commerceReleaseGate(tenantId).presentkort',
    )
  })

  it('guards all public shop mutations and reads, with a stricter PayPal gate', () => {
    const source = read('app/butik/actions.ts')
    expect(source.match(/requireReleasedShopContext\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(6)
    expect(source).toContain('commerceReleaseGate(ctx.tenantId).paypal')
    expect(source).toContain('paypalReady: commerceReleaseGate(tenantId).paypal && paypalReady()')
    const options = read('lib/storefront/shop/checkout-options.ts')
    expect(options).toContain('const release = commerceReleaseGate(tenantId)')
    expect(options).toContain('paypalReady: release.paypal && paypalReady()')
    const adminAction = read('lib/admin/shop/actions.ts')
    expect(adminAction).toContain("import { paypalReady } from '@/lib/payments/paypal'")
    expect(adminAction).toContain('commerceReleaseGate(ctx.tenant.id).paypal && paypalReady()')
    expect(adminAction).toContain("methods.includes('paypal') && !paypalAvailable")
    const adminUi = read('components/admin/ShopAdmin.tsx')
    expect(adminUi).toContain("SHOP_PAYMENT_METHODS.filter((method) => method.id !== 'paypal' || paypalReady)")
  })

  it('guards both booking-payment decision and checkout execution', () => {
    const source = read('app/boka/actions.ts')
    expect(source).toContain('commerceReleaseGate(ctx.tenantId).bookingPayment')
    expect(source).toContain('if (!commerceReleaseGate(ctx.tenantId).bookingPayment)')
    const confirmation = read('app/boka/bekraftelse/[id]/page.tsx')
    expect(confirmation).toContain('commerceReleaseGate(bundle.tenant.id).bookingPayment')
    expect(read('lib/admin/stripe.ts')).toContain(
      'enabled && !commerceReleaseGate(tenant.id).bookingPayment',
    )
    expect(read('components/admin/StripeConnectCard.tsx')).toContain('releaseEnabled')
    expect(read('app/(admin)/admin/installningar/betalning/page.tsx')).toContain(
      'releaseEnabled={commerceReleaseGate(tenant.id).bookingPayment}',
    )
    expect(read('app/(admin)/admin/installningar/page.tsx')).toContain(
      "commerceReleaseGate(tenant.id).bookingPayment",
    )
    expect(read('app/(platform)/kunder/(board)/[id]/page.tsx')).toContain(
      'releaseEnabled={commerceReleaseGate(tenant.id).bookingPayment}',
    )
    expect(source).toContain('p_online_payment_released: commerceReleaseGate(ctx.tenantId).bookingPayment')
    const migration = fs.readFileSync(
      path.resolve(web, '..', '..', 'supabase', 'migrations', '0103_storefront_booking_release_truth.sql'),
      'utf8',
    )
    const pinMigration = fs.readFileSync(
      path.resolve(
        web,
        '..',
        '..',
        'supabase',
        'migrations',
        '20260721111357_pin_booking_verification.sql',
      ),
      'utf8',
    )
    expect(migration).toContain('p_online_payment_released boolean default false')
    expect(migration).toContain('new.requires_online_payment := v_online_payment_released and v_online_pay')
    expect(migration).toContain('v_require_approval or new.requires_online_payment')
    expect(migration).toContain('requires_online_payment boolean not null default false')
    expect(migration).toContain('returns table (booking_id uuid, requires_payment boolean, booking_status text)')
    expect(source).toContain('requiresPayment: Boolean(row.requires_payment)')
    expect(source).toContain("row.booking_status === 'confirmed'")
    expect(pinMigration).toContain("then 'booking_confirmation' else 'booking_request_received' end")
    expect(source).not.toContain('getPaymentGate')
  })

  it('sends a real confirmation only after a pending booking is approved', () => {
    const admin = read('lib/admin/actions.ts')
    expect(admin).toContain("else if (changed && status === 'confirmed')")
    expect(admin).toMatch(/status === 'confirmed'[\s\S]*?type: 'booking_confirmation'/)
  })

  it('hides commerce navigation and CTAs in authenticated preview when unreleased', () => {
    const source = read('app/salong-preview/[slug]/preview-shell.tsx')
    expect(source).toContain('const commerceRelease = commerceReleaseGate(tenant.id)')
    expect(source).toContain("commerceRelease.shop && (shopState === 'live' || shopState === 'paused')")
    expect(source).toContain("commerceRelease.presentkort &&")
    expect(source).toContain("ctaModule === 'shop' && !commerceRelease.shop")
    expect(source).toContain("ctaModule === 'presentkort' && !commerceRelease.presentkort")
  })

  it('shows an operator-facing release notice instead of loading commerce admin data', () => {
    for (const route of [
      'app/(admin)/admin/webshop/page.tsx',
      'app/(admin)/admin/presentkort/page.tsx',
    ]) {
      const source = read(route)
      expect(source, route).toContain('commerceReleaseGate(tenant.id)')
      expect(source, route).toContain('inte frisläppt för pilotdrift')
    }
    expect(read('lib/admin/shop/actions.ts')).toContain('commerceReleaseGate(ctx.tenant.id).shop')
    expect(read('lib/admin/presentkort/actions.ts')).toContain(
      'commerceReleaseGate(tenant.id).presentkort',
    )
  })
})
