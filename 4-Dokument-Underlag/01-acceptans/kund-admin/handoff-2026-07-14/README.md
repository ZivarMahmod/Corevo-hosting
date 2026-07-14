# HANDOFF — Corevo Kund-admin (nytt skal + kalenderarbetsbord)

> Till: **Claude Design** (producerar `design/*.dc.html`), sen Claude Code i repot **ZivarMahmod/Corevo-hosting**.
> Uppgift: designa kund-adminens (`booking.corevo.se/admin`) nya skal, Översikt och kalenderarbetsbord.
> Detta är **Steg 0** i `3-Bakgrund-Research/wavy-business-ux-analys-2026-07-13/codex/06-byggordning-och-acceptans.md`
> — inget UI-kod skrivs förrän paketet här är klart och låst.

---

## 0. Vad det här är

Produktbesluten är redan **låsta med Zivar 2026-07-14** i:
`3-Bakgrund-Research/wavy-business-ux-analys-2026-07-13/codex/00-LAS-MIG-FORST.md` + `01`–`04`.

Det här paketet (README + SPEC) översätter de besluten till en byggbar brief. `SPEC.md` = funktionsinventering
per yta. Det som saknas fortfarande är **den visuella filen**: `design/Kund-admin.dc.html` — en hi-fi
klickbar prototyp i samma `.dc.html`-format som `../../super-admin/handoff-2026-07-13/`. Den filen finns INTE
än. Ge detta README + SPEC.md till Claude Design i sin helhet för att få den producerad.

**Källa som gäller vid krock:** de låsta besluten (`codex/00`–`04`) > det här paketet > gammal kod.
Ignorera `4-Dokument-Underlag/01-acceptans/kund-admin/*.jsx` (rotnivå, utan datum) — det är det **gamla**
kund-adminskalet som just denna omdesign ersätter, inte facit.

---

## 1. Informationsarkitektur — de fem huvudvalen

Mörkgrön permanent sidebar tas bort. Ersätts av horisontell toppnav, samma komposition som superadmins:

| Huvudval | Roll |
|---|---|
| **Översikt** | startyta — sammanfattar, gör inga transaktioner |
| **Kalender** | den operativa arbetsytan — ett klick från Översikt, ingen mellanvy |
| **Kunder** | egen yta, men även nåbar inifrån bokningsdrawern |
| **Redigera sidan** | öppnar sajtbyggaren (finns redan i kod) — egen huvudpunkt, inte gömd |
| **Inställningar** | egen lokal kategorinavigation under, 9 kategorier, global toppnav ligger kvar |

Topbar-innehåll: verksamhetsidentitet (namn + Corevo-relation, **inte** "Superadmin") · de 5 huvudvalen ·
global sök/kommandopalett (⌘K, samma mönster som superadmin) · platsväljare **om** verksamheten har fler än
en plats · tema-/visningskontroll där relevant · konto-/profilmeny · tydlig länk till publik sida.

Kund-admin ser **bara sin egen tenant**. Superadminens cross-tenant-kommandon (⌘K-träffar på andra kunder,
plattformsinställningar osv.) får aldrig synas eller läcka in här — detta är rollgränsen, inte en stilfråga.

Källa: `codex/01-informationsarkitektur-och-adminskal.md` (hela filen, låst).

---

## 2. Designtokens — ärvs verbatim från superadmin

**Samma produktfamilj = samma tokens.** Kopiera exakt från
`4-Dokument-Underlag/01-acceptans/super-admin/handoff-2026-07-13/handoff-superadmin/README.md` §2–§3:

- Ljust/mörkt CSS-variabelpar (`--bg`, `--sf`, `--sf2`, `--sf3`, `--ink`, `--ink2`, `--ink3`, `--line`,
  `--line2`, `--acc`, `--on-acc`, `--ok`, `--warn`, `--bad`, `--info`, skuggor `--sh`/`--sh2`) — exakta hex
  ligger i källfilen, återges inte här för att undvika två sanningar att hålla synkade.
- Tre kuraterade accenttoner (Bläck default, Skogsgrön, Djup teal), tema-medvetna par.
- Typografi: Instrument Sans (UI) + IBM Plex Mono (belopp/tider/koder/slugs). Samma skala (eyebrow 11px,
  H1 26px, kortrubrik 14–15px, brödtext 13–13.5px, KPI-tal 30px).
- Formspråk: kortradius 14px, knapp/input-radius 8–10px, pill-radius 999px, samma fokusring, samma
  tabellstil (header 11px versaler, radhöjd ~48px, siffror högerställda i mono).
