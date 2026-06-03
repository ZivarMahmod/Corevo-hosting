# FAS 0 — Fynd (WORKFLOW-02 helsvep, plan MOT kod)

Datum: 2026-06-02 · Metod: 27 adversariella subagenter (7 modul-granskare + fryst-fil/våg-krock-granskare + bugg-verifierare), varje high-fynd adversariellt verifierat mot citerad `file:line`. Förbjudet att öppna gamla `1-Planering/moduler/`.

**Verdikt: planen är byggbar och MESTA av M-doken stämmer mot koden. MEN tre saker måste justeras INNAN bygge** (se §A nederst). Naming-frysen är ren (inga `auth.tenant_id`/`barber_id` — `private.tenant_id()`/`staff` följs).

Severity efter verifiering: **high 18 → flera nedgraderade** (många "frozen-clash HIGH" var egentligen redan-dokumenterad solo-sekvensering), medium 20, low 7.

---

## 1. FAS 0.5 — bugg-verifiering (kritiskt: en premiss är fel)

| Bugg | Plats | Status | Fynd |
|---|---|---|---|
| **B1 savePlatformBranding-clobber** | `lib/platform/actions.ts:236-242` | ✅ **BEKRÄFTAD, lever** | Branding-objektet byggs UTAN `...prev` → en plattforms-branding-save raderar ägarens hero/gallery/about/closing/team/stats/accent ur `tenant_settings.branding`. Dessutom: `pruneRemovedImages` (rad 251) tar bara `logo_url` → den klobbrade storefront-median orphan-raderas ej i R2. M6:s motsvarighet (`lib/admin/actions.ts:401`) **mergar korrekt** med `...prev`. |
| **B2 personalvyns "Idag" kraschar** | `lib/booking/tz.ts` + `lib/personal/calendar.ts:34` | ⚠️ **REPRODUCERAR INTE som beskriven** | `toISOString()`-anropen finns (calendar.ts:34/42), men "Idag"-vägen anropar `dayRangeUtc(today, tz)` där `today = todayInTz(tz)` (`format.ts:64-71`) som returnerar en **giltig** datumsträng → ingen `Invalid Date`. Kraschen kastar bara om `timeZone`-strängen är ogiltig (IANA-fel), inte i normalflödet. **FAS 0.5:s bugg-2-pekare är stale.** |

**Konsekvens:** B1 fixas (men som DELAD merge-helper, inte bara i M7 — se revir-krock nedan). B2 ska INTE blind-"fixas" som en Idag-krasch — antingen lägg en defensiv `Number.isNaN(d.getTime())`-guard i `calendar.ts` (billig, ofarlig) och avskriv jakten, eller verifiera om det fanns en riktig edge (ogiltig tenant-tz). Bygg inte om en krasch som inte finns.

---

## 2. Fryst-fil-brott → Våg 0 måste UTÖKAS (den strukturella huvudsaken)

Workflow-doket la i Våg 0 bara: kund-tabell, explicit-slot-schema, design-token-baseline. Granskningen visar att **fler feature-vågsmoduler kräver frusna `packages/db`/`types.ts`-ändringar** — de måste flyttas till Våg 0-solo, annars rör parallell-agenter frysen + krockar på `types.ts`.

| Modul (våg) | Kräver frusen ändring | Källa |
|---|---|---|
| M4 favoriter (Våg 2) | NY tabell `customer_favorites` | M4:46,68 — finns ej (grep 0001–0010 = 0) |
| M4 lojalitet (Våg 2) | NY tabell (durabel poäng-ledger) | M4:26 — MVP (frisör-band/count) kan härledas ur `bookings` utan migr; bara ledgern kräver tabell |
| M5 kundnoteringar (Våg 2) | NY tabell `customer_notes` (strukturerad/vaktad) | M5 §2.3/§4.4 — finns ej |
| M6 kunddatabas (Våg 1) | NY `customers`-tabell + PII-split | M6 §4 — finns ej (redan tänkt Våg 0) |
| M6 explicit-slot-schema (Våg 1) | `working_hours` slot-stöd | M6 §5 — redan tänkt Våg 0 |
| M8 no-show-policy (Våg 3) | per-tenant `no_show_policy` | M8 §2.4 — kan ev. bo i `tenant_settings.settings` JSON istället för ny kolumn |
| M2 ägar-copy (Våg 1) | `TenantBranding`-typ ELLER JSON | M2 §2.3 — **kan undvika frysen** via `tenant_settings.settings` JSON (M2-granskarens väg (a)) |

**Rekommendation:** kör ALLA nya tabeller (`customers`, `customer_favorites`, lojalitet-ledger, `customer_notes`) + `working_hours` slot-stöd i **EN solo Våg-0-migration + EN `types.ts`-regen**. Då finns frysen aldrig kvar när Våg 1/2 kör parallellt.

---

## 3. Revir-krockar (parallell-faror — fynd som per-modul-fan-out inte kan se)

