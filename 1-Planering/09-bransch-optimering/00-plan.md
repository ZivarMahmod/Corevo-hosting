# Bransch-optimering — maxplan (2026-07-11, Zivars order)

> Zivars vision (ordagrant sammanfattad): varje bransch har sina egna moduler; branscher som
> delar modul (t.ex. bokning) delar MOTOR men branschen styr hur modulen BETER sig (frisör
> vs cykelbutik bokar besök på olika parametrar). En **kundbild per bransch** där alla
> moduler gås igenom och optimeras branschspecifikt — "lägger jag in en nagelsalong ska
> bokningsvyn och deras admin vara rätt anpassad för just deras jobb", medan superbooking
> styr allt optimerat under kundbilden (flera nagelsalonger delar bransch-optimering).
> Webshoppen ska ses över för olika butikstyper. **Fler templates**: trött på dagens 5
> (freshcut är FreshCuts egna) — bygg flera för olika branscher, INTE låsta utan modulära
> som dagens. ⛔ FreshCut (kunden) får ALDRIG påverkas.

## Akut bugg (fixas först)
**Tema-steget i onboardingen är trasigt per bransch**: `loadVerticalPresets`
(lib/platform/verticals.ts:96) bygger tema-listan ur `templates`-tabellen (21 vendor-rader,
taggade per bransch) — men bara 6 nycklar är riktiga byggda teman (`STOREFRONT_THEMES`:
salvia/leander/zigge/linnea/edit/freshcut). Väljer man en vendor-template som "tema" pekar
tenant_settings.theme på något som inte kan renderas. Fix: tema-steget får BARA lista
riktiga renderbara teman (och freshcut ska inte erbjudas — den är kundens).

## Faser
- **FAS 0 — Research (agent-armé, pågår)**: rapporter skrivs till denna mapp (01–06).
- **FAS 1 — Tema-steget lagas** + onboarding visar rätt teman per bransch.
- **FAS 2 — Bransch-kundbild** (superbooking): per bransch en yta som samlar modul-
  parametrar; booking-parametrar per bransch (terminologi finns redan — utöka till beteende).
- **FAS 3 — Modul-beteende per bransch**: bokning (slot-längd/fält/flow), webshop
  (butikstyper), admin-vyer (nagelsalong ser nagel-anpassad admin osv).
- **FAS 4 — Nya modulära templates**: flera per bransch, byggda på samma token/section-
  arkitektur som dagens 5 (aldrig låsta till bransch — bransch är en TAGG, inte ett lås).
- Varje fas: bygg → verifiera → iterera tills nöjd. FreshCut röres aldrig (tema 'freshcut',
  tenant freshcut, dess data = fredad).

## Research-rapporter (FAS 0)
| Fil | Ämne |
|---|---|
| 01-tema-kedjan.md | Exakt kedja tema-steg → DB → render; var det brister per bransch |
| 02-bransch-kundbild.md | Vad en kundbild per bransch behöver innehålla (data + UI) |
| 03-modulparametrar.md | Vilka modul-parametrar som ska bli bransch-styrda (booking först) |
| 04-webshop-branscher.md | Webshoppens anpassning per butikstyp |
| 05-template-arkitektur.md | Hur nya modulära templates byggs (tokens/sections/looks) |
| 06-bransch-admin.md | Hur kund-admin anpassas per bransch (terminologi → beteende) |
