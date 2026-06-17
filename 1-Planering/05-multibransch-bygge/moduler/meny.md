# Modul: Meny-visning (meny)

> Status-källa: DB-sanning (`02-Arkitektur-sanning.md`) vinner över mockup. **NY modul — ingen `modules`-rad, ingen tabell idag** (DB-sanning §0/§1: meny "har ingen rad i `modules` och ingen tabell"). Roadmap (`live:false`). Default-position **`main`** — PUBLIK sektion. **Ren visning, INGA köp** (ingen kassa, inga pengar). Följer princip 10: EN motor, aldrig fork, aldrig kundkod.

## 1. Kärna (universell)

En **visningsmeny**: rätter grupperade i kategorier, med pris, beskrivning och **allergener**. Renderas publikt i `main`. Ingen varukorg, ingen betalning — bara visning (cfg-data `MODULES.meny`: "Visningsmeny — inga köp. Kategorier + allergener").

- **Vad den är:** `menu_categories` + `menu_items` (`namn, pris, beskrivning, allergener[], kategori, dagens-flagga`) (cfg-data `build`).
- **Vad den gör:** storefront renderar rätter per kategori. **Ingen kassa.** Skild från `shop` (som har varukorg/order) — meny rör inga pengar, så ingen betal-hook, ingen `payment.enabled` (jfr blogg, DB-sanning §1.6-mönstret "rör inga pengar → trivialt").
- **Default state:** `off`. Tänds för mat-branscher (cfg-data `why`: "Restaurang/café").
- **Position:** `defaultPos: "main"` → publik sektion (`SECTIONS.main`).
- **Två ansikten (MODULE_FACES):** besökare — "läser menyn (kategorier, allergener)"; admin — "redigerar rätter, priser och dagens-flagga".

## 2. Universal vs variant — beslut + axlar

**Beslut: EN meny-motor, två presentations-varianter** (cfg-data `MODULES.meny.variants`): `restaurang` (kategorier förrätt/varmrätt/dessert + allergener, inga köp) och `cafe` (kategorier + dagens-flagga). Skillnaden = vilka kategorier som är default + om dagens-flaggan lyfts = data/config → VARIANT, aldrig fork (princip 10). Samma `menu_items`-tabell.

### De fyra lagren applicerade på meny (princip 10)

| Lager | Var | Meny-exempel |
|---|---|---|
| 1. `variant_schema` (enum+params) | `modules.variant_schema` | `style: courses \| daily` (enum) + param `show_allergens: true` (default) + `show_daily_flag: bool`. |
| 2. `verticals.rules` | `verticals.rules` (jsonb) | Default-variant per bransch (restaurang→`courses`, café→`daily`); default-kategorier. |
| 3. `verticals.terminology` | `verticals.terminology` (jsonb) | "Meny"/"Dagens"/"Fika"; restaurang `service`=Rätt/Bord (DB-sanning §2). |
| 4. `tenant_modules.config` | `tenant_modules.config` (jsonb) | Per ställe: egna kategorier, valuta, om priser visas, om allergener visas, dagens-flagga på/av. |

### Variant-axlar (det som faktiskt skiljer) — alla = data

- **`style`** — `courses` (rätter i kategorier förrätt/varmrätt/dessert; preview restaurang) vs `daily` (café: Dagens + Tårtor; dagens-flaggan lyft). Ur `ModMeny`: `cfg.branch === "cafe"` → Dagens/Tårtor, annars Förrätt/Varmrätt.
- **`categories[]`** — tenant-definierade kategorier (data, inte hårdkodat). Preview visar exempel men de ska vara tenantens.
- **`show_allergens`** — visa allergen-märkning per rätt (default på för mat). Se §6 — juridiskt relevant.
- **`daily_flag`** — markera "dagens rätt" (café/lunch). `menu_items.is_daily`.
- **Inga pengar-axlar** — meny har medvetet ingen `fulfilment`/`payment` (det är `shop`-modulens domän).

## 3. Per bransch — tabell

Default `off`; tänds för mat-branscher. Alla `cfg-data.BRANCHES` listade.

| Bransch | variant-val | UI-skillnad | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| Restaurang | `style=courses`, `show_allergens=on` | Två-kolumns kategori-layout: Förrätt/Varmrätt/Dessert; rätt + pris + allergener; ingen köp-knapp | Besökare läser menyn före besök/bokning; bokar bord via `booking` | Gäster vill se meny + pris + allergener före besök; allergen-info lagkrav för servering (§6) (`rec: meny`, cfg-data `variants.restaurang`) |
| Café / konditori | `style=daily`, `daily_flag=on` | Kategorier med Dagens-sektion lyft (Dagens, Tårtor); pris; ev. allergener | Besökare ser dagens utbud + sortiment; ev. förbeställ via `shop` (separat modul) | Café lever på dagens-utbud; lyft dagens-flaggan (`rec: meny`, cfg-data `variants.cafe`) |
| Frisör / barber / nagel | off | — | — | Ingen mat |
| Florist | off | — | — | Sortiment via `shop` |
| Privatklinik | off | — | — | — |
| Bilverkstad / cykel | off | — | — | — |
| Hundsalong | off | — | — | — |
| Optiker | off | — | — | — |
| Tatuering / fotograf | off | — | — | — |
| Skräddare | off | — | — | — |
| Second hand | off | — | — | — |
| Städföretag / låssmed | off | — | — | — |
| Generell | off (valbar) | `courses` | — | I `opt`-listan |

