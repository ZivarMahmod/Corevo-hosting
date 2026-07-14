# SPEC — Corevo Kund-admin (ny UX, per-yta funktionsinventering)

> Facit för vad varje yta/knapp/kontroll GÖR i `design/Kund-admin.dc.html`. Läses ihop med `README.md`
> (IA, tokens, leveransformat). Källa vid krock: låsta besluten i
> `3-Bakgrund-Research/wavy-business-ux-analys-2026-07-13/codex/00`–`04` > detta dokument.

## Routes (state + hash-sync, prop `startRoute`)

1. **Översikt** `/` (startRoute: `oversikt`)
2. **Kalender** `/kalender` (startRoute: `kalender`)
3. **Kunder** `/kunder` (startRoute: `kunder`)
4. **Redigera sidan** `/redigera` — entry-yta, inte editorn själv
5. **Inställningar** `/installningar/<kategori>` (9 kategorier, default `foretag`)
6. **Login** `/login` (startRoute: `login`) — fristående, utan toppnav

Topbar (alla routes utom login): verksamhetsmark (färgdot + "Källa Hårspa" + "via Corevo" i small/`--ink3`) ·
5 huvudval (aktiv = accentmarkerad) · ⌘K-sök (bokningar idag + kunder + destinationer — ALDRIG andra tenants) ·
platsväljare DOLD (Källa har 1 plats — rita den som kommenterad variant i en detaljvy) · tema-switch
(persistent, `localStorage('cv_theme')`) · "Öppna min sida ↗" (mono, `kalla.corevo.se`) · avatar-meny
(Maja Lindqvist, maja@kallahar.se · Konto och säkerhet · Logga ut).

Mobil (<768px): huvudval → hamburgermeny med namngiven aktuell yta i topbaren; primärhandling per yta
nåbar med tumme; drawer = helskärm.

---

## Översikt `/`

- **Header:** "Måndag 14 juli" + verksamhetsnamn. Primärknapp **"Öppna kalendern"** (accent, går till `/kalender`).
- **Dagens rad (StatCard ×3):** Bokningar idag `8` (varav `2` obekräftade — klickbar fotnot) · Nästa besök
  `10:30 · Klipp & form · Anna Ek · hos Vera` · Beläggning idag `74%`.
- **Kommande idag** — kompakt lista (max ~6 rader + "Visa alla i kalendern"): tid (mono) · kund · tjänst ·
  resurs · statusbadge. Rad-klick → öppnar kalendern på den bokningen (drawer öppen).
- **Kräver uppmärksamhet** — kort med obekräftade/ändrade/problem-bokningar; varje rad har EN konkret
  åtgärdsknapp ("Bekräfta", "Öppna"). Tomt läge: "Inget kräver din uppmärksamhet" + ✓-ton.
- **Personal idag** — radlista: namn + arbetstid `09–17` (mono) + status (arbetar/frånvaro/ledig).
- **Driftvarningar** — visas BARA vid verkligt problem (t.ex. "Publik bokning är pausad → Bokningsregler").
  Ingen HealthPill-rad med döda system.
- **Sekundär rad:** veckoöverblick (7 mini-staplar, bokningar/dag) · publiceringsstatus för publika sidan
  (Publicerad/Opublicerade ändringar → länk till Redigera sidan) · betalstatus om aktiv.
- **INTE här:** full kalender, inställningsfält, KPI:er för avstängda moduler.

## Kalender `/kalender`

**Verktygsrad:** ‹ Idag › · datumväljare · Dag/Vecka-switch · resursfilter (chips per personal, alla på
default) · snabbhopp "+1v +2v +4v" · **"+ Ny bokning"** (accent) · "Blockera tid" (sekundär).

**Grid (dagvy):** tidsaxel vänster 08–19 (mono, 24h ALLTID) · stabil kolumn per personal (namn i header,
färgdot förstärker — identitet bärs av namnet) · arbetstid vit yta, utanför arbetstid skuggad `--sf2` ·
nu-linje · bokningskort: position=start, höjd=varaktighet, innehåll = tid + kund + tjänst + statusikon ·
blockering: diagonalmönster + 🚫-ikon + orsakstext (skiljs från bokning med MER än färg) · obekräftad
bokning: streckad kant + ⚠-chip · lediga luckor visas som klickbara tysta ytor.

**Veckovy:** 7 dagar × komprimerade staplar, resursfilter kvar; klick på dag → dagvy.

