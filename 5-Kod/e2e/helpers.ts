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

/** Wizardens "gå vidare"-knapp. Varje steg kräver ETT tryck — det finns ingen
 *  auto-avancering. Testet trodde tidigare att ett val räckte och fastnade på steg 1. */
export async function wizardNext(page: Page) {
  await page.locator('.wizard-cta').click()
}

/** Cookie-bannern ligger ÖVER wizardens knappar och åt alla klick i botten av vyn.
 *  Den är inte en bugg — den ska ligga där — men den måste bort innan man kan boka,
 *  precis som för en riktig kund. Idempotent: gör inget om banner saknas. */
export async function acceptCookies(page: Page) {
  const btn = page.getByRole('button', { name: 'Acceptera alla' })
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) await btn.click()
}

/**
 * Välj första bokbara dag + tid i bokningswizardens steg 3.
 *
 * Dagväljaren är en MÅNADSKALENDER (.fc-cal-cell), inte längre en 14-dagars remsa av
 * .wizard-day — den ändringen är vad som gjorde att testet inte hittade någon dag alls.
 * En dag med lediga tider har en prick (.fc-cal-dot); en dag utan är `disabled`.
 * Vi klickar bokbara dagar i tur och ordning tills tider dyker upp.
 */
export async function pickFirstAvailableSlot(page: Page) {
  await acceptCookies(page)
  const days = page.locator('.fc-cal-cell:not([disabled])')
  await days.first().waitFor({ state: 'visible', timeout: 10_000 })
  const count = await days.count()
  for (let i = 0; i < count; i++) {
    await days.nth(i).click()
    const time = page.locator('.wizard-time').first()
    // Antingen renderas tider, eller så kommer "inga lediga tider"-beskedet — kappla dem.
    await Promise.race([
      time.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {}),
      page.getByText('Inga lediga tider').waitFor({ state: 'visible', timeout: 4000 }).catch(() => {}),
    ])
    if (await time.isVisible().catch(() => false)) {
      await time.click()
      return
    }
  }
  throw new Error('Ingen bokbar dag i månadskalendern för den seedade fixturen.')
}
