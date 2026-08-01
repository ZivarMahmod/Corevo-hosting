# Goal 80 — verifierad lokal acceptans

Datum: 2026-07-23
Miljö: localhost mot Supabase-previewbranchen `localhost-acceptance`
Produktion: orörd

## Browseracceptans

- [x] Kundkortet öppnas som egen fullbreddsyta; kundlistan finns inte samtidigt.
- [x] `Kunder` går tillbaka till listan.
- [x] Samtliga befintliga kundflikar finns kvar och radbryts.
- [x] Sida-fliken har två användbara kolumner vid 1280 px.
- [x] Previewn är sticky och har designpaketets höjd/minimihöjd.
- [x] `Desktop` visar en verklig 1360 px-storefront nedskalad i ramen.
- [x] `Mobil` visar en centrerad verklig 390 px-storefront.
- [x] Previewn är FreshCuts riktiga sida och behåller externa Bokadirekt-länkar.
- [x] Tillfällig preview-only testoperatör togs bort efter browserprovet.
- [x] Browserns tillfälliga viewport override återställdes.

## Mekanisk verifiering

- [x] RED först: 3 av 18 nya/riktade tester visade de gamla layoutfelen.
- [x] `pnpm vitest run components/platform` — 14 filer, 111 tester gröna.
- [x] Riktad slutkörning — 17 tester gröna.
- [x] `pnpm typecheck` — grön.
- [x] `pnpm lint` — 0 fel, 7 befintliga varningar utanför Goal 80.
- [x] `pnpm build` mot previewmiljön — grön.
- [x] Fable 5 oberoende slutreview — `NO P0/P1`.

## Fastställda designmått

- Kundyta: max `1320px`, insets `24px`.
- Sida-grid: `minmax(400px, 1fr) minmax(480px, 1.15fr)`, gap `16px`.
- Sticky preview: `top: 78px`.
- Previewkropp: `calc(100vh - 220px)`, minst `420px`, `overflow:auto`.
- Stapling: viewport `991px` eftersom de två yttre 24px-insetsen lämnar
  designens minsta innehållsbredd `896px`.
