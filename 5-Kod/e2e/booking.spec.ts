import { test, expect } from '@playwright/test'
import {
  acceptCookies,
  gotoTenant,
  loginCustomer,
  pickFirstAvailableSlot,
  wizardNext,
  SEED,
} from './helpers'

// @mutating — skriver en bokningsrad. Kräver den seedade fixturen
// (supabase/seeds/e2e-seed.sql via scripts/e2e-db.mjs), som är payment_mode=on_site
// ⇒ ingen Stripe-gren; wizarden landar direkt på bekräftelsesidan. Stripe-kortvägen
// (requiresPayment=true) ligger kvar i den manuella runbooken — den kräver ett kopplat
// konto + webhook-forwarding.
//
// FLÖDET (rättat): wizarden är FYRA steg med en "Fortsätt"-knapp mellan varje. Testet
// antog att ett val avancerade av sig självt och fastnade därför på steg 1 — tjänsten
// var vald, men "Fortsätt" trycktes aldrig, så det fanns aldrig några tider att välja.
// Felet såg ut som "No available slot in the 14-day window", vilket lät som en trasig
// bokningsmotor. Motorn var hel; testet gick inte vidare.

async function bookAsGuest(page: import('@playwright/test').Page, namn: string, epost: string, tel: string) {
  // Cookie-bannern täcker CTA:n i botten — bort med den först, precis som en kund gör.
  await acceptCookies(page)
  // Steg 1 — tjänst
  await page.getByRole('button', { name: /Klippning/ }).first().click()
  await wizardNext(page)
  // Steg 2 — personal ("Alla" = systemet fördelar själv). Scopad till wizarden:
  // "Alla" finns även i sidans platsväljare, och en oscopad selektor träffar båda.
  await page.locator('.wizard-stepbody').getByRole('button', { name: 'Alla' }).click()
  await wizardNext(page)
  // Steg 3 — dag + tid
  await pickFirstAvailableSlot(page)
  await wizardNext(page)
  // Steg 4 — uppgifter
  await page.getByLabel('Namn').fill(namn)
  await page.getByLabel('E-post').fill(epost)
  await page.getByLabel('Telefon').fill(tel)
  await wizardNext(page)
}

test.describe('@mutating booking end-to-end', () => {
  test('guest books a service and reaches the confirmation page', async ({ page }) => {
    await gotoTenant(page, '/boka', SEED.tenant.slug)
    await bookAsGuest(page, 'E2E Gäst', 'e2e-guest@example.com', '0700000000')
    await expect(page).toHaveURL(/\/boka\/bekraftelse\/[0-9a-f-]+/)
  })

  test('logged-in customer keeps their session through the booking flow', async ({ page }) => {
    await loginCustomer(page, SEED.salonAdmin) // storefront-login; vilket seedat konto som helst bevisar vägen
    await gotoTenant(page, '/boka', SEED.tenant.slug)
    await bookAsGuest(page, 'E2E Inloggad', 'e2e-loggedin@example.com', '0700000001')
    await expect(page).toHaveURL(/\/boka\/bekraftelse\/[0-9a-f-]+/)
  })
})
