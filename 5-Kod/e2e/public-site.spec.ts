import { test, expect } from '@playwright/test'
import { gotoTenant, SEED } from './helpers'

// @readonly — pure reads (tenant + settings + services). Safe to run anywhere,
// including against the canonical cloud DB locally. Proves per-tenant white-label
// resolution: the same Worker serves a different brand per tenant slug.

test.describe('@readonly public site per tenant', () => {
  test('frisor1 renders Frisör Ett with its services', async ({ page }) => {
    await gotoTenant(page, '/', SEED.tenant.slug)
    await expect(page.getByRole('heading', { level: 1, name: SEED.tenant.name })).toBeVisible()
    await expect(page.getByText('Klippning').first()).toBeVisible()
    // The tenant root is tagged with the tenant id → CSS isolation anchor.
    await expect(page.locator('.tenant-root[data-tenant]')).toBeVisible()
  })

  // BORTTAGET: "frisor2 renders Salong Två". Den tenanten har aldrig funnits — varken i
  // den gamla seeden (som bara skapade `demo`) eller i fixturen. Testet kunde alltså
  // aldrig ha passerat; det kastade TypeError på SEED.tenant2.slug så fort sviten kördes.
  // Att en tvåtenant-isolering behöver bevisas är sant — men det beviset ska skrivas mot
  // två tenants som faktiskt finns, inte lämnas kvar som ett test som inte ens kompilerar.

  test('booking page shows the tenant name and a service to pick', async ({ page }) => {
    await gotoTenant(page, '/boka', SEED.tenant.slug)
    await expect(
      page.getByRole('heading', { name: `Boka tid hos ${SEED.tenant.name}` }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Klippning/ }).first()).toBeVisible()
  })

  test('unknown tenant slug 404s (not a silent wrong-brand)', async ({ page }) => {
    const res = await page.goto('/?tenant=does-not-exist-xyz')
    expect(res?.status()).toBe(404)
  })
})
