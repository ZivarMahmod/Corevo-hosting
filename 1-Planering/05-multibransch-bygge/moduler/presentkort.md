# Modul: Presentkort (presentkort)

> En fil per modul. Följer `10-arkitekturprincip-universal-vs-variant.md` (EN universal motor, anpassning = config). DB-sanning: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §1.5 + migration `5-Kod/supabase/migrations/0036_presentkort_module.sql` (register + tabell + RLS i en). Status: ✅ **LIVE** (rad i `modules`, tabell `gift_cards`, RLS på). **Mestadels standard i alla branscher — variant = bara leveranssätt.**

## 1. Kärna (universell)
Ett presentkort = en rad i `gift_cards` med unik kod + saldo (`initial_amount_cents` → `balance_cents`). Köp-UI (belopp/design) skapar kortet; inlösen drar från saldot vid bokning/köp. EN modul, EN tabell, alla branscher som kör det (frisör, nagel, florist, café, restaurang, fotograf, + fler). **Compliance: rör pengar, men INGA betal-rails byggs** (låst regel) — modulen är **INERT**: betal-hooken är tom (`payment.enabled=false, provider=null`), det finns ingen köp-debitering, ingen provider. Tabellen lagrar bara saldon; inga pengar rör sig i nuläget. **Koder + saldon är känsliga → tabellen är ALDRIG anon-läsbar** (snävare RLS än shop/blogg). Storefrontens promo-sektion läser därför **aldrig** tabellen — den visar bara config (belopp-presets + leverans).

## 2. Universal vs variant — beslut + axlar
**Variant, aldrig fork.** Enda skillnaden mellan branscher är *hur kortet levereras* — ren config. Inget kräver en annan tabell → ren variant.
- **`variant_schema.fulfilment`** (enum):
  - `digital` — skickas via mejl till mottagaren. Default. Labels (0036): "Digitalt (mejl)".
  - `physical` — fysiskt kort som hämtas i butik. Label: "Fysiskt (hämtas)".
  - Params: `amount_presets` (int_array, def `[200, 500, 1000]`), `currency` (string, def SEK).
- **`tenant_modules.config`** = per-kund: egna belopp-presets, vald leverans, egen headline ("Presentkort").
- **`verticals.terminology`** påverkar promo-copy runt kortet (Presentkort gäller överallt).
- **Varför aldrig forkad:** alla branscher kör samma sak — "Standard." står ordagrant för frisör/nagel/florist/café/restaurang/fotograf i cfg-data. Att bygga en presentkortsmodul per bransch vore rent slöseri. EN modul, en config-rad. Ny bransch = noll kod.

## 3. Per bransch
| Bransch | variant-val (fulfilment) | UI-skillnad (storefront) | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| **Frisör** ✅ | `digital` | Belopp-presets 200/500/1000 + "Köp digitalt"; promo-kort med gradient | Välj belopp → (köp-UI; rails pausade) → `gift_cards`-rad | Klassisk salongspresent; mejlas direkt — standard |
| **Nagel** ✅ | `digital` | Standard belopp-presets | Som frisör | Standard, samma flöde |
| **Florist** 🌱 | `digital` (+ `physical`) | Standard; ev. fysiskt kort i butik | Köp → mejl/hämta | Present till någon annan; mejl funkar, fysiskt finns som butiksvariant |
| **Café / Konditori** 🌱 | `digital` (+ `physical`) | Standard belopp-presets | Köp → mejl/hämta → lös in mot fika/tårta | Vanlig fikapresent; ofta fysiskt kort vid disk |
| **Restaurang** ✅ | `digital` (+ `physical`) | Standard | Köp → mejl/hämta → lös in mot måltid | Middagspresent; klassiskt; ofta fysiskt |
| **Fotograf** 🌱 | `digital` | Standard | Köp → mejl → lös in mot shoot | Porträtt-/familjepresent som gåva |
| Hund 🌱 / Optiker 🌱 / Klinik 🌱 / m.fl. | (opt, default off) | Standard om på | Som ovan | Slås på per kund vid behov; ingen branschskillnad |

> Alla rader är medvetet nära identiska — **det är poängen.** Presentkort är beviset på att "standard i alla branscher" = noll variant-divergens utöver leveranssätt.

