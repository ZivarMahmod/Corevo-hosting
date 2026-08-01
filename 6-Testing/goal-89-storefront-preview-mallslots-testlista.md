# Goal 89 — acceptanslista

Status 2026-08-02: **kodkontroller gröna; aktuell inloggad browseracceptans
återstår i Goal 86**. Den dubbla klar-filen är borttagen; den aktiva goal-filen
är enda statuskälla tills browserkontrollen är godkänd.

## Förutsättningar

- Testa i isolerad localhost/previewmiljö.
- Produktion och produktionsdata ska vara orörda.
- Använd samma branch för kod, tester och resultat.
- Testa minst en tenant med `booking=live` och minst en tenant där en modul är
  `paused`, `draft` eller `off`.

## A. Katalog och routekontrakt

- [x] Katalogen är React-fri och kan läsas av både preview och publik layout.
- [x] `booking`, `shop`, `blogg`, `kurser`, `offert`, `presentkort`,
  `lojalitet` och `galleri` har definierad route, etikett och fallbackregel.
- [x] Okänd modul eller ogiltig route ger ingen exception och ingen död länk.
- [x] En modul i `draft` eller `off` exponeras inte publikt.
- [x] En modul i `paused` kan exponeras som stängd men kan inte utföra ny
  affärsåtgärd.

## B. Samma data i preview och publik storefront

- [ ] Samma tenant, theme och module states ger samma modul-teasers i preview
  och publik sida.
- [ ] Samma tenant, theme och module states ger samma navlänkar.
- [ ] Samma tenant, theme och module states ger samma primära CTA-href eller
  ingen CTA.
- [ ] Preview skriver inte publicerat innehåll när sidan läses eller växlas.

## C. Fasta mallslots och fallback

- [ ] En mall med specialvy renderar specialvyn i rätt fasta slot.
- [ ] En mall utan specialvy renderar den gemensamma generiska modulvyn.
- [ ] En otillgänglig modul renderas inte i en publik slot.
- [ ] Saknad specialvy eller saknad fallback ger ingen server exception.
- [ ] Det finns ingen fri drag-and-drop-positionering i Goal 89.

## D. Booking, shop och pausläge

- [ ] `booking=live` visar boknings-CTA och rätt publika bokningsväg.
- [ ] `booking=paused` visar pausad/stängd status och nekar ny bokning.
- [ ] `booking=draft|off` visar ingen aktiv bokningsväg.
- [ ] `shop` följer befintlig commerce/readiness-gate i både preview och publik
  sida.
- [ ] Preview visar inte en CTA som den publika routingen skulle neka.

## E. Mallbyte och kompatibilitet

- [x] Kompatibilitetsdiffen visar skillnad mellan aktiv mall, vald mall och
  tenantens befintliga slots.
- [ ] `Behåll nuvarande innehåll` behåller tenantens publicerade copy och
  mediareferenser.
- [ ] `Använd mallens innehåll` är ett uttryckligt val och påverkar endast de
  tillåtna mallinnehållsytorna.
- [ ] Bokningar, kunder, produkter, artiklar, presentkort, lojalitetsdata och
  annan verksamhetsdata är oförändrade efter mallbyte.
- [ ] Ett inkompatibelt mallbyte stoppas eller kräver ett uttryckligt säkert
  val; det får inte tyst kasta data.
- [ ] Tenant och partner kan inte använda root-only mallbyte.

## F. Mekaniska tester

- [x] Fokuserade Vitest-tester för katalog, states, navigation, CTA och fallback.
- [x] Fokuserade tester för mallbyte/kompatibilitetsdiff.
- [ ] Relevant read-only browseracceptans för preview/publik paritet.
- [x] Full webbtest från `5-Kod/`.
- [x] Typecheck från `5-Kod/`.
- [x] Lint från `5-Kod/`.
- [x] Produktionsbuild från `5-Kod/`.

## Godkännande

Goal 89 är inte klart förrän alla blockerande punkter ovan är gröna och
resultaten är inskrivna här med datum, branch och testkommandon. Därefter kan
goal-filen flyttas till `2-Byggplan/klart/02-ytor/storefront/`.

## Senaste automatiska kontroll

- Datum: 2026-08-02.
- Riktad frontend- och kontraktssvit: **8 filer / 177 tester gröna**.
- Typkontroll: **grön**.
- Full webbsvit: **398 filer / 3 024 tester gröna**.
- Lint: **0 fel / 7 befintliga varningar**.
- Produktionsbuild: **grön**, inklusive typkontroll och 11 statiska sidor.
- Verklig läsande FreshCut-smoke: startsida, tjänster, team och kontakt gav
  HTTP 200 på både 1360 och 390 px, utan overflow, browserfel eller dolda
  menyknappar. Inloggad preview/publik-paritet återstår i Goal 86.
