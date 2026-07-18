import { test, expect } from '@playwright/test'
import { SEED } from './helpers'

// G12 — two-zone login model. Back-office logs in on the PLATFORM host
// (booking.<root>); the storefront lives on the TENANT host (frisorN.<root>).
// `*.localhost` is loopback in Chromium, so no DNS is needed: booking.localhost
// resolves the platform host, frisor1.localhost resolves the tenant host.
//
// Auth only — no business-data writes. Kept to ONE login per test (the login
// path is IP-rate-limited at 8/5min, so redundant re-logins would trip it).

const BOOKING = 'http://booking.localhost:3000'
const STORE = 'http://frisor1.localhost:3000'

async function loginAt(page: import('@playwright/test').Page, base: string, email: string) {
  await page.goto(`${base}/login`)
  await page.getByLabel('E-post').fill(email)
  await page.getByLabel('Lösenord').fill(SEED.password)
  await page.getByRole('button', { name: 'Logga in' }).click()
  // Wait for the post-login redirect to land (session cookie set) before any
  // further navigation — otherwise a follow-up page.goto races the auth gate.
  await expect(page).not.toHaveURL(/\/login/)
}

test.describe('@backoffice platform host = back-office, clean URLs', () => {
  test('super_admin → clean dashboard at /, clean routes, no /platform in URL', async ({ page }) => {
    await loginAt(page, BOOKING, SEED.platformAdmin)
    // Lands on the platform dashboard at the clean root.
    await expect(page).toHaveURL(`${BOOKING}/`)
    await expect(page.getByRole('heading', { name: 'Översikt' })).toBeVisible()
    expect(page.url()).not.toContain('/platform')

    // Clean back-office routes resolve (no /platform prefix).
    await page.goto(`${BOOKING}/kunder`)
    // Tenants ÄR plattformens kunder; slutkunder har en egen insynsrutt.
    await expect(page.getByRole('complementary', { name: 'Kunder' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Välj en kund' })).toBeVisible()
    await page.goto(`${BOOKING}/slutkunder`)
    await expect(page.getByRole('heading', { name: 'Slutkunder' })).toBeVisible()
    await page.goto(`${BOOKING}/fakturering`)
    await expect(page.getByRole('heading', { name: 'Faktureringsunderlag' })).toBeVisible()

    // The internal /platform prefix is never exposed — it bounces to the clean /.
    await page.goto(`${BOOKING}/platform`)
    await expect(page).toHaveURL(`${BOOKING}/`)

    // VÅG 1 role→surface guard: a platform_admin has no single tenant to scope to,
    // so the tenant-scoped back-office (/admin, /personal) bounces them back to the
    // platform dashboard instead of silently rendering the account's anchored tenant.
    for (const p of ['/admin', '/personal']) {
      await page.goto(`${BOOKING}${p}`)
      await expect(page, `${p} must bounce super_admin to the platform dashboard`).toHaveURL(`${BOOKING}/`)
    }
  })

  test('salon_admin → their salon admin (/admin); platform surfaces denied', async ({ page }) => {
    await loginAt(page, BOOKING, SEED.salonAdmin)
    await expect(page).toHaveURL(new RegExp(`${BOOKING}/admin`))
    // Platform surfaces are flag-gated (requirePlatformAdmin) — a salon_admin (level
    // 6, platform_admin=false) is denied to /ingen-atkomst, never sees other tenants.
    for (const p of ['/kunder', '/slutkunder', '/fakturering']) {
      await page.goto(`${BOOKING}${p}`)
      await expect(page, `${p} must deny a salon_admin`).toHaveURL(new RegExp(`${BOOKING}/ingen-atkomst`))
    }
  })

  test('staff → kalendern, men ALDRIG systemadministrationen', async ({ page }) => {
    // goal-67 ÄNDRADE DEN HÄR REGELN, och testet fångade att det inte var uppdaterat.
    // FÖRR: staff (nivå 3) var under admin-portalens miniminivå (6) → hela /admin nekades.
    // NU:  "Full frihet i kalendern. Ingen systemadministration." (Zivars ord.) Personalen
    //      måste kunna boka, flytta, avboka och söka kunder — annars är produkten oanvändbar
    //      för den som faktiskt står i salongen. Vakten är requireAdminArea (lib/auth/admin-areas.ts),
    //      inte längre en enda nivågräns för hela /admin.
    await loginAt(page, BOOKING, SEED.staff)

    // Kalendern och kunderna: JA.
    for (const p of ['/admin/bokningar', '/admin/kunder']) {
      await page.goto(`${BOOKING}${p}`)
      await expect(page, `${p} måste vara öppen för personal`).toHaveURL(new RegExp(`${BOOKING}${p}`))
    }

    // Systemadministrationen: NEJ. Det är den här raden som gör rollen meningsfull —
    // utan den vore "staff" bara ett annat namn för salon_admin.
    for (const p of ['/admin/installningar', '/admin/personal', '/admin/tjanster']) {
      await page.goto(`${BOOKING}${p}`)
      await expect(page, `${p} måste nekas för personal`).toHaveURL(
        new RegExp(`${BOOKING}/ingen-atkomst`),
      )
    }
  })
})

test.describe('@backoffice tenant host = storefront only', () => {
  test('back-office paths are bounced off the storefront host', async ({ page }) => {
    // No login needed — the bounce happens in middleware before the auth gate.
    for (const p of ['/admin', '/personal', '/kunder', '/slutkunder', '/salonger', '/platform']) {
      await page.goto(`${STORE}${p}`)
      await expect(page, `${p} should bounce to storefront root`).toHaveURL(`${STORE}/`)
    }
  })
})
