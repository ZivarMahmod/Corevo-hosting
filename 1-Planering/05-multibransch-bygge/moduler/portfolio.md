# Modul: Portfolio / Galleri (portfolio)

> Status-källa: DB-sanning (`02-Arkitektur-sanning.md`) vinner över mockup. **NY modul — ingen `modules`-rad, ingen tabell idag** (DB-sanning §0/§1: portfolio "har ingen rad i `modules` och ingen tabell"). Roadmap (`live:false`). Default-position **`main`** — PUBLIK sektion (till skillnad från husdjur/fordon). Hämtar bilder ur `media_library`. Följer princip 10: EN motor, aldrig fork, aldrig kundkod.

## 1. Kärna (universell)

Ett **bildgalleri av utfört arbete**, filtrerbart, renderat publikt i `main`. Bilderna ligger i tenantens bildbibliotek (`media_assets`); portfolion lägger bara metadata (tagg/kategori/artist/ordning) ovanpå.

- **Vad den är:** galleri-grid byggt från `media_assets` + en metadata-tabell `portfolio_items` (tagg/kategori/artist) (cfg-data `MODULES.portfolio`).
- **Vad den gör:** visar arbeten i ett rutnät med lightbox; vissa branscher får filter-chips (artist/stil/shoot-typ). Ren visning — inga köp, ingen bokning direkt (men inspirerar till bokning).
- **Default state:** `off`. Tänds för visuellt drivna branscher (cfg-data `why`: "Visuellt drivna branscher").
- **Position:** `defaultPos: "main"` → publik sektion på sajten (`SECTIONS.main`, "moduler vävs in via markörer"). Till skillnad från husdjur/fordon ÄR portfolio publik.
- **Två ansikten (MODULE_FACES):** besökare — "bläddrar galleriet (filtrerbart)"; admin — "laddar upp bilder, taggar och ordnar galleriet".

## 2. Universal vs variant — beslut + axlar

**Beslut: EN portfolio-motor, tre presentations-varianter** (cfg-data `MODULES.portfolio.variants`): `tatuering` (artist + stil-filter), `fotograf` (shoot-typ-kategorier), `nagel` (inspirationsfeed, ingen filtrering). Skillnaden = **vilken filter-axel som visas + hur mycket** = presentation/config → VARIANT, aldrig fork (princip 10). Samma `portfolio_items`-tabell för alla tre.

### De fyra lagren applicerade på portfolio (princip 10)

| Lager | Var | Portfolio-exempel |
|---|---|---|
| 1. `variant_schema` (enum+params) | `modules.variant_schema` | `filter: artist_style \| shoot_type \| none` (enum) + param `columns` (grid-bredd, default 4 per preview) + `lightbox: true`. |
| 2. `verticals.rules` | `verticals.rules` (jsonb) | Vilken default-variant branschen får (tatuering→`artist_style`, fotograf→`shoot_type`, nagel→`none`). |
| 3. `verticals.terminology` | `verticals.terminology` (jsonb) | "Portfolio"/"Galleri"/"Vårt arbete"/"Inspiration"; filteretiketter (Artist vs Shoot-typ). |
| 4. `tenant_modules.config` | `tenant_modules.config` (jsonb) | Per tenant: egna filterkategorier (t.ex. tatueringsstilar: Fine line/Traditional/Blackwork), antal kolumner, vilka taggar. |

### Variant-axlar (det som faktiskt skiljer) — alla = data

- **`filter`** — `artist_style` (chips för artist + stil), `shoot_type` (kategori-chips: Porträtt/Bröllop/Produkt), `none` (rent flöde utan filter). Ur preview.jsx: tatuering+fotograf visar chip-rad, nagel gör det inte.
- **`grid_columns`** — rutnätsbredd (preview: `repeat(4,1fr)`). Config per tenant.
- **`tag_taxonomy[]`** — tenant-definierade kategorier/taggar (tatueringsstilar, shoot-typer). Lagras som data, inte enum i koden.
- **`artist_link`** — koppla bild till `staff_id`/`barber_id` (tatuering: filtrera per artist). Återanvänder befintlig `staff` (booking äger den) — ingen ny personal-tabell.

## 3. Per bransch — tabell

Default `off`; tänds för visuella branscher. Alla `cfg-data.BRANCHES` listade.

