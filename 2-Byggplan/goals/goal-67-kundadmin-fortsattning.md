# Goal 67 — Kund-admin: fortsättning efter L2 (start här nästa session)

**Skapad:** 2026-07-14 (slutet av kalender-sessionen) · **Status:** öppen
**Föregående:** goal-65 (skalet) + goal-66 (kalendern) — L1 + L2 är BYGGDA, se nedan.

## Läget när denna skrevs (för dig som fortsätter)

Hela L2 (B-01…B-28) är byggt, testat och pushat till `main`. 948 enhetstester gröna,
`tsc` rent, `next build` EXIT 0. Planen med alla avbockade punkter:
`1-Planering/10-kundadmin-bokningsarbetsbord/IMPLEMENTATIONSPLAN.md`.

**Kalenderns skick:** ett arbetsbord, tre vyer (`/admin/bokningar?vy=dag|vecka|manad`),
boka/flytta/avboka/blockera i centrerade dialoger, ångralogg (↩), sök, resursfilter,
"+4 v"-hopp, återkommande blockeringar, telefonnummer på block + ringbart i dialogen,
PWA-installerbar, realtid via en kanal, feltillstånd med Försök igen.

## ⛔ FÖRSTA HANDLING: verifiera att migration 0061 är körd

`supabase/migrations/0061_block_series_customer_flags.sql` — tre kolumner:
`time_off.series_id`, `customers.hidden_at`, `customers.self_book`.

Koden i prod KRÄVER dem: utan 0061 failar **blockera tid**, **Kunder-sidan**,
**kundkortet** och **kundsök i kalendern**. Zivar skulle köra den i Supabase SQL Editor
direkt efter deployen 2026-07-14. Kontrollfråga (kör i SQL Editor):

```sql
select
  exists (select 1 from information_schema.columns
    where table_name='time_off' and column_name='series_id')  as serie_ok,
  exists (select 1 from information_schema.columns
    where table_name='customers' and column_name='hidden_at') as dolj_ok,
  exists (select 1 from information_schema.columns
    where table_name='customers' and column_name='self_book') as sjalvbok_ok;
```

Alla tre `true` = klart. Någon `false` → be Zivar klistra in HELA 0061 i SQL Editor
(idempotent — dubbelkörning ofarlig). OBS: `supabase migration list`/`db push` fungerar
INTE här — repot för ingen migrationshistorik (se kommentar i 0047), schemat är sanningen.

## Kvar att göra, i ordning

### 1. A-10/A-11 — Zivars manuella verifiering (blockerar inte kod)
Testlistan ligger i `6-Testing/kundadmin-kalender-testlista.md` (uppdaterad med serie-
blockeringar, resursfilter, +4v, dölj kund, självbok-toggle). Zivar kör den på riktiga
enheter. Fynd = fixar i denna goal.

### 2. E2E-sviten på staging
`e2e/calendar-clickbudget.spec.ts` (@mutating) är SKRIVEN men inte körd — @mutating får
aldrig köras mot molndatabasen (regel i `playwright.config.ts`). Körs med
`E2E_BASE_URL=<staging> pnpm test:e2e`. Selektorerna är byggda mot riktiga komponenter;
räkna med 1–2 iterationer (särskilt draget i flytta-testet).

### 3. L3 — C-01…C-08 (Inställningar + städ), se IMPLEMENTATIONSPLAN.md
- **C-01** Nio inställningskategorier — mappa BEFINTLIGA sidor, ingen omdesign.
- **C-02** "Redigera sidan" som entry-yta (förhandskort + status + öppna editorn).
- **C-03** Bokningsregler som begripliga lägen (På/Pausad/Av med konsekvenstext).
- **C-04** Session/konto: lösenordsbyte, aktiva sessioner, logga ut andra enheter.
- **C-05** Wavy-migreringstest (9 uppgifter, mät tid/fel) → `6-Testing/`.
- **C-06** Presettest: kalendermotorn mot 2 icke-frisörbranscher. Noll kodforkar.
- **C-07** Frisörord ut ur admin-kod och hjälpcopy (t.ex. CalendarHelp nämner "salongen").
- **C-08** Städ: avklarade goals → `2-Byggplan/klart/`, inga lösa filer.

### 4. Vilande beslut (väck vid behov, blockerar inget)
- SMS-notiser ("senare tillval" i notisvalet — kräver leverantörsbeslut).
- self_book-vakt på DB-nivå (idag app-side i kundflödet; RPC-vakt om någon faktiskt
  kringgår — se ponytail-kommentar i `lib/kund/actions.ts`).
- Seriehorisonten (12 mån materialiserat) — läggs om när första kunden slår i taket.

## Hårda regler som gällde bygget (ärvs)
- En sanning för tid: `working_hour_slots` är presentationsregel för självbokande
  kunder, ALDRIG en gräns för ägaren (`lib/admin/calendar-slots.ts`).
- Alla bokningsvägar genom `create_public_booking`-RPC:n — ingen gräddfil.
- Krockskydd = DB:ns EXCLUDE-constraint, aldrig app-side ledighetskoll.
- Klickbudget (e2e-FAIL): boka ≤5 · flytta = drag+bekräfta · avboka ≤3.
- Kör ALDRIG `next build` medan dev-servern är uppe — de delar `.next` och
  cache-korruption ser ut som `MODULE_NOT_FOUND ./NNNN.js`. Döda noden, `rm -rf .next`.
