# FIX-25: Onboarding-steg 5 "Egen domän" ska spegla flaggan
Thinking: 🟢 · Svårighet: 1/5 (en rad + deploy)

## Mål
Plattformens salong-detalj (Översikt → Onboarding-stege) visar statiskt "SPÄRRAD — kör på *.corevo.se. Custom domän kräver manuell drift." för steg 5, fast DomänPanelen är LIVE (flagga på, verifierad 2026-06-07). Texten ska spegla verkligheten.

## Lägeskoppling
FINSLIP-TODO #7. goal-23 stängd — detta är kosmetisk efterdyning.

## Berörda filer
- `5-Kod/apps/web/lib/platform/tenants.ts` (~rad 328) — steg-5-objektet i onboarding-listan.
- Ev. `components/platform/OnboardingChecklist.tsx` (status-ikonen `locked: '🔒 Spärrad'`) — bara om status-fältet också ska bytas.

## Steg
1. Läs hur steg-5-objektet byggs i `tenants.ts` (~328). Identifiera om steget har ett statiskt `locked`-status.
2. Gate:a på samma sanning som DomainPanel: `process.env.DOMAIN_PROVISIONING_ENABLED === 'true'`.
   - Flagga PÅ → status utifrån data: finns verifierad rad i `tenant_domains` för tenanten → `✓ Klart`, annars neutral "Tillgänglig — läggs till under Integrationer → Domän".
   - Flagga AV → behåll exakt nuvarande SPÄRRAD-text (oförändrat beteende).
3. Ingen ny DB-query om det blir dyrt: tenant-detaljen läser redan domändata för DomainPanel — återanvänd om den finns i samma server-scope; annars är `count`-läsning på `tenant_domains` per tenant OK (en tenant-sida, inte lista).

## Verifiering
- [ ] Render som platform@: freshcut → steg 5 visar INTE "Spärrad" (freshcut har verifierade domäner → `✓ Klart`).
- [ ] 0 console-fel.
- [ ] Bygg via `C:\tmp\kod` (robocopy /E → del .env.local → grep-guard `localhost:3000` → deploy → innehålls-smoke).

## Anti-patterns
- Hårdkoda INTE "Klart" — härled ur flagga + data (ärlighetspass-principen från goal-19).
- Rör INGET annat i onboarding-stegen.

## Rollback
`git revert` + `wrangler rollback <föregående version> --config 5-Kod/apps/web/wrangler.jsonc`.

## ⬆️ Maxning 2026-06-17 (skärpt acceptans)
Skärper RIGOR, inte scope. "Klart" = mekaniskt 0 FAIL (render-proof + enhetstest), aldrig ögonmått. De tre grenarna (flagga AV / flagga PÅ + verifierad domän / flagga PÅ + ingen domän) ska ALLA render-bevisas — inte bara den glada vägen.

### Skärpta acceptanskriterier (DoD)
- [ ] **Gren AV (regression-vakt):** Med `DOMAIN_PROVISIONING_ENABLED` osatt/`false` renderar steg 5 OFÖRÄNDRAD text: `"SPÄRRAD — kör på *.corevo.se. Custom domän kräver manuell drift."` (byte-för-byte identisk med nuläget — om strängen flyttas/ändras är det FAIL). Render-bevisas, inte antas.
- [ ] **Gren PÅ + ingen verifierad domän:** Tenant UTAN någon verifierad rad i `tenant_domains` (flagga `true`) → steg 5 visar neutral ej-klar-text `"Tillgänglig — läggs till under Integrationer → Domän"`. Får ALDRIG visa `✓ Klart` och ALDRIG `SPÄRRAD`.
- [ ] **Gren PÅ + verifierad domän:** Tenant MED verifierad domän (flagga `true`) → steg 5 visar `✓ Klart`.
- [ ] **Render-proof täcker alla tre grenar** (t.ex. `acceptans`-spec eller `probe.js` som körs mot alla tre fixtur-fallen). Saknas en gren i beviset = ej klart.

### Enhetstest på statushärledningen (mekanisk regressionsfångst)
- [ ] Brytt UT statushärledningen till en ren funktion (input → output), så den kan testas utan render/DB. Förslag på kontrakt:
  `deriveStep5Status({ flagEnabled: boolean, hasVerifiedDomain: boolean }) → { status: 'locked' | 'available' | 'done', label: string }`
- [ ] Enhetstest (vitest) som täcker hela sanningstabellen — regressionen fångas mekaniskt, utan ögonmått:
  - `flagEnabled:false, hasVerifiedDomain:false` → `locked` + exakt SPÄRRAD-strängen.
  - `flagEnabled:false, hasVerifiedDomain:true` → `locked` (flagga AV vinner alltid över data — domändata får INTE läcka ut när flaggan är av).
  - `flagEnabled:true, hasVerifiedDomain:false` → `available` + neutral "Tillgänglig"-sträng.
  - `flagEnabled:true, hasVerifiedDomain:true` → `done` + `✓ Klart`.
- [ ] Etiketterna (label-strängarna) asserteras exakt i testet, så att en framtida ordändring i texten ger FAIL och inte tyst drift.

### Query-återbruks-regel (undvik tyst N+1)
- [ ] Återanvänd den domänladdning som DomainPanel redan gör i SAMMA server-scope (samma tenant-detalj-render). Härled `hasVerifiedDomain` ur det redan hämtade resultatet.
- [ ] Lägg INTE till en ny per-tenant `count`-query för enbart steg 5 om domändata redan finns i scope — det är en tyst N+1/dubbelläsning. Endast om ingen sådan laddning finns i scope får en enkel `count`-läsning på `tenant_domains` läggas till (en tenant-sida, ej lista).
- [ ] Verifiera i koden att antalet domän-relaterade DB-anrop i tenant-detaljens render-scope INTE ökar jämfört med nuläget (gränsen: oförändrat antal queries).

### Verifierings-tillägg
- [ ] Enhetstest grönt (`vitest`) — alla fyra raderna i sanningstabellen.
- [ ] Render-proof grönt för alla tre grenar (AV / PÅ+domän / PÅ+ingen-domän), 0 FAIL.
- [ ] 0 console-fel i samtliga tre grenar.
- [ ] Bygg via `C:\tmp\kod` (robocopy /E → del `.env.local` → grep-guard `localhost:3000` → deploy → innehålls-smoke). Rollback-not antecknad enligt Rollback-sektionen.