| Bransch | variant-val | UI-skillnad | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| Tatuering | `filter=artist_style` | Chip-rad: Alla · Fine line · Traditional · Blackwork (per `barber_id` + stil-tagg) + grid + lightbox | Besökare filtrerar på artist och stil → hittar rätt artist → bokar konsultation | Kunder väljer tatuerare efter stil/artist; portfolion ÄR säljargumentet (`rec: portfolio`, cfg-data `variants.tatuering`) |
| Fotograf | `filter=shoot_type` | Chip-rad: Alla · Porträtt · Bröllop · Produkt + grid + lightbox | Besökare filtrerar på shoot-typ → ser relevanta exempel → bokar/offert | Foto säljs per genre; visa rätt genre-exempel (`rec: portfolio`, `variants.fotograf`) |
| Nagelstudio | `filter=none` | Rent rutnät, ingen filter-rad (inspirationsfeed) | Besökare bläddrar inspiration → bokar behandling | Nail art = inspiration, inte sökning; enklare feed räcker (`rec: portfolio`, `variants.nagel`) |
| Frisör | off (valbar) | (om på: `none`/grid) | — | Kan visa frisyrer; finns i frisör `opt: portfolio` |
| Barbershop | off (valbar) | — | — | Kan visa klippningar |
| Restaurang / café | off | — | — | Mat visas via `meny`, ej portfolio |
| Florist | off (kandidat) | (om på: `none`) | — | Buketter är visuella; kandidat-variant `none` |
| Privatklinik | off | — | — | — |
| Bilverkstad / cykel | off | — | — | — |
| Optiker | off | — | — | — |
| Skräddare | off (kandidat) | — | — | Måttsöm-exempel framtid |
| Second hand | off | — | — | Varor visas via `shop` |
| Städföretag | off | — | — | (Före/efter-bilder framtid) |
| Låssmed | off | — | — | — |
| Generell | off (valbar) | `none`/grid | — | I `opt`-listan |

Nya visuella branscher (makeup, inredning, bygg-före/efter) = SAMMA modul, ny default-variant via `verticals.rules` — aldrig ny modul (princip 10).

## 4. DB-form

**Status: NY — inget i DB idag** (DB-sanning §7.2). Hämtar dock ur befintlig `media_assets` (LIVE, 0026).

**Föreslagen tabell `portfolio_items`** (metadata ovanpå `media_assets` — RLS = anon-läsbar publik, jfr `blog_posts`/`shop_products`):

| Kolumn | Typ | Not |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid NOT NULL FK→`tenants` | on delete cascade |
| `asset_id` | uuid NOT NULL FK→`media_assets` | on delete cascade — bilden |
| `title` | text | valbar bildtext |
| `category` | text | shoot-typ / fri kategori (filter) |
| `style_tags` | text[] | stil-taggar (tatuering: Fine line…) |
| `staff_id` | uuid FK→`staff` | artist-koppling (tatuering); återanvänder booking-`staff` |
| `is_published` | bool default true | dölj utan att radera |
| `sort_order` | int default 0 | manuell ordning i grid |
| `created_at` / `updated_at` | timestamptz | `set_updated_at`-trigger (0001) |

**RLS (publik — anon-läsbar):**
- `portfolio_items_rls` (authenticated): tenant-scoped `using/with check (tenant_id = private.tenant_id() or private.is_platform_admin())`.
- `portfolio_items_public_read` (anon): `for select using (is_published = true)` — publik storefront läser publicerade rader (mönster ordagrant ur `blog_posts_public_read` 0034; app-lagret filtrerar `tenant_id` då anon saknar tenant-claim).
- `media_assets` har redan anon-read (0027) så bild-URL:erna resolvar publikt.

**LIVE vs NY:** `media_assets` = **LIVE** (0026/0027). `portfolio_items` + `modules`-rad (`key='portfolio'`, `owns_tables=['portfolio_items']`, `default_section_position='main'`, `variant_schema.filter`) + RLS = **NY**.

## 5. Två ytor — Storefront (publik) + Admin

**Storefront (besökare):** `ModPortfolio` (preview.jsx) — för tatuering/fotograf en chip-rad med filter (första chip "Alla" markerad i primärfärg), sedan ett `repeat(4,1fr)`-rutnät av bilder (kvadratiska, `aspectRatio:1`, mallens radius); nagel hoppar filter-raden. Lightbox vid klick (cfg-data `build`). Renderas i `main`, token-stylad som övriga sektioner.

**Admin (ägare):** ladda upp bilder (via `media_library`/ImagePicker), tagga (kategori/stil/artist), ordna (drag/sort_order), publicera/dölja (MODULE_FACES `portfolio.adm`). Återanvänd `MediaLibrary`/`ImagePicker`-mönstret som redan finns i koden (blogg-cover använder `ImagePicker` mot `media_assets`).

