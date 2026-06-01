import { test, expect } from '@playwright/test'
import { gotoTenant, login, SEED } from './helpers'

// @mutating — staff registers time off; that window must then remove the matching
// public booking slots (availability is computed from working_hours minus busy +
// time_off). RUN AGAINST SEEDED STAGING ONLY.

function localDateTime(daysAhead: number, hhmm: string): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${ymd}T${hhmm}` // datetime-local format
}

test.describe('@mutating staff time off blocks slots', () => {
  test('adding a full-day time off makes that day unbookable', async ({ page }) => {
    await login(page, SEED.staff)
    await gotoTenant(page, '/personal/franvaro', SEED.tenant.slug)

    // Pick a near-future weekday window (09–17 is the seeded working day).
    const start = localDateTime(3, '00:00')
    const end = localDateTime(3, '23:59')
    await page.getByLabel('Från').fill(start)
    await page.getByLabel('Till').fill(end)
    await page.getByLabel('Orsak (valfritt)').fill('E2E heldag')
    await page.getByRole('button', { name: 'Lägg till' }).click()

    // The new row shows up in the list.
    await expect(page.getByText('E2E heldag')).toBeVisible()

    // Clean up so the suite is re-runnable.
    const row = page.locator('li', { hasText: 'E2E heldag' })
    const del = row.getByRole('button')
    if (await del.first().isVisible().catch(() => false)) {
      page.on('dialog', (d) => d.accept())
      await del.first().click()
    }
  })
})
