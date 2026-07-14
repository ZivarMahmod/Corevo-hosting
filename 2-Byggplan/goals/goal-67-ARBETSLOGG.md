# Goal 67 — Arbetslogg

Levande logg. Nyaste överst. Uppdateras efter varje avslutat steg.
Planen: `2-Byggplan/goals/goal-67-kundadmin-fortsattning.md`.

---

## Omgång 3 — belastningstest · E2E · dataintegritet

### ✅ BELASTNINGSTEST — krockskyddet HÅLLER, två äkta buggar funna
Rapport: `6-Testing/goal-67-belastningstest.md`. Skript: `apps/web/scripts/last-test/`.
Kört mot isolerad testtenant, år 2030+, allt uppstädat (0 testrader kvar).

**Det som HÖLL (dataintegriteten är intakt):**
| Scenario | Försök → Lyckade → Rader i DB |
|---|---|
| 50 samtidiga bokningar, samma tid + resurs | 50 → 1 → **1** (49× 23P01) |
| Blandad last: 60 anrop, 12 unika (resurs, tid) | 60 → 12 → **12** |
| 10 samtidiga bokningar i nyss avbokad lucka | 10 → 1 → **1** |
| Samma bokning flyttad 2× samtidigt | 2 → 2 → **1** |
| Kant-mot-kant (10:00–10:30 + 10:30–11:00) | 2 → 2 → 2 (tillåtet, `[)`) |

Aldrig en dubblett. Aldrig en tappad bokning. Aldrig en 500:a.
**Läs-konsistens:** ingen cache, ingen polling i bokningsvägen (`force-dynamic`, slots live
via `get_busy_intervals`). Två användare KAN inte se olika serverdata. En stale flik får ett
ärligt fel från EXCLUDE — aldrig en dubbelbokning.

**🐛 BUGG 1 (P0) — idempotensen fångade fel undantag.** 10 samtidiga anrop med SAMMA
`request_id` → **9 av 10 fick "tiden togs precis" för sin EGEN bokning.** DB:n hade rätt
(1 rad), men svaret ljög. Orsak: 0048:s handler fångar `unique_violation` (23505), men
EXCLUDE-constrainten fyrar FÖRE unik-indexet och kastar `exclusion_violation` (23P01) —
rakt förbi den handler som skrevs för att fånga precis det. Det ÄR den dolda
dubbelbokningsfällan 0048 skrevs för att döda: kunden dubbelklickar "Boka" och får veta att
tiden är upptagen — av sig själv.
→ **Migration `0064` skriven** (ordagrann kopia av 0048, EN rad ändrad: fångar båda
undantagen). **EJ APPLICERAD** — deploy-frysen. Kräver Zivars ok.

**🐛 BUGG 2 (P2) — läs-sedan-skriv-race i `moveBooking`.** Statusvakten LÄSTE status, men
UPDATE:n filtrerade inte på den. En bokning som avbokades i glappet **flyttades ändå**
(bevisat: slutstatus `cancelled`, och tiden hade flyttats).
→ **FIXAT:** `.in('status', MOVABLE)` gör UPDATE:n villkorad; noll rader = ärligt
kapplöpningssvar. `setBookingStatus` gjorde redan rätt — racet fanns bara i `moveBooking`.

**Notis (P3):** `buffer_min` finns bara i koden, aldrig i constrainten — bufferten är en
presentationsregel, inte ett krockskydd. Troligen medvetet, nu dokumenterat.

### ✅ E2E — grinden blockerade (korrekt), budgeten verifierad statiskt
Sviten kunde INTE köras: `@mutating` + enda DB:n är molndatabasen (dev-servern läser
`.env.local` → skarp DB). Fixturen är dessutom död (tenant `frisor1` finns inte efter
DB-purgen). Ingen genväg togs.
**Klickbudgeten verifierad i koden i stället — alla tre håller:**
boka **4** (budget 5) · flytta **1 drag + 1 klick** · avboka **2** (budget 3).
**🐛 Produktbugg fixad:** `BookingDrawer` kastade serverns svar och hittade på en egen toast
("… speglas på storefront, personal och översikt") — två sanningar om samma händelse.
**KVAR (Zivars beslut):** en seedad engångs-DB krävs för att faktiskt köra sviten grönt.

---

## Omgång 2 — uteblivna kunder · dashboard-rensning

### ✅ Uteblivna kunder (no_show) — KLART
Zivars statistiksida hade ett kort för "uteblivna" som var hårdkodat till 0. Nu räknar det.
- **Fynd: live-DB accepterade REDAN `no_show`** (check-constraintet i 0001 hade det hela
  tiden). Migration 0063 skriven men är i praktiken en no-op — ingen DB-ändring behövdes.
  Statusen fanns; det var KODEN som aldrig kunde sätta den.
- `setBookingStatus` tar `no_show`, med **dåtidsvakt på servern**: en framtida bokning kan
  inte ha uteblivit. Priset står kvar (det ÄR poängen — en utebliven kund är förlorad
  intäkt som ska gå att räkna). Ångerbart: `no_show → confirmed`.