## 4. DB-form (LIVE — migration 0036 register + tabell + RLS)
**`public.gift_cards`** (ett kort/rad/tenant; variant-agnostiskt): `id` uuid PK · `tenant_id` uuid NOT NULL FK→tenants (cascade) · `code` text NOT NULL (unik PER tenant) · `initial_amount_cents` int NOT NULL def 0 (utfärdat belopp, minsta valuta-enhet) · `balance_cents` int NOT NULL def 0 (kvarvarande saldo) · `currency` text def SEK · `status` text NOT NULL def `active` CHECK in (**active, redeemed, expired, void**) · `recipient_name` · `recipient_email` · `message` · `expires_at` timestamptz · `created_at` · `updated_at`. Index: tenant, (tenant,status). **Unikt index `gift_cards_tenant_code_uniq (tenant_id, code)`** — samma kod kan finnas hos olika tenants men är unik inom en. `set_updated_at`-trigger.

**RLS** (0036, mönster ur 0032:s privata shop_orders): `gift_cards_rls for all to authenticated using/with check (tenant_id = (select private.tenant_id()) or is_platform_admin())`. **AVSIKTLIGT INGEN `for select to anon`-policy** och **ingen grant till anon** — koder + saldon får aldrig läcka; promo-sektionen behöver ingen rad (läser bara config). Grants: full CRUD→authenticated.

> **NY:** inget. Modulen är komplett (register + tabell + RLS i en migration). Inga betal-tabeller (rails pausade) — en framtida betal-modul kopplas additivt.

## 5. Två ytor — Storefront + Admin
- **Storefront** (`5-Kod/apps/web/components/storefront/PresentkortSection.tsx`): promo-sektion gatad på `tenant_modules.state='live'`. **Renderar belopp-presets + leverans-copy ur config** — `digital` → "Skickas direkt till mottagarens mejl", `physical` → "Hämtas i butik". **Läser ALDRIG `gift_cards`** (header i filen bekräftar: koder/saldon privata; promon behöver bara config). Köp-UI visas men debiterar ej (rails pausade). MODULE_FACE sf: *"Besökaren köper ett digitalt presentkort."*
- **Admin** (`5-Kod/apps/web/components/admin/PresentkortAdmin.tsx`, design `kund-admin/surfaces-more.jsx` → `Presentkort`): lista med kolumner **Kod / Belopp / Saldo / Status / Mottagare / Skapat** (kod-design.jsx visar Kod/Värde/Saldo/Sålt/Status). Ägaren registrerar kort sålt/utgivet, löser in manuellt (online-köp + inlösen aktiveras när rails öppnas — står i PresentkortAdmin.tsx). MODULE_FACE adm: *"Ägaren ser sålda kort, saldon och löser in dem."* "Tändes för att du aktiverade Presentkort."

## 6. Verklighets-koll
- **Promo läser inte tabellen — viktigt:** olikt shop (anon läser produkter) och blogg (anon läser inlägg) får anon **aldrig** röra `gift_cards`. Storefront-sektionen är ren config-rendering. Bryt inte denna isolering när köp-flödet byggs.
- **Saldo-dekrement vid inlösen är pengar-nära:** även med rails pausade kan manuell inlösen i admin dra `balance_cents`. Det måste vara atomiskt (ingen dubbel-inlösen) och loggat — append-only-anda. När en bokning/order betalas med kort: dra saldo server-side, aldrig klient.
- **Kod-unikhet:** `(tenant_id, code)` är unik — kodgenerering måste hantera kollision (retry) per tenant.
- **Status-livscykel:** `active → redeemed` (saldo 0) / `expired` (passerat `expires_at`) / `void` (makulerat). `expired` bör sättas av jobb/check, inte bara manuellt.
- **Svenska moms/kvitto vid rails-på (THE rule för presentkort):** momsen styrs av vouchertyp (Skatteverket / mervärdesskattelagen):
  - **Enfunktionsvoucher** — när det går att fastställa leverantör + skattesats vid utfärdandet (ex. presentkort som bara löses in mot EN tjänst med känd sats hos EN salong). **Moms redovisas vid FÖRSÄLJNINGEN av kortet.** Även kort med två kända satser (t.ex. spa 25% + mat 12%) är enfunktion om underlaget per tjänst går att fastställa.
  - **Flerfunktionsvoucher** — fast värde som kan användas till flera saker med olika moms (ex. presentkort hos café/restaurang/butik som täcker både servering 12%, takeaway 6% och alkohol 25%, eller shop-produkter 25%). **Utställaren debiterar/redovisar INGEN moms vid försäljning — momsen redovisas först vid INLÖSEN** av den som tillhandahåller varan/tjänsten.
  - **Konsekvens för Corevo:** ett presentkort kopplat till blandade moduler (presentkort + shop + booking med olika satser) blir typiskt **flerfunktion** → moms vid inlösen, inte vid köp. Ett salong-only-kort kan vara enfunktion. Detta avgör HUR köp/inlösen ska bokföras när rails öppnas — kortet i sig är inte momspliktigt vid utfärdande om flerfunktion.
  - Kvitto/kassaregister: fysisk inlösen i butik (kort betalar i kassan) → kvitto ska erbjudas; rena online-köp av kort kräver ej kassaregister.