Bar/foodtruck/catering = SAMMA modul, variant `courses`/`daily` + config — aldrig ny modul (princip 10). Vill ett ställe ta betalt online → det är `shop`-modulen vid sidan av, inte en meny-fork.

## 4. DB-form

**Status: NY — inget i DB idag** (DB-sanning §7.2).

**Föreslagna tabeller** (publik visning — RLS = anon-läsbar, jfr `blog_posts`/`shop_products`):

`menu_categories`:

| Kolumn | Typ | Not |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL FK→`tenants` | cascade |
| `name` | text NOT NULL | Förrätt/Varmrätt/Dessert/Dagens |
| `sort_order` | int default 0 | ordning på sidan |
| `created_at`/`updated_at` | timestamptz | |

`menu_items`:

| Kolumn | Typ | Not |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL FK→`tenants` | cascade |
| `category_id` | uuid FK→`menu_categories` | on delete set null |
| `name` | text NOT NULL | "Toast Skagen" |
| `description` | text | |
| `price_cents` | int | pris (ören; visas "165 kr") |
| `currency` | text default `'SEK'` | |
| `allergens` | text[] | EU Annex II-koder (se §6) |
| `is_daily` | bool default false | dagens-flagga (café/lunch) |
| `is_available` | bool default true | dölj slut/säsong utan radering |
| `sort_order` | int default 0 | |
| `image_asset_id` | uuid FK→`media_assets` | valbar rätt-bild (set null) |
| `created_at`/`updated_at` | timestamptz | `set_updated_at` (0001) |

**RLS (publik — anon-läsbar):**
- `menu_*_rls` (authenticated): tenant-scoped `using/with check (tenant_id = private.tenant_id() or private.is_platform_admin())`.
- `menu_*_public_read` (anon): `for select using (true)` för kategorier; `for select using (is_available = true)` för items (mönster ur `shop_products`/`blog_posts` 0032/0034; app-lagret filtrerar `tenant_id`).

**LIVE vs NY:** allt = **NY**. `modules`-rad (`key='meny'`, `owns_tables=['menu_categories','menu_items']`, `default_section_position='main'`, `variant_schema.style`), två tabeller, RLS. (`media_assets` LIVE för rätt-bilder.)

## 5. Två ytor — Storefront (publik) + Admin

**Storefront (besökare):** `ModMeny` (preview.jsx) — `gridTemplateColumns: 1fr 1fr` (två kolumner), per kategori en rubrik (mallens display-font, ev. versaler, understreck) + rader med rätt + pris. Café-varianten visar Dagens/Tårtor, restaurang Förrätt/Varmrätt. **Ingen köp-knapp.** Allergen-märkning per rätt (se §6) ska in i den riktiga versionen (preview visar bara namn+pris). Renderas i `main`, token-stylad.

**Admin (ägare):** `Meny`-yta finns i `surfaces-more.jsx` — PH "Meny / Rätter, kategorier, allergener", NB "Tändes för att din bransch är restaurang. Menyn visas på din publika sida (läsning, inga köp). Du redigerar rätter, priser och dagens-flagga här." + tabell (Rätt · Kategori · Pris) + "Ny rätt"-knapp. `MT keys={["menu_items"]}`. CRUD på rätter/kategorier, priser, allergener, dagens-flagga (MODULE_FACES `meny.adm`).

## 6. Verklighets-koll (allergen-märkning — juridiskt, lätt att missa)