| Krock | Våg | Yta | Åtgärd |
|---|---|---|---|
| **M6 ⇄ M7 branding** | 1 (parallell) | `tenant_settings.branding` jsonb — M6 mergar (`...prev`), M7 ERSÄTTER | **= samma sak som B1.** Fixa med en DELAD merge-helper båda anropar; aldrig ersätt hela objektet. |
| **M6 ⇄ M7 settings** | 1 (parallell) | `tenant_settings.settings` jsonb — M6 äger `google_review_url`, cancellation, notifications m.fl. (mergar); M7 ska skriva sina nycklar | Säkerställ M7 också mergar `...prev` i settings; klargör vem som äger vilken nyckel. |
| **M4 ⇄ M5 types.ts** | 2 (parallell) | båda lägger nya tabeller → regen samma `types.ts` | Löses av §2 (alla tabeller i Våg 0). |

---

## 4. M-dok som är FEL mot koden (korrigera doket — bygg INTE om)

| Dok | Påstår | Verklighet |
|---|---|---|
| M3 §1/§4.1 | "togs av annan"-vy = ❌ Saknas | **Redan byggd** — `boka/actions.ts:201-204` mappar 23P01 → vänlig "Tyvärr, tiden togs precis." Begränsa §4.1 till hold+release + stale-meddelande. |
| M4 §2.3 | Google-nudge = popup direkt efter betalning | Byggt = **e-post på `status=completed`** (`google-review.ts`). §1-tabellen säger redan "efter besök". Align prosan, eller respeca popup som eget item. |
| M7 §2.1A/§5 | "M7 rör ALDRIG utseende, look = bara kod, aldrig no-code" | Byggt = M7 GÖR no-code färg/font/logo-branding (`PlatformBrandingForm`, `CreateTenantForm`-paletter). Spika gränsen: tillåt basal token-branding som no-code, reservera kod för nivå-3 overrides — annars strip:a M7-branding. |

---

## 5. Per-modul-fynd (severity = efter verifiering)

### M2 Storefront
- **[high] Ägar-copy saknas** (hero eyebrow/title/lede, om-text, tagline, italic) — `TenantBranding` (`packages/ui/tokens.ts:5-21`) har bara färg/font/media; `resolveThemeContent` (`theme-content.ts:212-233`) mergar bara media, copy tas alltid från tema-default. End-to-end-gap (även M6-editorn saknar fälten). → bygg copy-modell (JSON-väg undviker frysen).
- **[high] SEO-svit saknas** — ingen `sitemap.ts`/`robots.ts`, ingen LocalBusiness JSON-LD; per-sida `metadata` är statisk utan description/openGraph. → bygg sitemap/robots/JSON-LD + `generateMetadata` per sida.
- [medium] Hårdkodade sektionsrubriker (`sections.tsx:64,104,105`; `tjanster/page.tsx:22`) kringgår copy-modellen → flytta till ThemeContent.
- [medium] frozen-clash: copy-fält i `TenantBranding` → föredra separat ContentOverride i `settings` JSON (ingen frysen rörd).
- [low] settings.ts-mönster bekräftar JSON-väg (ingen åtgärd). · Token-audit ren: inga hårdkodade Corevo-hex i storefront, inget stjärnbetyg finns.

### M3 Bokningsmotor (Våg 3)
- **[high→ verifierad high] 5-min slot-hold + release saknas** — `create_public_booking` insertar direkt `pending`, EXCLUDE blockerar slot:en → pending-squat-skulden lever. Verkligt high, helt nytt.
- [high→ nedgrad low] "Hela M3 kräver frysta filer" — fakta stämmer (booking_services-tabell saknas m.m.) men M-dok §4 medger redan solo-fas; ej akut frozen-clash, bara sekvensering.
- [medium] "Alla" tilldelar frisör vid VISNING (`actions.ts:141-156`), inte vid bokning → §2.4 vill tilldela vid commit (först-ledig/minst-belastad + fallback).
- [medium] Stale-sida/passerad tid → kryptiskt "Något gick fel" (bara 23P01 mappas; P0001 `start_in_past` omappad) → mappa till graceful.
- [medium] Auto-klar (tidsbaserad completion) saknas — bara manuell knapp.
- [low] Per-frisör steg/buffert hårdkodat globalt (`actions.ts:39`) — motorn stöder param, anroparen matar konstant.

### M4 Kundportal (Våg 2)
- **[high] Lojalitet helt obyggd** (poäng/tier/frisör-band) — MVP härledbar ur bookings; bara ledger kräver tabell.
- [high→ nedgrad medium] Favoriter kräver ny tabell `customer_favorites` (frozen → Våg 0).
- [medium] Google-nudge dok-mismatch (se §4).
- [medium] Kund-root saknar `data-world="storefront"`/`data-theme` (`konto/layout.tsx:22`) → tema-selektorer kan missa.
- [low] Corevo-guld `#f5a623` hårdkodad som CSS-var-fallback (`kund.module.css:177,210`) → byt till neutral.