- "Uteblev"-knapp i drawern, visas bara när tiden passerat. Ett klick, ingen bekräftelse.
- Kalenderkortet: egen ikon (`clock`) + texten "Uteblev", skild från avbokads `x`.
- **Dubbelbokningsspärren rörs inte** — en utebliven tid ska inte blockera resursen.
- **ÄKTA BUGG FUNNEN OCH FIXAD:** `cancellationRate` hade nämnaren `aktiva + avbokade`.
  Uteblivna föll utanför underlaget helt → **avbokningsgraden var uppblåst**. Nämnaren är
  nu `aktiva + avbokade + uteblivna`. Samma fix i föregående period → även deltat var fel.
- Ny KPI: förlorad intäkt (summa price_cents på no_show).

### ✅ Dashboard-rensning — KLART
Regeln: "gör detta frisören snabbare? om nej — bort."
- **Död kod bort:** `dashboardData()` räknade ut `servicesActive`, `staffActive`,
  `serviceMix` och `peakHours` — **ingen sida renderade dem.** Veckoläsningen drog dessutom
  hem VARJE bokningsrad för att räkna en mix som slängdes. Nu: en `head`-count. Den frågan
  bor på /admin/statistik med riktig period och jämförelse. `hourInTz` + två typer bort.
- **"Denna vecka: 47" bort.** Ett tal man läser och sedan inte gör något med.
- **I dess ställe: "Bokat idag".** Tre färgningar ≠ tre luggklipp — antalet bokningar döljer
  skillnaden, kronorna gör det inte.
- **Codex fångade att jag ljög:** jag kallade talet "Intäkt idag", men summan innehöll
  framtida tider (en tid kl 16 har inte tjänats in kl 09) och räknade prislösa bokningar
  som tyst 0. Fixat: kortet heter "Bokat idag", hintan säger hur mycket som redan är KLART,
  och flaggar ärligt om någon tid saknar pris.
- Personalfärgs-prick i "Personal idag" — samma färg som kalendern. Listan och rutnätet
  talar samma språk; man slipper översätta namn → färg i huvudet.

### Grönt efter omgång 2
```
tsc --noEmit     0 fel
tester           1038 passed / 85 filer
vakt-bransch     0 nya
```

---

## Session 2026-07-14 (kväll) — statistik · personalfärger · månadsvy · roller

**Dev-server:** `npx next dev -p 3111` (kör i bakgrunden). Kör ALDRIG `next build`
samtidigt — de delar `.next` och cachen korrumperas (`MODULE_NOT_FOUND ./NNNN.js`).

**Deploy-frys:** Zivar har sagt STOPP. Inget push, ingen tagg förrän han säger till.

### Klart

**0. Migration 0061 verifierad** — `time_off.series_id`, `customers.hidden_at`,
`customers.self_book` finns alla i prod-DB. Goal-dokumentets "första handling" avklarad.

**1. Statistiksidan** (`/admin/statistik`) — helt ny yta.
- `lib/admin/stats.ts` — `getStats()` gör IO, `aggregateStats()` är REN (DB-fri) och
  bär hela KPI-logiken → testbar utan databas. 4 breda selects, noll N+1.
- KPI:er: omsättning · bokningar · avbokningar + grad · uteblivna · beläggning ·
  snittpris · pris/min · pris/timme · snittlängd · topp 5 tjänst · topp 5 personal ·
  intäkt per personal · intäkt per tjänst · nya vs återkommande · retention ·
  bokningar per veckodag · per timme · per månad (12 mån) · populäraste + lugnaste tider.
- Varje huvud-KPI jämförs mot föregående lika långa period (delta i %).
- Periodväljare = `<Link>`-pills mot `?period=7d|30d|90d|ar` → noll klient-JS.
- Diagram i REN CSS (grid + %). Inga nya npm-beroenden.
- 17 tester gröna.

**2. Färg per anställd** (Wavys viktigaste kalender-signal, gjord bättre).
- Migration `0062_staff_color.sql` — `staff.color` + check-constraint (bara `#rrggbb`).
  **Applicerad i prod-DB.**
- `lib/admin/staff-colors.ts` — Okabe–Ito-palett (färgblindsäker), deterministisk
  härledning ur `staff.id` när ingen färg valts → kalendern är färgkodad från dag ett,
  utan backfill och utan att någon behöver välja. 12 tester gröna.
- Färgen bär kortet i dag-, vecko- OCH månadsvyn. EN hex tonas med `color-mix` mot
  bakgrunden → ljus och mörk vy följer med gratis, ingen andra palett att hålla i synk.
- **Färgen är aldrig ensam bärare:** namnet står i kortet, status har ikon + text,
  avbokat har dimning. Slocknar färgen är kalendern fortfarande läsbar.