- **Allergen-info är lagkrav, även för restaurang (oförpackad mat).** EU-förordning 1169/2011 (FIC) reglerar livsmedelsinformation; **recital 48** slår fast att information om allergener **alltid** ska ges till konsumenten även för icke-färdigförpackad mat (restaurang/café serverar oförpackat) — medlemsstaterna bestämmer *formen* (skylt, meny, "fråga personalen"). Sverige (Livsmedelsverket) följer detta. **Modulen bör därför stötta allergen-märkning per rätt, inte bara namn+pris.**
- **De 14 allergenerna (EU 1169/2011 Annex II) — exakt lista och ordning:**
  1. Spannmål med gluten (vete, råg, korn, havre, spelt, kamut)
  2. Kräftdjur (crustaceans)
  3. Ägg
  4. Fisk
  5. Jordnötter
  6. Sojabönor
  7. Mjölk (inkl. laktos)
  8. Nötter (mandel, hasselnöt, valnöt, cashew, pekan, paranöt, pistage, macadamia)
  9. Selleri
  10. Senap
  11. Sesamfrön
  12. Svaveldioxid/sulfiter (>10 mg/kg eller mg/l)
  13. Lupin
  14. Blötdjur (mollusker)
  - → `menu_items.allergens text[]` bör använda denna fasta lista (koder 1–14 eller nycklar), inte fri text, så ikoner/filter blir konsekventa. Detta är samma 14 oavsett bransch (EU-harmoniserat) → universellt, ingen bransch-fork.
- **Pris i ören (int), visa som "165 kr".** Undvik float. Valuta i config (SEK default).
- **Ingen kassa — håll det rent.** Frestelsen att lägga till "beställ" gör meny till en halv-shop. Vill kunden ta betalt → aktivera `shop` separat (princip 10: EN shop, inte en meny-med-kassa-fork).
- **Säsong/slut:** `is_available`/`is_daily` så menyn kan ändras dagligen utan att radera rader.
- **Dietetiketter utöver allergener** (vegansk/vegetarisk/glutenfri) är vanligt men INTE samma som lag-allergener — håll isär (ev. separat `diet_tags`).

## 7. Status idag vs bygg

**Idag:** Mockup finns (`ModMeny` i preview.jsx + `Meny`-admin i surfaces-more.jsx + `MODULES.meny` med två varianter + `MODULE_FACES.meny`). **Inget i DB, ingen kod.** `live:false`. **Allergen-märkning saknas i mockupen** (bara namn+pris) — måste byggas på riktigt (§6).

**Bygg (när restaurang/café-kund finns):**
1. Migration: `modules`-rad `meny` + `menu_categories` + `menu_items` (med `allergens text[]`) + index + RLS (anon-read som shop/blogg).
2. `verticals.rules` default-variant (restaurang→`courses`, café→`daily`).
3. Storefront-sektion enligt `ModMeny`, variant-driven, **med allergen-märkning per rätt** (ikoner/koder).
4. Admin: rätt/kategori-CRUD enligt `Meny`-ytan; allergen-multiselect ur den fasta 14-listan; dagens-flagga; pris i ören.
5. Ingen betal-hook (meny rör inga pengar).

## 8. Öppna beslut för Zivar

1. **Allergen-modell:** fast lista (EU 14, koder/nycklar — rekommenderat för ikoner+filter+juridik) vs fri text? Och: visa som ikoner, koder eller text?
2. **Allergen obligatoriskt eller valbart per rätt?** Juridiken kräver att info *finns* (kan vara "fråga personalen"-disclaimer) — ska modulen tvinga ifyllnad eller tillåta en generell disclaimer-text?
3. **Tabellstruktur:** separata `menu_categories` + `menu_items` (rekommenderat, flexibelt) eller kategori som enum/text-fält på item (enklare)? cfg-data nämner båda tabellerna.
4. **Rätt-bilder:** koppla `image_asset_id` mot `media_library` (ja/nej)? Bildmeny är trevligt men ökar kvot-tryck (cross-ref `media_library.md`).
5. **Diet-taggar** (vegansk/glutenfri) utöver lag-allergener — bygga nu eller senare?
6. **Café-förbeställning:** café `rec` listar `meny` + `shop` — bekräfta att förbeställning/köp går via `shop`-modulen, inte meny (princip 10).

## 9. Källor

- DB-sanning: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §0/§1 (meny = ingen tabell), §1.6 (rör-inga-pengar-mönster = ingen betal-hook), §2 (restaurang terminology/rules), §4.2 (anon-read), §7.2 (ny modul).
- Mockup/config: `super-admin/cfg-data.js` (`MODULES.meny` + 2 varianter, `MODULE_FACES.meny`, `BRANCHES.restaurang/cafe`), `super-admin/preview.jsx` (`ModMeny`), `kund-admin/surfaces-more.jsx` (`Meny`-admin, `MT keys=["menu_items"]`).
- Juridik (allergen-märkning): EU-förordning (EU) nr 1169/2011 om livsmedelsinformation till konsumenter — recital 48 (oförpackad mat: allergen-info alltid) + **Annex II** (de 14 allergenerna). eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011R1169. Tillämpas i Sverige av Livsmedelsverket.
- Princip: `10-arkitekturprincip-universal-vs-variant.md`; backlog: `09-modul-bransch-spec-backlog.md`.
- Cross-ref: `moduler/shop.md` (köp/förbeställning), `moduler/media_library.md` (rätt-bilder).
