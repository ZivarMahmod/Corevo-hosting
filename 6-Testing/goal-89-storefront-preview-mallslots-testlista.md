# Goal 89 — acceptanslista

## Förutsättningar

- Testa i isolerad localhost/previewmiljö.
- Produktion och produktionsdata ska vara orörda.
- Använd samma branch för kod, tester och resultat.
- Testa minst en tenant med `booking=live` och minst en tenant där en modul är
  `paused`, `draft` eller `off`.

## A. Katalog och routekontrakt

- [ ] Katalogen är React-fri och kan läsas av både preview och publik layout.
- [ ] `booking`, `shop`, `blogg`, `kurser`, `offert`, `presentkort`,
  `lojalitet` och `galleri` har definierad route, etikett och fallbackregel.
- [ ] Okänd modul eller ogiltig route ger ingen exception och ingen död länk.
- [ ] En modul i `draft` eller `off` exponeras inte publikt.
- [ ] En modul i `paused` kan exponeras som stängd men kan inte utföra ny
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

- [ ] Kompatibilitetsdiffen visar skillnad mellan aktiv mall, vald mall och
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

- [ ] Fokuserade Vitest-tester för katalog, states, navigation, CTA och fallback.
- [ ] Fokuserade tester för mallbyte/kompatibilitetsdiff.
- [ ] Relevant read-only browseracceptans för preview/publik paritet.
- [ ] Full webbtest från `5-Kod/`.
- [ ] Typecheck från `5-Kod/`.
- [ ] Lint från `5-Kod/`.
- [ ] Produktionsbuild från `5-Kod/`.

## Godkännande

Goal 89 är inte klart förrän alla blockerande punkter ovan är gröna och
resultaten är inskrivna här med datum, branch och testkommandon. Därefter kan
goal-filen flyttas till `2-Byggplan/klart/02-ytor/storefront/`.