**4 designade tillstånd:** normal (8 bokningar, 1 blockering, 1 obekräftad) · tom dag (ärligt tomläge +
"+ Ny bokning") · tät dag (12+ bokningar, överlapp inom kolumn löses sida-vid-sida) · fel (laddningsfel-
banner + "Försök igen"; kalendern lovar aldrig data den inte har).

**Cellklick (ledig yta)** → bokningsdrawer i skapa-läge med datum/tid/resurs förifyllda.
**Kortklick (bokning)** → drawer i läs/ändra-läge. **Blockering-klick** → blockeringsdrawer.

## Bokningsdrawer (samma komponent, två lägen — höger på desktop, helskärm mobil)

### Skapa-läge
1. **Tjänst** — sökbar lista (kategori · namn · längd · pris). Vald tjänst = chip; längd+pris autofylls.
2. **Tid/resurs** — förifyllt från cellklick (visas som redigerbar rad, ALDRIG ominmatning); vid
   tjänst-först-flöde: endast giltiga luckor erbjuds som klickbara chips per resurs.
3. **Kund** — EN kontroll: skriv namn/e-post/telefon → matchningar visas → ingen träff = samma inmatning
   blir ny kund. Endast **namn obligatoriskt**. Dubblettvarning före ny kund skapas ("Anna Ek finns redan —
   använd befintlig?").
4. **Anteckning** — två fält, tydligt märkta: "Intern (visas aldrig för kund)" · "Kundsynlig".
5. **Meddelande till kunden** (notisval, radio):
   `○ Skicka inget · ○ E-post till anna@… · ○ SMS till 070… · debiteras · ○ E-post + SMS · debiteras`
   — val utan kontaktuppgift/transport = disabled MED förklaringstext. SMS-raderna märkta "senare tillval"
   i fas 1.
6. **Spara** → knapp visar sparar-spinner → serverbekräftad → drawer stängs, kortet landar i grid med
   status. Aldrig optimistiskt "klart" före serversvar.

### Befintlig bokning-läge
Header: kund + tjänst + statusbadge + källa ("Bokad via publika sidan tis 8 juli"). Kropp: datum/start/
slut/tidszon · plats+resurs · kunduppgifter (länk → kundens kort i `/kunder`) · tjänst+längd+pris ·
anteckningar (intern/kundsynlig) · notishistorik med leveransstatus ("Bekräftelse · E-post · levererad") ·
betalstatus-badge om aktiv · **Historik** (expanderbar: skapad/ändrad/av vem).

Handlingar: **Ändra** (fälten blir redigerbara) · **Flytta** (explicit knapp → välj ny tid/resurs i
mini-vy; drag-drop i grid finns OCKSÅ men är aldrig enda vägen) · **Avboka** (TwoStepDanger) ·
**Markera genomförd/uteblev** · **Skicka notis igen** (varnar för dubblett).

**Flytta-bekräftelse (modal, exakt konsekvenstext):**
```
Flytta Klipp & form för Anna Ek
från måndag 10:30 hos Vera
till måndag 11:30 hos Ines?
```
Konflikt servervalideras före; vid konflikt ligger originalet kvar orört + meddelande om vem/vad ändrats.

**Avboka:** beskriver bokningen · visar om notis skickas · "Tiden frigörs när servern bekräftat" ·
historik+källa behålls · ångra/återställ-väg visas efteråt (30-dagars mönster).

**Konflikt-tillstånd:** banner i drawern "Ines sparade en ändring 14:02 — läs in på nytt", användarens
inmatning behålls.

## Blockeringsdrawer

Resurs+start förifyllda från cell · slut/längd (60 min default) · orsak (fritext + snabbval Rast/Frånvaro/
Möte) · upprepning: ingen · varje dag · vardagar · varje vecka · varannan vecka · årligen · spara.
Serieändring: explicit val **"Endast denna" / "Denna och framåt"** — bakåt aldrig.

## Kunder `/kunder`

*(Föreslagen nivå — ej låst i besluten, Zivar bekräftar vid granskning.)*
StatCard ×4: Kunder `96` · Med bokning · Återkommande · Nya denna månad. Sök (namn/e-post/telefon).
Radlista: namn · Återkommande-badge · "X bokningar · Y genomförda · senast 2 juli" · kontakt. Expansion →
bokningshistorik-tabell (Datum/Tjänst/Personal/Status/Pris) + kontaktuppgifter + "Boka in" (→ kalendern
med kund förvald). Nås även via kundlänk i bokningsdrawern.

## Redigera sidan `/redigera`

Entry-yta, INTE editorn: förhandskort av publika sidan (skärmdump-platta + `kalla.corevo.se` i mono) ·
publiceringsstatus (Publicerad · Opublicerade ändringar · Utkast) · "Öppna redigeraren" (accent) ·
"Visa publika sidan ↗". Inget mer.

## Inställningar `/installningar/<kategori>`

Vänster: kompakt kategorilista (9 rader, aktiv accentmarkerad; mobil: dropdown-väljare). Höger: kategorins
innehåll. Global toppnav kvar. Varje kategori: rubrik + en-radsförklaring + status + få primära handlingar +
synligt sparresultat (SaveBar-mönster vid dirty).

| # | Kategori | Nyckelfält/kontroller (detalj i codex/03) |
|---|---|---|
| 1 | Företag och profil | namn, org-/faktureringsuppgifter, tidszon (dropdown), språk, primär plats, kontaktperson, status. Callout-länk: "Publika texter redigeras i Redigera sidan →" |
| 2 | Personal och behörigheter | radlista personal (namn/titel/aktiv/bokningsbar) · roll (ägare/anställd) · tjänster resursen utför (chips) · notifieringspreferens · "Bjud in" · ta bort åtkomst (TwoStepDanger + text "historik behålls") |
| 3 | Tjänster | grupperat per kategori: namn, kundbeskrivning, längd, pris (mono), utförs av (chips), publikt bokningsbar-toggle, ordning (drag), aktiv-toggle, "+ Lägg till tjänst" |
| 4 | Öppettider och schema | basöppettider veckogrid · personalschema per resurs · stängda dagar · avvikelser/frånvaro · länk "snabbundantag gör du direkt i kalendern" |
| 5 | Bokningsregler | publik bokning På/Pausad/Av (begripliga lägen m. konsekvenstext) · bokningsfönster fram · minsta framförhållning · avbokningsgräns · slot-steg · direktbekräftelse vs godkännande · stängt-meddelande |
| 6 | Notiser och SMS | fas 1: e-post-togglar (bekräftelse/ombokning/avbokning/påminnelse) + avsändare/reply-to + historik. SMS-sektion ritad men disabled + "Senare tillval"-badge |
| 7 | Betalningar och integrationer | Stripe-kort (status charges/payouts) · integrationshälsa · varning om publik betalväg ej redo. Inaktiv integration = inget steg i bokningsflödet |
| 8 | Konto och säkerhet | e-post · lösenordsbyte · TOTP-aktivering (QR + återställningskoder-en-gång-vy, märkt "kommande goal" ok) · aktiva sessioner (enhet/senast aktiv/Logga ut) · "Logga ut alla andra" · säkerhetslogg |
| 9 | Data, export och integritet | export kunder/bokningar (CSV, riktig Blob) · beskriver innehåll + kräver bekräftelse · integritetsinfo/DPA-länkar · rättelse/radering-begäran · auditåtkomst enligt roll |

**Ingen Statistik-kategori.** Ingen global publicera-knapp.

## Login `/login`

E-post + lösenord · fel = inline, generiskt ("Fel e-post eller lösenord") · "Glömt lösenord" · efter login →
säker intern returväg (aldrig extern redirect) · session består över sidbyten/återöppning · utgången
session → login med retur. TOTP-steg som variant-vy (kod-input + "använd återställningskod").

## Systemtillstånd (rita per yta)

laddar (skeleton) · tomt (ärligt + primär åtgärd) · fel (+ Försök igen) · sparar (spinner i knappen) ·
sparat (toast nere höger) · opublicerade ändringar (badge) · publicerat/live · konflikt (drawer-banner).

## Mockdata-nycklar (state)

`business` (Källa Hårspa, kalla.corevo.se, Göteborg) · `user` (Maja Lindqvist, ägare) · `staff` ×4
(Vera/Ines/Noor/Alma, arbetstider, färger) · `services` ×7 (README §3 — exakta namn/priser/längder) ·
`bookingsToday` ×8 (2 obekräftade, 1 genomförd, blandade resurser, en överlapp-nära) · `blocks` ×1
(Vera, Rast 12:00–12:45) · `customers` ×96-metadata + ~8 utskrivna (Anna Ek m.fl.) · `weekOverview` ×7 ·
`notifLog` · `sessions` ×2 · `auditRows`. Allt svenskt, 24h-tid, kronor utan decimaler.
