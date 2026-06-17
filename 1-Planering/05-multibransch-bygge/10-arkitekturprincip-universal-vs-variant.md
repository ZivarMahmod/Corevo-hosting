# 10 — Arkitekturprincip: universal motor + variant per bransch

> Styrande beslut. **Alla modul-specer i `moduler/` följer detta.** Svarar på Zivars fråga: "ska webshoppen vara universal eller olika per bransch?"

## Svaret: EN universal motor. Aldrig en fork per bransch.
Varje modul byggs **en gång**. Bransch-anpassning är **config**, inte kod.

## De fyra lagren av anpassning
1. **`variant_schema`** (på modulen) — enum + params. Ex: `shop.fulfilment = ship | pickup_within_days | order_in_then_pickup`.
2. **`verticals.rules`** — objekt & capture. Ex: `booking.object = table` (restaurang) vs `slot` (frisör); `capture = [fordon]` (bilverkstad).
3. **`verticals.terminology`** — orden i UI. Stylist / Barberare / Behandlare / Mekaniker · Behandling / Klippning / Rätt.
4. **`tenant_modules.config`** — per kund-finjustering ovanpå branschens default.

## Regeln (variant vs ny modul)
- Skillnad uttryckbar som **data/config → VARIANT** på befintlig modul.
- Skillnad kräver **fundamentalt annan tabell → NY modul** — men fortfarande **universell**, togglad per kund via `tenant_modules`. **Aldrig kund-specifik kod.**
- Aldrig: en "florist-shop" och en "café-shop" som skilda kodbaser. **EN shop, flera configs.**

## Webshop konkret (exemplet du frågade om)
EN `shop`-modul. `fulfilment`-varianten styr leverans/upphämtning/förbeställning. Config styr betalrails (pausade nu) + produkt-typer.
- Florist = leverans/upphämtning + datum/adress · Café = förbeställ + hämtdatum · Optiker = bågar + receptkoppling · Second hand = unika varor (lager=1) · Cykel = delar/tillbehör · Frisör = hårvård.
- **Samma motor, olika variant + config. Inte fyra shoppar.**

## Konsekvens för bygget
- En bugg fixas **en gång** → alla branscher. En förbättring → alla.
- Ny bransch = en `verticals`-rad (config). **Noll kod.**
- Ny modul = byggs en gång, togglas på där den behövs.
- = "bygg uttag, inte apparater" + "branch = config".

## Var detaljerna bor
Per-modul variant-axlar + per-bransch UI/funktion/optimering: **`1-Planering/05-multibransch-bygge/moduler/<modul>.md`** (en fil per modul).
Backlog (alla moduler×branscher): `09-modul-bransch-spec-backlog.md`. DB-sanning: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md`.
