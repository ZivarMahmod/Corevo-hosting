/* Corevo — Varumärke acceptans-spec.
 * Kör mot LIVE sidan: pnpm --filter @corevo/web exec playwright test varumarke.accept.spec.ts
 * Grön = sidan matchar mocken mätbart. Röd = console.table listar varje delta (got vs want).
 *
 * SETUP (en gång):
 *  1. Lägg denna fil + ../probe.js i 5-Kod/apps/web/e2e/acceptans/ (eller justera sökväg nedan).
 *  2. Autentisera som salon_admin (återanvänd din befintliga storageState från
 *     e2e/backoffice-routing.spec.ts — admin@frisor1.se / FreshCut).
 *  3. ⭐ Lägg `data-accept="ID"` på elementen (ID = raderna nedan). Det gör mätningen
 *     deterministisk. Alternativt: byt ut SEL-värdena mot dina riktiga selektorer.
 *     Hooken är test-only markup och påverkar inte runtime.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROBE = readFileSync(join(__dirname, "../probe.js"), "utf8");
const ROUTE = "/admin/varumarke"; // justera mot din baseURL/host (salon_admin-yta)

// ── Förväntade värden (1:1 ur Branding.jsx + playbook §4.3). Wire `sel` mot din DOM. ──
const ASSERTIONS = [
  // PageHead
  { id: "P1-eyebrow-font",  sel: '[data-accept="P1"]', prop: "font-family", kind: "font", expect: "Inter" },
  { id: "P1-eyebrow-color", sel: '[data-accept="P1"]', prop: "color", kind: "color", expect: "#D98E12" },
  { id: "P1-eyebrow-track", sel: '[data-accept="P1"]', prop: "letter-spacing", kind: "px", expect: "1.98" }, // .18em @ 11px ≈ 1.98px
  { id: "P2-title-font",    sel: '[data-accept="P2"]', prop: "font-family", kind: "font", expect: "Playfair Display" },
  { id: "P2-title-size",    sel: '[data-accept="P2"]', prop: "font-size", kind: "px", expect: "28" },
  { id: "P2-title-weight",  sel: '[data-accept="P2"]', prop: "font-weight", kind: "eq", expect: "700" },
  { id: "P2-title-color",   sel: '[data-accept="P2"]', prop: "color", kind: "color", expect: "#1F4636" },
  { id: "P2-title-text",    sel: '[data-accept="P2"]', prop: "text", kind: "eq", expect: "Varumärke" },

  // Dirty/published-band (kör i clean state — FreshCut publicerat)
  { id: "D1-band-pad",   sel: '[data-accept="band"]', prop: "padding-top", kind: "px", expect: "11" },
  { id: "D1-band-radius",sel: '[data-accept="band"]', prop: "border-radius", kind: "px", expect: "12" },
  { id: "D4-band-bg",    sel: '[data-accept="band"]', prop: "background-color", kind: "color", expect: "#E8F0EA" },

  // Grid
  { id: "G2-grid-gap",   sel: '[data-accept="grid"]', prop: "column-gap", kind: "px", expect: "20" },
  { id: "G2-grid-align", sel: '[data-accept="grid"]', prop: "align-items", kind: "eq", expect: "start" },

  // Kontroll-kort
  { id: "C1-card-pad",    sel: '[data-accept="controls"]', prop: "padding-top", kind: "px", expect: "22" },
  { id: "C3-input-radius",sel: '[data-accept="input-name"]', prop: "border-radius", kind: "px", expect: "10" },

  // Swatch-picker
  { id: "SW1-count",  sel: '[data-accept="swatch"]', prop: "count", expect: 6 },
  { id: "SW2-size",   sel: '[data-accept="swatch"]', prop: "width", kind: "px", expect: "38", all: true },
  { id: "SW2-radius", sel: '[data-accept="swatch"]', prop: "border-radius", kind: "px", expect: "10", all: true },

  // Font-tiles (self-rendering)
  { id: "F1-count",       sel: '[data-accept="fonttile"]', prop: "count", expect: 5 },
  { id: "F2-tile-size",   sel: '[data-accept="fonttile"]', prop: "font-size", kind: "px", expect: "18", all: true },
  { id: "F2-cormorant",   sel: '[data-accept="fonttile-cormorant"]', prop: "font-family", kind: "font", expect: "Cormorant Garamond" },

  // Live-preview (STOREFRONT-världen)
  { id: "L1-frame-radius", sel: '[data-accept="preview"]', prop: "border-radius", kind: "px", expect: "18" },
  { id: "L5-hero-height",  sel: '[data-accept="preview-hero"]', prop: "height", kind: "px", expect: "430" },
  { id: "L3-dots-count",   sel: '[data-accept="preview-dot"]', prop: "count", expect: 3 },
  { id: "L10-headline-size", sel: '[data-accept="preview-headline"]', prop: "font-size", kind: "px", expect: "46" },
  // Världs-vakt: preview får ALDRIG vara Corevo-forest. Hero-rubrik = vit, inte #1F4636.
  { id: "L8-world-guard",  sel: '[data-accept="preview-headline"]', prop: "color", kind: "color", expect: "#FFFFFF" },

  // Info-callout
  { id: "I1-callout-bg", sel: '[data-accept="info-callout"]', prop: "background-color", kind: "color", expect: "#FBEBCB" },
];

test.describe("Varumärke — acceptans (måste matcha mock mätbart)", () => {
  test("0 FAIL mot Branding.jsx + playbook §4.3", async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState("networkidle");

    const result = await page.evaluate(
      ([src, A]) => { eval(src); /* eslint-disable-line no-eval */ return corevoProbe(A); },
      [PROBE, ASSERTIONS] as const,
    );

    if (result.fail) {
      console.log("\n❌ Varumärke-deltan att fixa:");
      for (const f of result.fails) console.log(`  ${f.id}  [${f.prop}]  got:${f.got}  want:${f.want}`);
    }
    expect(result.fail, `${result.fail}/${result.total} assertions failade — se listan ovan`).toBe(0);
  });

  // Beteende-acceptans (röd tråd / state-maskin) — kompletterar pixel-mätningen.
  test("Publicera gatas på dirty; Ångra på history", async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.getByRole("button", { name: "Publicera" })).toBeDisabled(); // clean state
    await page.getByRole("textbox", { name: /hero/i }).fill("Ny rubrik live");      // mutera
    await expect(page.getByRole("button", { name: "Publicera" })).toBeEnabled();   // dirty → på
    await expect(page.getByText(/Osparade ändringar/)).toBeVisible();              // dirty-band
    await page.getByRole("button", { name: "Ångra" }).click();
    await expect(page.getByText(/Allt publicerat/)).toBeVisible();                 // clean-band åter
  });
});