- Hela komponentbiblioteket i superadmin-READMEts §3 (PageHead, StatCard, PillTabs, SegmentedControl,
  Badge, Dropdown, CommandPalette, Toast, SaveBar, TwoStepDanger, HealthPill) återanvänds rakt av.
  **Bygg inte nya varianter av dessa** — om kund-admin behöver något komponentbiblioteket saknar
  (t.ex. bokningsdrawer, dagkalender-grid), lägg till det som en NY komponent i samma stilspråk, inte
  en omtolkning av en befintlig.

Det som ÄR nytt i kund-admin och alltså inte finns i superadmin-paketet: dagkalender-grid, bokningsdrawer,
notisval-kontrollen, blockeringsformulär, lokal inställningsnavigation. Dessa specas i §4 nedan.

---

## 3. Mockdata — samma tenant som superadmin-paketet

Använd **samma exempeltenant** som redan finns i `super-admin/.../SPEC.md` för kontinuitet mellan paketen:

**Källa Hårspa** (salong, Göteborg) — ägare Maja Lindqvist, tema kalla. Personal: Vera Holm
(Grundare/terapeut), Ines Falk, Noor Sand, Alma Öst. Tjänster: Källritualen 1450 kr/90 min,
Hårbotten-ritual 850 kr/45 min, Klipp & form 745 kr/60 min, Luggputs 195 kr/15 min, Färgritual 1895 kr/150 min,
Slingor 1595 kr/120 min, Olje-kur 495 kr/30 min. Bokningar 214/genomförda 187, 96 slutkunder.

Hitta på realistiska bokningar för en enskild dag (blandning av bekräftat/obekräftat/genomfört, minst en
krock-nära lucka, minst en blockering) — men hitta INTE på nya tjänster, priser eller personalnamn.

---

## 4. Kund-admin-specifika ytor att designa

### 4.1 Adminskal (alla tillstånd)

Desktop + responsivt (huvudnav blir meny/kompakt växlare på mindre skärmar, aktuell yta alltid namngiven,
viktigaste handlingar nåbara med en hand, inga hover-beroende funktioner, 200% zoom fungerar).

### 4.2 Översikt

**Ska visa:** datum + verksamhetskontext · dagens bokningsantal + nästa besök · kommande idag i kompakt
lista · obekräftade/ändrade/problematiska bokningar · personal-/resursstatus idag · en tydlig primärknapp
till Kalender · länk till publik sida · konfigurations-/driftvarningar. Sekundärt: enkel veckoöverblick,
tjänste-/bokningsmix, publiceringsstatus, betalstatus om relevant.

**Ska INTE visa:** full dagkalender (det är dubblering av Kalender-ytan) · alla inställningsfält · döda
KPI:er för moduler kunden inte har · flera knappar som gör samma sak.

### 4.3 Kalender — huvudarbetsbordet

**Geometri:** tid vertikalt, personal/resurser i stabila kolumner, position=starttid, höjd=varaktighet.
Bokning vs blockering skiljs med mer än färg (ikon/mönster/text också). Visa utan att öppna något:
dag+vecka, plats, personal/resurser, arbetstid vs ej tillgänglig, lediga luckor, start/slut, kund,
tjänst, status, obekräftad-varning.

**Vyval:** idag · föregående/nästa dag · datumväljare · dagvy · veckovy/kompakt veckoöversikt ·
platsväljare · resursfilter · snabbhopp flera veckor framåt.

**4 kalendertillstånd att designa explicit:** normal (blandad beläggning) · tom dag · tät dag (many overlaps,
testar kolumnbredd/scroll) · feltillstånd (laddningsfel/konflikt).

**Skapa bokning-flödet (rita som klicksekvens):** välj tjänst ELLER klicka ledig cell → systemet behåller
datum/starttid/plats/resurs → tjänstens längd+pris fylls i → endast giltiga luckor erbjuds → sök-eller-skapa
kund i SAMMA kontroll (namn enda obligatoriska fält, e-post/telefon frivilliga) → notisrad visar exakt vad
som skickas → spara → kalendern visar bekräftad serverstatus.

### 4.4 Bokningsdrawer (skapa OCH befintlig — samma yta, samma struktur)

**Visar:** datum/start/slut/tidszon · plats+resurs · kunduppgifter · tjänst(er)+längd+pris · intern
anteckning vs kundsynlig info (tydligt separerade, olika visuell behandling) · källa+historik ·
notis+leveransstatus · betalstatus om aktiv.

**Handlingar på befintlig bokning:** ändra kund/tjänst/anteckning · flytta tid · flytta resurs (drag-drop
PLUS en explicit "Flytta"-knapp för tangentbord/touch — rita båda) · avboka · markera uteblev/genomförd ·
se historik · skicka notis manuellt.

