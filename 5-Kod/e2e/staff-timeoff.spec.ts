import { test, expect } from '@playwright/test'
import { loginBackoffice, BOOKING_HOST, SEED } from './helpers'

// @mutating — staff (back-office on booking.<root>, G12) registers time off; that
// window then removes the matching public booking slots. RUN AGAINST SEEDED
// STAGING ONLY.

function localDateTime(daysAhead: number, hhmm: string): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${ymd}T${hhmm}` // datetime-local format
}

test.describe('@mutating staff time off', () => {
  test('staff adds a full-day time off from their schedule', async ({ page }) => {
    await loginBackoffice(page, SEED.staff)
    await page.goto(`${BOOKING_HOST}/personal/franvaro`)

    await page.getByLabel('Från').fill(localDateTime(3, '00:00'))
    await page.getByLabel('Till').fill(localDateTime(3, '23:59'))
    await page.getByLabel('Orsak (valfritt)').fill('E2E heldag')
    await page.getByRole('button', { name: 'Lägg till' }).click()

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
