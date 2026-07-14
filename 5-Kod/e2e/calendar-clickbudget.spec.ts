import { test, expect, type Page } from '@playwright/test'
import { BOOKING_HOST, SEED, loginBackoffice } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// KLICKBUDGETEN (goal-66, B-27) — hårda FAIL-krav, inte ambitioner:
//
//   boka   ≤ 5 klick   (från öppen kalender till sparad bokning)
//   flytta ≤ 2 moment  (ett drag + en bekräftelse — draget räknas som ETT moment)
//   avboka ≤ 3 klick
//
// Testet ÄR budgeten: varje flöde nedan innehåller exakt så många klick som budgeten
// tillåter. Kräver flödet ett klick till går det inte att slutföra — och testet faller.
// Lägg ALDRIG till ett klick här för att få testet grönt; det är produkten som ska
// lagas, inte testet.
//
// @mutating: skapar/flyttar/avbokar en riktig bokning → körs mot seedad staging,
// aldrig prod (samma regel som övriga @mutating-specs). Flödet städar efter sig:
// bokningen som skapas är samma bokning som avbokas.
// ─────────────────────────────────────────────────────────────────────────────

/** Unikt kundnamn per körning så sökträffar/dubbletter från förra körningen aldrig
 *  stör klickräkningen. */
const CUSTOMER = `Budget Test ${Date.now().toString(36)}`

async function openCalendar(page: Page) {
  // Morgondagens dagvy: alltid framtida tider (bokningsbara), oberoende av klockan
  // när testet råkar köra.
  const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10)
  await page.goto(`${BOOKING_HOST}/admin/bokningar?vy=dag&datum=${tomorrow}`)
  await expect(page.getByRole('button', { name: 'Ny bokning' })).toBeVisible()
}

test.describe('@mutating kalenderns klickbudget', () => {
  test.describe.configure({ mode: 'serial' })

  test('boka: högst 5 klick', async ({ page }) => {
    await loginBackoffice(page, SEED.salonAdmin)
    await openCalendar(page)

    await page.getByRole('button', { name: 'Ny bokning' }).click() // klick 1

    // Klick 2: tjänsten. Första chippen i tjänstlistan (seedad: Klippning).
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /klippning/i }).first().click()

    // Klick 3: första lediga tiden (chip med HH:MM). Att tiderna alls dyker upp är
    // en del av kontraktet — utan slots är bokningen omöjlig oavsett budget.
    await dialog.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first().click()

    // Kundnamnet SKRIVS (tangenter är inte klick — budgeten räknar beslut, inte
    // bokstäver). Ny kund = ingen träff att klicka på; namnet räcker.
    await dialog.getByLabel('Sök eller skapa kund').fill(CUSTOMER)

    // Klick 4: spara. Notisvalet default:ar till "skicka inget" — inget tvångsklick.
    await dialog.getByRole('button', { name: 'Boka' }).click()

    // Serverbekräftat (aldrig optimistiskt): bokningen ska SYNAS i kalendern.
    await expect(page.getByRole('button', { name: new RegExp(CUSTOMER) })).toBeVisible({
      timeout: 10_000,
    })
    // 4 klick använda ≤ 5. Budgeten håller — med marginal för kundträff-klicket
    // (befintlig kund = ett klick till, fortfarande inom budget).
  })

  test('flytta: ett drag + en bekräftelse', async ({ page }) => {
    await loginBackoffice(page, SEED.salonAdmin)
    await openCalendar(page)

    const block = page.getByRole('button', { name: new RegExp(CUSTOMER) }).first()
    await expect(block).toBeVisible()

    // Moment 1: draget. HTML5-drag (dataTransfer) — Playwright syntetiserar hela
    // dragstart→dragover→drop-kedjan. Målet är samma kolumn, längre ner (senare tid).
    const box = (await block.boundingBox())!
    await block.dragTo(page.locator('main'), {
      sourcePosition: { x: box.width / 2, y: 10 },
      targetPosition: { x: box.x + box.width / 2, y: box.y + 200 },
    })

    // Moment 2: bekräftelsen — med konsekvensen utskriven, aldrig "Är du säker?".
    await page.getByRole('button', { name: 'Flytta' }).click()
    await expect(page.getByText('Bokningen är flyttad.')).toBeVisible({ timeout: 10_000 })
  })

  test('avboka: högst 3 klick — och ångraloggen fångar den', async ({ page }) => {
    await loginBackoffice(page, SEED.salonAdmin)
    await openCalendar(page)

    await page.getByRole('button', { name: new RegExp(CUSTOMER) }).first().click() // klick 1
    await page.getByRole('button', { name: 'Avboka' }).click() // klick 2

    // Bokningen lämnar kalendern (avbokad = borta ur dagsvyn som aktiv).
    await expect(page.getByText('Status uppdaterad.')).toBeVisible({ timeout: 10_000 })
    // 2 klick använda ≤ 3.

    // Efterkontroll (B-24, inga extra budgetklick — det här är verifiering, inte
    // flödet): ångraloggen ska visa avbokningen med rätt avsändare.
    await page.getByRole('button', { name: 'Avbokade tider' }).click()
    await expect(page.getByText(new RegExp(CUSTOMER))).toBeVisible()
    await expect(page.getByText('Avbokad här i adminen')).toBeVisible()
  })
})
