# Kundadmin · Universal toppbanner v2 — handoff-beskrivning

Fil: `Kundadmin Toppbanner v2.dc.html` — visar bannern i 5 lägen (standard, iPad, platsväljare, kontomeny, mobil/PWA).

## ⚠ VIKTIGT till dig som kodar (Claude Code)
EN universal banner-komponent som delas av ALLA flikar i kundadminen (Översikt, Kalender, Kunder, Redigera sidan, Inställningar) — bygg den en gång, använd överallt. Mockupen visar designmönstret; befintlig funktionalitet (Ctrl K-sök, platsfilter, tema-lägen auto/ljus/mörk) behålls fullt ut.

## Innehåll & ordning (desktop ≥1200)
`Logo (F + namn + VIA COREVO) · Flikar (aktiv = mörk pill) · [flex] · Sök "Sök kund, bokning…" + Ctrl K · [Platsväljare] · Öppna min sida ↗ · Mörkt läge-snabbval (◐) · Avatar`

## Beslut & logik
1. **INGA notiser/varningsprickar i bannern.** "Kräver uppmärksamhet" bor ENDAST i Översikten — bannern ska inte skapa stress. Lägg aldrig till badge-räknare här.
2. **Platsväljaren visas BARA när salongen har fler än en plats.** En plats = chippen renderas inte alls. Öppen meny: "PLATS — FILTRERAR ALLT", Alla platser + per plats, valet följer med till alla flikar (global state).
3. **Mörkt läge = snabbval i raden på dator/iPad** (◐-ikon, växlar auto → ljus → mörk, tooltip visar läget). På **mobil** bor valet i "Mer"-menyn — inte i toppraden.
4. **Kontomeny på avataren**: namn + e-post + roll, Mitt konto, Hjälp & support, Logga ut (röd). Enda stället för utloggning.
5. **Sökfältet säger vad det söker** ("Sök kund, bokning…") och öppnar samma globala Ctrl K-sök.
6. **"Öppna min sida ↗"** = kundens publika sajt i ny flik. Alltid synlig (kortas till "Min sida ↗" på iPad).

## Responsivt
- **Dator ≥1200**: allt ovan, höjd 60px.
- **iPad ~768–1199**: höjd 56px, flikarna kvar; sök → ikon (öppnar sök-overlay), "Min sida ↗" kortad, platsväljare → ◎-ikon, ◐ kvar.
- **Mobil <768 (PWA)**: toppraden slimmas till `Logo · [flex] · Sök-ikon · Avatar` (52px). **Flikarna flyttar till bottennav** (5 slots): Översikt · Kalender · **grön Ny bokning-FAB i mitten** (upphöjd, alltid nåbar med tummen) · Kunder · Mer. "Mer" samlar Redigera sidan, Inställningar och Mörkt läge. Safe-area-inset i botten, touch ≥44px.

## Tokens
Samma som övriga v2: bg `#121210` · yta `#1C1C18`/`#25251F`/`#2E2E28` · linje `#33332C`/`#4A4A41` · text `#F0F0EA`/`#C8C8BD`/`#96968C` · grön CTA `#2F5F47`. Typ: Instrument Sans + IBM Plex Mono. Aktiv flik-pill radie 9, chips 99, menyer radie 14 + skugga `0 18px 44px rgba(0,0,0,.55)`.
