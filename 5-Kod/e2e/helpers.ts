import { expect, type Page } from '@playwright/test'

// Fixtur-identiteter. Motsvarigheten i DB är supabase/seeds/e2e-seed.sql, som läggs
// upp och rivs av apps/web/scripts/e2e-db.mjs (seed → kör → teardown → verify).
//
// LÖSENORDET ÄR ALDRIG HÅRDKODAT. Fixturen innehåller en super_admin, och sviten kör
// mot produktionsdatabasen (Zivars beslut 2026-07-14 — inga slutkunder, Free-planen
// saknar branching). Ett känt lösenord på ett super_admin-konto i prod vore
// oförsvarligt, även i tio minuter. `e2e-db.mjs seed` slumpar ett engångslösenord och
// skickar det vidare via E2E_PASSWORD. Saknas variabeln finns ingen fixtur att logga
// in på — då ska sviten falla direkt, inte gissa.
const password = process.env.E2E_PASSWORD
if (!password) {
  throw new Error(
    'E2E_PASSWORD saknas. Kör `node apps/web/scripts/e2e-db.mjs seed` och exportera värdet den skriver ut.',
  )
}

export const SEED = {
  tenant: { slug: 'frisor1', name: 'Frisör Ett' },
  password,
  salonAdmin: 'admin@frisor1.se',
  staff: 'klippare@frisor1.se',
  // e2e-platform, INTE platform@corevo.se: en super_admin med ett engångslösenord får
  // aldrig kunna förväxlas med ett riktigt plattformskonto.
  platformAdmin: 'e2e-platform@corevo.se',
} as const

// G12 two-zone hosts. `*.localhost` is loopback in Chromium → no DNS needed.
// booking.localhost = platform host (back-office); the storefront uses the
// ?tenant= dev override on the default host.
export const BOOKING_HOST = process.env.E2E_BOOKING_HOST ?? 'http://booking.localhost:3000'

/** Enter the storefront as a given tenant via the ?tenant= dev override (cookie-persisted). */
export async function gotoTenant(page: Page, path: string, slug = SEED.tenant.slug) {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}tenant=${slug}`)
}

async function submitLogin(page: Page, email: string) {
  await page.getByLabel('E-post').fill(email)
  await page.getByLabel('Lösenord').fill(SEED.password)
  await page.getByRole('button', { name: 'Logga in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/**
 * G12 back-office login on the PLATFORM host (booking.<root>). super_admin /
 * salon_admin / staff all sign in here; role decides the landing route.
 */
export async function loginBackoffice(page: Page, email: string) {
  await page.goto(`${BOOKING_HOST}/login`)
  await submitLogin(page, email)
}

/**
 * Storefront CUSTOMER login on the tenant host (via ?tenant=). Only meaningful
 * when the tenant has customer accounts enabled (seed: frisor1 = on).
 */
export async function loginCustomer(page: Page, email: string, slug = SEED.tenant.slug) {
  await gotoTenant(page, '/login', slug)
  await submitLogin(page, email)
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