**Flytta-bekräftelse — exakt copy-mönster (rita en variant):**
```
Flytta Herrklippning för Anna Andersson
från tisdag 10:00 hos John
till tisdag 11:00 hos Aziz?
```

**Notisval-kontroll (rita som del av drawern, före spara):**
```
Meddelande till kunden
○ Skicka inget
○ E-post till anna@example.se
○ SMS till 070… · debiteras
○ E-post + SMS · debiteras
```
Val utan kontaktuppgift/aktiv transport = avstängda med synlig förklaring, inte bara gråa.

**Drawer-tillstånd att designa:** tom/skapa-läge · befintlig bokning · sparar · sparat · konflikt
(annan användare hann före — visa vem/vad, behåll din inmatning).

### 4.5 Blockera tid

Samma väljare/kontext som bokning, egen kategori. Formulär: cell/intervall förifyllt → resurs+start
förifyllda → orsak/beskrivning → upprepning (ingen/enkel/återkommande) → spara. Vid ändring av en serie:
explicit val mellan "bara denna" och "denna och framåt" — historik skrivs aldrig om tyst.

### 4.6 Kunder (ytan)

**Detaljnivå ej låst i besluten** — 01 säger bara att ytan ska finnas och vara nåbar både fristående och
inifrån bokningsdrawern. Föreslagen modell (återanvänd, hitta inte på nytt): superadmins kundkort→Kunder-flik
— stats-rad (kunder/med bokning/återkommande/nya denna månad) + sökbar/expanderbar radlista (namn,
återkommande-badge, "X bokningar · Y genomförda · senast…", kontakt) → bokningshistorik vid expansion.
Markera i mockupen att det här ledet är ett förslag, inte ett låst krav — Zivar bekräftar vid granskning.

### 4.7 Redigera sidan (entry-punkt, inte hela sajtbyggaren)

Sajtbyggaren finns redan i kod (`SiteEditor`, `tenant_settings.copy/branding`). Designa bara: hur huvudvalet
ser ut i nya skalet, ingångskortet/länken, och hur sparat/opublicerat/publicerat-status syns härifrån.
Rita INTE om själva sajtbyggarens editor-UI — det är utanför detta paket.

### 4.8 Inställningar — 9 kategorier, lokal navigation

Kompakt vänsterlista (desktop) / kategoriväljare (mobil), global toppnav ligger kvar. Byte mellan
kategorier kastar inte ut användaren ur Inställningar.

1. **Företag och profil** — namn, org/faktureringsuppgifter, tidszon, standardspråk, primär plats,
   intern kontakt, verksamhetsstatus. (Publika texter/hero/layout redigeras INTE här — länk till
   Redigera sidan istället.)
2. **Personal och behörigheter** — personal/resurser, kontakt, aktiv/inaktiv, roller/åtkomst, vilka
   tjänster resursen kan utföra, notifieringspreferenser, inbjudan/borttagning (borttagen åtkomst
   raderar aldrig historiska bokningar).
3. **Tjänster** — kategorier, namn+kundbeskrivning, standardlängd, pris, utförande resurser, publik
   bokningsbarhet, ordning, aktiv/inaktiv.
4. **Öppettider och schema** — basöppettider, personal-/resursschema, stängda dagar, avvikelser,
   frånvaro, koppling till kalenderblockeringar.
5. **Bokningsregler** — publik bokning på/av/pausad, kundgrupper, framförhållning (max/min),
   avbokningsgräns, slot-steg, godkännande vs direktbekräftelse, meddelande när stängt. Presentera som
   begripliga lägen, inte råa flags.
6. **Notiser och SMS** — fas 1: e-postbekräftelse, e-post vid ombokning/avbokning, e-postpåminnelse,
   avsändare/reply-to, historik. SMS-fälten (avsändare, kanal per händelse, kostnadstak) ritas men
   tydligt märkta som senare/inaktiverade — SMS är inte fas 1.
7. **Betalningar och integrationer** — Stripe-koppling, betalstatus, integrationshälsa, varning när
   publik betalväg inte är redo.
8. **Konto och säkerhet** — e-post, lösenordsbyte, TOTP-aktivering, aktiva sessioner/enheter,
   utloggning av andra enheter, säkerhetslogg, återställning.
9. **Data, export och integritet** — export, datalagringsinfo, biträdesavtal-länkar, rättelse/radering-
   begäran, audit-/historikåtkomst enligt roll. Riskfyllda exporter kräver tydlig bekräftelse.

**Statistik ligger INTE här** (varken som kategori 10 eller undangömd) — hör till Översikt/framtida
Insikter-yta. Detta är ett medvetet avsteg från Wavy, inte en lucka.