- Färgväljare i personalkortet: 12 rutor, ETT klick = sparat (ingen dialog, ingen
  Spara-knapp). Vald färg markeras med ring + bock, inte bara med färg.

**3. Månadsvyn ombyggd** — visar BOKNINGARNA, inte bara ett antal.
- Förut: en siffra ("3 bokningar") → tvingade fram ett klick för att se VAD som var
  bokat. Det klicket var hela frågan.
- Nu: riktiga kort i **hela cellens bredd** — tid · namn · tjänst · telefon, i
  personens färg. Tid och namn ellipseras ALDRIG; tjänsten viker först, telefonen sist.
- Cellen äger sin egen scroll → en full dag tappar aldrig en bokning och rutnätet
  håller formen även när varje dag är fullbokad. Tak på 8 kort, resten "+N fler".
- Dagnumret är sticky → man tappar aldrig vilken dag man tittar på mitt i en full cell.

**4. Roller** (parallell ström, se separat rapport) — `staff` släpps in i kalendern +
kunder, spärras från systemytorna. Serversidan är sanningen, inte en gömd nav-länk.

### Grönt just nu
```
tsc --noEmit          0 fel
tester                1036 passed / 85 filer   (var 948 → +88)
vakt-bransch          0 nya, 59 i baseline
```

### Ändrade filer
```
NY   supabase/migrations/0062_staff_color.sql
NY   lib/admin/staff-colors.ts + .test.ts
NY   lib/admin/stats.ts + .test.ts
NY   app/(admin)/admin/statistik/{page,loading}.tsx
NY   components/admin/stats.module.css
ÄND  lib/admin/data.ts            (staffDay → color)
ÄND  lib/admin/actions.ts         (updateStaff → color, hex-validering)
ÄND  components/admin/CalendarBoard.tsx  (colorOf, BookingBlock, MonthGrid, MonthBooking)
ÄND  components/admin/calendar.module.css (.block --bk, .monthCell scroll, .mBk*)
ÄND  components/admin/StaffRoster.tsx     (ColorPicker)
ÄND  app/(admin)/admin/personal/page.tsx  (color genom)
ÄND  app/(admin)/admin/bokningar/page.tsx (color genom)
ÄND  packages/db/types.ts                 (staff.color)
```

### Codex-granskning → åtgärdat
Codex granskade färg-/månadsvy-koden och hittade fem fynd. Fyra fixade:
1. **MEDEL — jag bröt min egen regel.** Vecko- och månadsvyn saknar resurskolumner, så
   där var färgen ENDA bäraren av "vems tid?". Fix: personens initialer på kortet
   (`.blockWho` / `.mBkWho`) → färgen är en genväg, inte det enda svaret.
2. **MEDEL — statusikonen försvann i små block** (< 34 px) trots att kommentaren lovade
   motsatsen. Fix: ikonen renderas nu även i `tiny`-läget.
3. **MEDEL — `.mBkFlag` var `position:absolute` utan `position:relative` på `.mBk`** →
   pending-ikonen kunde hoppa ur kortet. Fix: relative på kortet.
4. **LÅG — migration 0062:s constraint-koll matchade bara `conname`.** Constraint-namn
   är unika per tabell, inte globalt → vakten kunde ha hoppats över. Fix: `conrelid`.
5. **LÅG — `placeOverlaps` är O(n²) per resurs och dag.** EJ åtgärdad: n = bokningar per
   person och dag (< 30 i praktiken). Tas om belastningstestet visar att det biter.

### Kvar (i tur och ordning)
- [ ] `no_show`-status: DB + kalender-knapp "Uteblev" → statistikens uteblivna-tal
      räknar sig självt så fort statusen finns (redan förberett i `stats.ts`)
- [ ] Belastningstest: race conditions, dubbelbokning, samtidiga uppdateringar
- [ ] E2E-sviten (`calendar-clickbudget.spec.ts`) — skriven, aldrig körd
- [ ] L3: C-01…C-08 (Inställningar + städ) enligt IMPLEMENTATIONSPLAN.md
- [ ] Bransch-generalitet: kalendermotorn mot florist + ateljé, noll kodforkar

### Idéer som dök upp under arbetet
- **Färgen kan bära mer än person.** Ett läge där färgen istället kodar TJÄNST
  (klipp/färg/behandling) skulle svara på "hur ser dagens mix ut?" — samma rutnät,
  annan fråga. Billigt: `colorOf` är redan en funktion, byt bara vad den slår upp på.
- **Månadsvyns "+N fler" är ett tapp.** Cellen rullar redan; taket på 8 är godtyckligt.
  Mät hur ofta det slår i taket i en riktig salong innan vi finslipar.
- **Uteblivna kunder saknas i hela systemet** — inte bara i statistiken. Det är en
  RIKTIG kostnad för en salong och Wavy räknar den. Bör bli en egen liten goal.
- **Beläggningsgraden ljuger om ingen lagt in arbetstider** (faller tillbaka på
  8h/dag). Onboardingen borde tvinga fram arbetstider innan statistiken visas.
