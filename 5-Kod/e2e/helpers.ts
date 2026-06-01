import { expect, type Page } from '@playwright/test'

// Seed identities (supabase/seed.sql). These exist ONLY on a seeded staging DB —
// the @mutating specs that log in must run against staging, never prod.
export const SEED = {
  tenant: { slug: 'frisor1', name: 'Frisör Ett' },
  tenant2: { slug: 'frisor2', name: 'Salong Två' },
  password: 'Demo!1234',
  salonAdmin: 'admin@frisor1.se',
  staff: 'klippare@frisor1.se',
  platformAdmin: 'platform@corevo.se',
} as const

/** Enter the app as a given tenant via the ?tenant= dev override (cookie-persisted). */
export async function gotoTenant(page: Page, path: string, slug = SEED.tenant.slug) {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}tenant=${slug}`)
}

/**
 * Log in through the real login form. `tenant` keeps the ?tenant= override alive
 * across the auth redirect (the form forwards it; middleware persists the cookie).
 */
export async function login(page: Page, email: string, slug = SEED.tenant.slug) {
  await gotoTenant(page, '/login', slug)
  await page.getByLabel('E-post').fill(email)
  await page.getByLabel('Lösenord').fill(SEED.password)
  await page.getByRole('button', { name: 'Logga in' }).click()
  // Land on a portal home (away from /login) once the session cookie is set.
  await expect(page).not.toHaveURL(/\/login/)
}

/**
 * Walk the public booking wizard up to the time grid and click the first day that
 * has any free slot (weekends have none — working_hours is Mon–Fri). Returns once
 * a time button is selectable. Throws if no day in the 14-day window is bookable.
 */
export async function pickFirstAvailableSlot(page: Page) {
  const days = page.locator('.wizard-day')
  const count = await days.count()
  for (let i = 0; i < count; i++) {
    await days.nth(i).click()
    const time = page.locator('.wizard-time').first()
    // Either times render, or the "no slots" notice appears — race them.
    await Promise.race([
      time.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {}),
      page.getByText('Inga lediga tider').waitFor({ state: 'visible', timeout: 4000 }).catch(() => {}),
    ])
    if (await time.isVisible().catch(() => false)) {
      await time.click()
      return
    }
  }
  throw new Error('No available slot in the 14-day window for the seeded tenant.')
}