## 6. Verklighets-koll (vad som lätt missas)

- **Portfolio äger inte bilder — `media_library` gör det.** `portfolio_items.asset_id` → `media_assets`. Samma bild kan återanvändas (hero, blogg, portfolio) utan dubbel uppladdning, och belastar samma 500 MB-kvot (cross-ref `media_library.md`). Bygg inte en separat bild-lagring.
- **Filter är tenant-data, inte hårdkodade enums.** Tatueringsstilar/shoot-typer varierar per studio → `tag_taxonomy` i config, annars blir det en fork. Preview visar exempel-chips ("Fine line"), men de ska komma från tenantens taggar.
- **Artist-filter återanvänder `staff`.** Tatuering filtrerar per artist = `staff_id`/`barber_id` (booking äger `staff`). Ingen ny artist-tabell (princip 10).
- **Bildtunga sidor = prestanda.** Galleri laddar många bilder → kräver Cloudflare Images-optimering (responsiva storlekar, `format=auto` → AVIF/WebP, lazy-load) annars blir LCP/laddtid dålig (cross-ref `media_library.md §6`).
- **Publik, men dölj-bar.** `is_published` så ägaren kan ta bort en bild från sajten utan att radera ur arkivet.
- **Lightbox + alt-text** för tillgänglighet (alt finns på `media_assets`).

## 7. Status idag vs bygg

**Idag:** Mockup finns (`ModPortfolio` i preview.jsx + `MODULES.portfolio` med tre varianter + `MODULE_FACES.portfolio`). `media_assets` finns LIVE. **`portfolio_items` + modul-registrering + kod = saknas.** `live:false`.

**Bygg (när visuell bransch-kund finns):**
1. Migration: `modules`-rad `portfolio` + `portfolio_items`-tabell + index + RLS (anon-read som blogg).
2. `verticals.rules` sätter default-variant per bransch (tatuering→`artist_style`, fotograf→`shoot_type`, nagel→`none`).
3. Storefront-sektion enligt `ModPortfolio` (chip-filter + grid + lightbox), variant-driven (ingen `if (bransch)` i motorn — som blogg-sektionen).
4. Admin: galleri-CRUD ovanpå `media_library`/`ImagePicker` (ladda/tagga/ordna/publicera).
5. Bild-optimering via Cloudflare Images (cross-ref `media_library.md`).

## 8. Öppna beslut för Zivar

1. **Tabellnamn `portfolio_items`** (cfg-data säger så) — bekräfta, och om artist-koppling: `staff_id` mot befintlig `staff` (rekommenderat) eller eget fält?
2. **Filter-taxonomi:** tenant-definierade taggar/kategorier (flexibelt, rätt enligt princip) vs en fast lista per variant (enklare men styvare)? Förslag: tenant-data i config.
3. **Lightbox/visning:** enkel CSS-lightbox eller bibliotek? (Påverkar bundle.)
4. **Koppling portfolio→bokning:** ska ett galleri-kort (artist) länka direkt till bokning av den artisten (tatuering)? Mervärde men extra koppling.
5. **Nagel "inspirationsfeed"** — exakt samma tabell men variant `none`; bekräfta att ingen separat enklare modell behövs (princip 10 säger samma motor).

## 9. Källor

- DB-sanning: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §0/§1 (portfolio = ingen tabell), §1.7 (media_assets/R2), §4.2 (anon-read-mönster), §7.2 (ny modul).
- LIVE bild-infra: `5-Kod/supabase/migrations/0026_multibranch_core.sql` (`media_assets`), `0027_multibranch_rls.sql` (`media_assets` anon-read), `0034_blogg_module.sql` (anon-read-policy som mall).
- Mockup/config: `super-admin/cfg-data.js` (`MODULES.portfolio` + 3 varianter, `MODULE_FACES.portfolio`, `BRANCHES.tatuering/fotograf/nagel`), `super-admin/preview.jsx` (`ModPortfolio`).
- Befintlig kod-mönster: `5-Kod/apps/web/components/admin/MediaLibrary.tsx`, `components/admin/BloggAdmin.tsx` (ImagePicker mot media_assets), `components/storefront/BloggSection.tsx` (variant-driven sektion utan `if (bransch)`).
- Princip: `10-arkitekturprincip-universal-vs-variant.md`; backlog: `09-modul-bransch-spec-backlog.md`.
- Cross-ref: `moduler/media_library.md` (bild-kvot + optimering).
