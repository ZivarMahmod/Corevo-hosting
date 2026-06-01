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

  test('frisor2 renders Salong Två with its own services', async ({ page }) => {
    await gotoTenant(page, '/', SEED.tenant2.slug)
    await expect(page.getByRole('heading', { level: 1, name: SEED.tenant2.name })).toBeVisible()
    await expect(page.getByText('Färgning').first()).toBeVisible()
  })

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