**Spara vs publicera — håll isär visuellt:** intern drift (schema/personal/tjänster/regler) har egen
serverbekräftelse. Sajtbyggaren har separat sparat-utkast/opublicerat/publicerat-status. **Ingen global
"Publicera ändringar"-knapp som blandar de två.**

### 4.9 Inloggning och session

E-post+lösenord, ingen SMS-inloggning. Beständig session (stäng/öppna appen utan ny inloggning så länge
sessionen gäller). Utgången session → login med bevarad säker returväg. TOTP som framtida 2FA (rita
aktiveringsflödet + återställningskoder-en-gång-vy, men markera tydligt att det kan komma i senare goal).
Konto och säkerhet (§4.8 kat. 8) visar sessionslista + logga ut andra enheter.

---

## 5. Systemtillstånd som krävs överallt

Varje yta i paketet ska ha explicita, visuellt skilda versioner av: laddar · tomt · fel · sparar · sparat ·
opublicerade ändringar · publicerat/live · offline/osäker anslutning (där relevant). En handling får
aldrig se sparad/publicerad/skickad ut innan servern bekräftat det — rita alltså in en synlig
väntan-på-server-mikrostatus där det är relevant (särskilt bokningsdrawern och inställningar).

---

## 6. Tillgänglighet — mätbart, inte "känns bra"

Tangentbord genom hela kalender+drawer · synligt fokus · Enter/Space på kontroller · Escape + korrekt
fokusåterställning i drawer/dialog · 200% zoom utan förlorade handlingar · skärmläsarbegripliga namn för
bokningar/tider · reduced motion · status uttrycks aldrig enbart med färg (bokning vs blockering,
success/warning/danger). Detta är uttryckligen **inte** vad Wavy gör bra — båda Wavy-analyserna flaggar
~0 landmärken, blockerad zoom och trasig tangentbordsnav som konkurrentens svaghet. Kopiera inte den.

---

## 7. Leveransformat

Samma `.dc.html`-format som `super-admin/handoff-2026-07-13/handoff-superadmin/design/Corevo Superadmin.dc.html`:
`<x-dc>`-wrapper, `<helmet>` med Google Fonts-länk + `<style>` (inkl. media queries för responsivt),
`sc-if`/`sc-for`/`{{ }}`-bindningar, `<script type="text/x-dc"><Component extends DCLogic></script>` med
mockdata från §3 i state. Route i state + hash-sync, en fil, en prop för `startRoute` (t.ex. `oversikt`,
`kalender`, `installningar/<kategori>`). Inget `support.js`-beroende krävs om filen inte bäddar in en
storefront-preview (kund-admin gör det inte — "Redigera sidan" är bara en entry-länk enligt §4.7).

**Filnamn:** `design/Kund-admin.dc.html`.

---

## 8. Acceptanskriterier (redan låsta, cross-ref)

Mät mot `codex/06-byggordning-och-acceptans.md` §"Acceptans per yta" (Adminskal/Översikt/Kalender/
Inställningar/Inloggning) och §"Wavy-migreringstest" (9 uppgifter en Wavy-van användare ska klara utan
träning). Design-paketet i sig verifieras inte mot dessa — de gäller den färdiga koden — men mockupen ska
göra det UPPENBART att varje krav går att uppfylla (t.ex. om ett kriterium är "avboka utan sidbyte" måste
mockupens flöde faktiskt visa det, inte anta att koden löser det senare).

---

## 9. Vad som INTE ingår i det här paketet

- Sajtbyggarens editor-UI (finns redan i kod, `SiteEditor`).
- SMS-leverantörsintegration (fas 2, eget goal per `codex/06` §Steg 7).
- Betalflödets UI utöver status-badge i drawer/Inställningar (betalmotorn finns redan).
- Superadminens egna ytor (rör inte `super-admin/`-paketet).
- Faktiska pixel-/hex-beslut som redan är låsta i §2 — inte omtolkningsbara, bara ärvda.

---

## 10. Nästa steg

1. Ge README.md + SPEC.md till Claude Design → få `design/Kund-admin.dc.html` producerad.
2. Zivar granskar mockupen mot §4 här + `codex/06` acceptanskriterier, låser den.
3. Detaljerad fil-för-fil implementationsplan skrivs (samma mönster som `BRIEF-TILL-CLAUDE-DESIGN.md`
   §5 "vad som händer med filen sen").
4. Första goal skapas: adminskal + Översikt (`2-Byggplan/goals/`).

Ingen kod skrivs från det här dokumentet direkt — det är input till designproduktionen, inte facit för
implementationen. Facit blir `design/Kund-admin.dc.html` när den finns.
