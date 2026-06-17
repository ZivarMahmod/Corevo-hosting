# Onboarding-studio — handoff till Code

En klickbar, end-to-end-prototyp av hela onboarding-resan i superadmin:
**Salonger (super) → Onboarding-studio → Live (kundens publika sajt + kundens egen admin).**
Öppna `onboarding-studio/index.html`.

> Detta är en **arkitektur-spec i form av en prototyp**, inte produktionskod.
> Målet: mapparna/strukturen ska peka rätt så att Code kan bygga det "som det är tänkt".

---

## Var sanningen ligger

| Fil | Roll |
|---|---|
| **`cfg-data.js`** | ⭐ **Data-spine — läs denna först.** Kanonisk karta: 16 branscher, modul-register med per-bransch-varianter, DB-tabeller per modul, "vad Code bygger", onboarding-faser, checklista, domänfakta. Allt mappar mot riktiga tabeller. |
| `app.jsx` | Orkestrering: stadie-resan + state (`cfg`-objektet som byggs upp). |
| `studio.jsx` | Vänster steg-rail (5 faser) + varje stegs kontrollpanel. |
| `preview.jsx` | Live storefront-preview: tema + moduler som sektioner + klick-redigera text + browser-ram. Render-bron (sajtbyggare §6.1) gjord synlig. |
| `stages.jsx` | Superadmin-entré · lanseringssekvens · kundens publika sajt · kundens egen admin (M6). |
| `primitives.jsx` / `icons.jsx` | Back-office-UI (forest/gold) + ikoner. |

## Spec-läge
Klicka **Spec-läge** (uppe till höger). Gula markörer (H, 1, 2…) på previewen öppnar
en ruta med: *syfte · DB/källa · vad Code bygger*. Det är överlämnings-anteckningarna,
pinnade på exakt den ruta de gäller.

## Det viktiga för bygget
1. **En kodbas, bransch = config.** Bransch sätter `tenant_settings.settings.vertical`,
   default `tenant_modules`, terminologi (frisör→behandlare→groomer…) och bokningsvariant.
2. **Moduler = dynamiska React-sektioner** med riktig DB-data, vävs in i den statiska
   mall-layouten via `<corevo-module type=… pos=…>`-markörer (render-bron). Livscykel i
   `tenant_modules.state`: off → draft → live → paused.
3. **Per-bransch-varianter** (t.ex. Bokning-hundsalong = hundstorlek/ras via husdjursprofil,
   Bokning-tatuerare = deposit krävs) står ordagrant i `MODULES[*].variants[bransch]` +
   `MODULES[*].build`. Det är kravlistan per modul.
4. **Subdomän:** `<slug>.corevo.se` via wildcard → Worker host-parsar slug → tenant_id;
   RLS isolerar i Postgres. Egen domän = parkerat/spärrat spår.
5. **Betal-rails pausade** (beslut 14.2): shop/presentkort/deposit visar UI, rör inga pengar än.

## Medvetet utelämnat (för att inte förvirra)
- Ingen roll-toggle som flippar super/kund (den förvirrade förra gången). Navigeringen är
  en **ärlig resa** (Salonger → Studio → Live), och varje yta är tydligt märkt med vem som
  ser den ("Besökarens vy" / "Kundens egen admin (M6)").
- Inga ~100 mallar byggs — 5 byggda teman finns; nya vendor-mallar importeras som **data**
  via sajtbyggaren (engångs-onboarding-jobb per mall, se `06-sajtbyggare/`).