- **Lätt missat:** `expires_at` är nullable — kort utan utgång lever för evigt (giltighetstidspolicy är affärsbeslut); `balance_cents` ≠ `initial_amount_cents` efter delinlösen (saldo, inte värde, gäller); promo-presets i `config` kan skilja från historiska kort (gamla kort behåller sitt belopp).

## 7. Status idag vs bygg
- **Finns:** modules-rad + `gift_cards` + RLS (0036, komplett), `PresentkortSection.tsx` (config-driven promo), `PresentkortAdmin.tsx` (lista + manuell registrering/inlösen).
- **Bygg/justera:** (a) **köp-flöde först när betal-rails öppnas** (idag inert — inget att bygga som rör pengar); (b) atomisk saldo-dekrement + inlösen-logg; (c) `expired`-sättning via jobb; (d) kodgenerering med kollisionshantering; (e) moms-hantering (en-/flerfunktion) kopplas till rails-bygget, inte nu.

## 8. Öppna beslut för Zivar
1. **Voucher-typ-default:** ska Corevo-kort behandlas som **flerfunktion** (moms vid inlösen — säkrast när kort kan lösas mot blandade moduler) eller låta tenant välja? (Påverkar bokföring vid rails-på.)
2. **Inlösen-yta:** ska presentkort kunna lösas in i booking-flödet + shop-checkout nu (saldo-drag, rails pausade) eller först med betalning?
3. **Giltighetstid:** default `expires_at` (t.ex. +24 mån) eller alltid manuellt/oändligt?
4. **Fysisk variant:** behöver `physical` något eget fält (hämtstatus) eller räcker `status` + admin-manuell hantering?
5. **Kodformat:** läsbar kod (t.ex. XXXX-XXXX) vs slumpad — påverkar UX vid manuell inlösen.

## 9. Källor
- DB-sanning §1.5 + §4.2: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md`
- Migration (kanon): `5-Kod/supabase/migrations/0036_presentkort_module.sql` (variant_schema.fulfilment, gift_cards-tabell, RLS utan anon, tom betal-hook)
- Variants/faces/branscher: `super-admin/cfg-data.js` (MODULES.presentkort variants — alla "Standard.", MODULE_FACES.presentkort, BRANCHES), `super-admin/preview.jsx` (ModPresentkort — tar bara `{t}`, ingen data, bevisar config-only)
- Admin-UI: `kund-admin/surfaces-more.jsx` (Presentkort: Kod/Värde/Saldo/Sålt/Status) · kod `apps/web/components/{storefront/PresentkortSection,admin/PresentkortAdmin}.tsx`
- Princip: `10-arkitekturprincip-universal-vs-variant.md` · Backlog: `09-modul-bransch-spec-backlog.md`
- Verklighet (SE): voucher-moms en-/flerfunktion — [PwC: Presentkort – så gör du med momsen](https://blogg.pwc.se/foretagarbloggen/presentkort-moms), [Skatteverket momssatser (lunchkuponger/vouchrar)](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momssatserochundantagfranmoms.4.58d555751259e4d66168000409.html); digitala presentkort marknad — [Digitalpresent.se](https://digitalpresent.se/digitala-presentkort/)