### M5 Personalportal (Våg 2)
- **[high] Drop-in/walk-in saknas helt** → bygg server-action (egen staff_id, EXCLUDE som M3).
- **[high] Klientkort saknas** (återkommande/historik/besöksantal) — bara platt `customerLabel`. Kräver kund-tabellen (M6 §4).
- [high→ nedgrad medium] Kundnoteringar kräver ny tabell `customer_notes` (frozen → Våg 0).
- [high→ nedgrad low] Frisör self-editar arbetstids-baseline (`addWorkingHours`/`deleteWorkingHours`) — mot §2.1 (ägar-auktoritet) → flytta CRUD till M6, gör M5-vyn read-only.
- [high→ **refuted/none**] isNaN-guard/Idag-krasch — se B2, reproducerar inte.
- [medium] Kundens mejl visas okonditionerat i kalendern (`calendar.ts:89-91`) → §2.2 PII: bara i drift-fönstret.
- [medium] Omboka/avboka saknas som frisör-action (`setBookingStatus` tillåter bara completed/no_show) → lägg som bygg-item.

### M6 Salon-admin (Våg 1)
- **[high] Kunddatabas finns inte alls** (ingen route `/admin/kunder`, ingen tabell, ingen kund↔bokning-länk) → §4 hela identitet/PII-arkitekturen.
- **[high] Schema = fasta veckotider** (`ScheduleManager.tsx:32-39` start/end-tid) — exakt "fel modell" §5 vill ersätta med explicita bokbara starttider.
- [high→ nedgrad medium] Explicit-slot kräver `working_hours`-schemaändring (frozen → Våg 0).
- [medium] Branding saknar undo/återställ + "öppna din sida"-preview-knapp (§3.6) — live-preview + merge finns redan.
- [medium] SMS-toggle = **död toggle** (`SettingsForm.tsx:187-193`) → mot §3.7. Koppla leverantör eller ta bort.
- [medium] Bokningar saknar fritextsök + "bokad den" + live-koppling-visning (§3.2).
- [medium] Dashboard saknar §3.8-widgets (tjänste-mix, topptimmar) + "Se din sida"-länk.
- [medium] Personal-invite (mejl→magic-link) saknas — `createStaff` skapar bara titel-rad (§3.4; kräver SERVICE_ROLE_KEY-secret).
- [low] Auto-klar-visning + completion-gate saknas (§3.2). · [low] Tjänster visar ej storefront-placering (§3.3).

### M7 Platform-admin (Våg 1)
- **[high] B1 clobber + R2-orphan** (se §1/§3) → delad merge-helper.
- **[high] Operativ data-kontroll-lager helt obyggt** (§2.1B "Supabase med mitt UI": lägg till kund, lösenords-reset, Google-recensions-länk, redigera tenant-data) → kärnan i M7-visionen.
- [high→ nedgrad medium] Boknings-vy-val per tenant (Variant 3/4) i onboarding saknas — "variant" i koden = storefront-LOOK, inte boknings-vy → skriv `settings.booking.variant`, M3 läser.
- [medium] Zivar-assisterad personal-onboarding via M7 saknas (kan bara räkna personal).
- [medium] M7 no-code-look-contradiction (se §4).
- [low] Hårdkodade hex-fallbacks i back-office branding-form. · [low] "Inga måste-fält" delvis (name+slug required — försvarbart).

### M8 Betalningar (Våg 3)
- [medium] Flytt-av-betald: `rebookBooking` re-pointar INTE payment-raden → betalning orphanas på gamla bokningen. App-nivå UPDATE (payments ej frozen) byggbar in-place.
- [medium] No-show-refund-logik ej byggd (ens vilande) — bara `status='no_show'` sätts.
- [medium] frozen-clash: no-show-policy → ny `tenant_settings`-kolumn ELLER `settings` JSON (föredra JSON, undvik frysen).

---

## A. Att besluta INNAN bygge (landa med Zivar)

1. **Utöka Våg 0** till EN solo-migration med ALLA nya tabeller (`customers`, `customer_favorites`, lojalitet-ledger, `customer_notes`) + `working_hours` slot-stöd + EN `types.ts`-regen. (Annars krockar Våg 1/2-parallell på frysen.) — *rekommenderat, tekniskt tvingat av §2/§3.*
2. **FAS 0.5: fixa B1 som DELAD merge-helper** (M6+M7 anropar samma; aldrig ersätt jsonb). **B2: lägg billig isNaN-guard + avskriv jakten** (reproducerar ej).
3. **Korrigera tre M-dok** (§4: M3 togs-av-annan redan byggd, M4 nudge-modell, M7 no-code-princip) så agenter inte bygger om / förvirras.

### Öppna val (produkt/Zivar)
- **M7-principen (§2.1A):** tillåt basal no-code token-branding (färg/font/logo) i M7 + carve-out i doket — ELLER strip:a M7-branding helt?
- **M2-copy + M8 no-show-policy:** lagra i `tenant_settings.settings` JSON (undviker frysen, stannar i-våg) — ELLER egna kolumner/typer (renare, Våg 0)? *Default-rek: JSON.*
- **M4 Google-nudge:** behåll byggd e-post-på-completed (align dok) — ELLER bygg popup-direkt-efter-betalning som §2.3?
