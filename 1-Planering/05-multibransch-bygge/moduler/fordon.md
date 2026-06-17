# Modul: Fordonsinfo (fordon)

> Status-källa: DB-sanning (`02-Arkitektur-sanning.md`) vinner över mockup. **NY modul — ingen `modules`-rad, ingen tabell idag** (DB-sanning §0/§1: fordon "har ingen rad i `modules` och ingen tabell"). Roadmap (`live:false`). Default-position **`konto`** (Mitt konto) — INTE publik sektion. Återanvänds vid både bokning OCH offert. Följer princip 10: EN motor, aldrig fork, aldrig kundkod.

## 1. Kärna (universell)

En **fordonsprofil kopplad till kunden** (`regnr, märke, modell, årsmodell, anteckningar`) som återanvänds över bokning och offert. Bor i kundportalen (Mitt konto), inte publikt.

- **Vad den är:** kundägd post (`vehicles`) knuten till `customers` (cfg-data `MODULES.fordon`).
- **Vad den gör:** vid bokning/offert hos bilverkstad kopplar kunden sitt fordon → mekaniker ser exakt bil utan att fråga; regnr återanvänds så kunden slipper skriva in det varje gång (cfg-data `build`: "Bokning/offert (bilverkstad) kopplar fordon. Regnr-validering").
- **Default state:** `off`. Tänds för fordons-branscher (bilverkstad; ev. cykel/MC framtid).
- **Position:** `defaultPos: "konto"` → renderas i **Mitt konto** (`SECTIONS.konto`), aldrig i `main`. Ägaren ser fordonsdatan kopplad till bokning/offert (MODULE_FACES `fordon.adm`).
- **Två ansikten (MODULE_FACES):** kund — "ser/fyller sitt fordon i Mitt konto"; admin — "ser fordonsdatan kopplad till bokning/offert".

## 2. Universal vs variant — beslut + axlar

**Beslut: EN fordons-modul, EN variant idag (`bilverkstad`).** Cykel/MC/båt = framtida varianter på SAMMA tabell (`vehicle_type`-fält + config), aldrig en fork. Skillnaden bil↔cykel är vilka fält som visas/valideras = data → VARIANT, inte ny modul (princip 10).

### De fyra lagren applicerade på fordon (princip 10)

| Lager | Var | Fordon-exempel |
|---|---|---|
| 1. `variant_schema` (enum+params) | `modules.variant_schema` | `vehicle_type: bil` (default; enum öppnar cykel/MC). Param: regnr-validering på/av, vilka fält som krävs. |
| 2. `verticals.rules` | `verticals.rules` (jsonb) | `booking.capture: [fordon]` + `offert.capture: [fordon]` (bilverkstad) → boknings-/offertflödet kopplar fordon. (Jfr DB-sanning §7.2-exempel: `rules.booking.capture=["fordon"]`.) |
| 3. `verticals.terminology` | `verticals.terminology` (jsonb) | "Fordon" / "Bil" / "Mitt fordon"; `staff`=Mekaniker, `service`=Servicetyp (BRANCHES.bilverkstad). |
| 4. `tenant_modules.config` | `tenant_modules.config` (jsonb) | Per verkstad: kräv regnr? tillåt flera fordon? regnr-uppslag mot extern API på/av. |

### Variant-axlar (det som faktiskt skiljer) — alla = data

- **`vehicle_type`** — `bil` idag (regnr ABC12D/ABC123, märke, modell, år). Cykel/MC senare = annan fältuppsättning, samma tabell.
- **`regnr_validation`** — svenskt registreringsnummer-format: 3 bokstäver + 3 siffror (`ABC 123`) eller nya formatet 3 bokstäver + 2 siffror + 1 tecken (`ABC 12D`) (källa §9). Klient-validering + ev. uppslag.
- **`lookup_source`** (öppet beslut, §8) — auto-ifyll märke/modell/år från regnr via extern API (Transportstyrelsen-data via Bisnode/Dun & Bradstreet/Biluppgifter). Kräver tillstånd från Transportstyrelsen (§9).
- **`reuse_targets[]`** — var fordonet kopplas: `booking` och/eller `offert`. Det som gör modulen värdefull: skriv en gång, återanvänd i båda flödena.

## 3. Per bransch — tabell

Default `off` överallt; tänds för fordons-branscher. Alla `cfg-data.BRANCHES` listade för fullständighet.

| Bransch | variant-val | UI-skillnad | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| Bilverkstad | `vehicle_type=bil`, `regnr_validation=on`, `reuse=[booking,offert]` | Fordons-kort i Mitt konto (regnr, märke, modell, år) + fordons-väljare i bokning OCH offert | Kund kopplar bil vid service-bokning + offertförfrågan; mekaniker ser exakt fordon; regnr återanvänds | Service/offert kräver veta exakt bil (märke/modell/år/regnr) — driver bilverkstadens bokning **och** offert (`rec: fordon, offert`) |
| Cykelbutik | off (kandidat) | — | — | Cykel saknar regnr; om service-historik behövs → framtida `vehicle_type=cykel`-variant (ej nu) |
| Frisör / barber / nagel | off | — | — | Inga fordon |
| Restaurang / café | off | — | — | — |
| Florist | off | — | — | — |
| Privatklinik | off | — | — | `intag` är dess profil-modul |
| Hundsalong | off | — | — | `husdjur` är dess profil-modul |
| Optiker | off | — | — | — |
| Tatuering / fotograf | off | — | — | — |
| Skräddare | off | — | — | — |
| Second hand | off | — | — | — |
| Städföretag | off | — | — | (Ev. framtida flotta-koppling, då variant) |
| Låssmed | off | — | — | (Bilnyckel-jobb kopplar ev. fordon framtid) |
| Generell | off (valbar) | — | — | I `opt`-listan |

**Däckhotell / MC-verkstad / båtservice** = framtida verticals → SAMMA `vehicles`-tabell (`vehicle_type`-utökning), aldrig ny modul (princip 10).

## 4. DB-form

**Status: NY — inget i DB idag** (DB-sanning §7.2). Kräver tabell + `modules`-rad + RLS + booking/offert-koppling.

**Föreslagen tabell `vehicles`** (kundens egen data — RLS = kundens egna, INTE anon-läsbar):

| Kolumn | Typ | Not |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid NOT NULL FK→`tenants` | on delete cascade |
| `customer_id` | uuid NOT NULL FK→`customers` | ägaren (kund) |
| `reg_no` | text NOT NULL | registreringsnummer (normaliserad, t.ex. versalt utan mellanslag) |
| `make` | text | märke (Volvo) |
| `model` | text | modell (V60) |
| `model_year` | int | årsmodell (2019) |
| `notes` | text | fri anteckning |
| `created_at` / `updated_at` | timestamptz | `set_updated_at`-trigger (0001) |

**Booking/offert-koppling (cross-ref `booking.md` + `offert.md`):** `bookings.vehicle_id uuid references vehicles(id)` och `offert_requests.vehicle_id uuid references vehicles(id)` (eller capture-JSON — se §8). `booking.md §4` förutsätter `capture: [fordon] → FK till vehicles`.

**RLS (kundens egna):**
- `vehicles_rls` (authenticated): `using/with check (tenant_id = private.tenant_id() or private.is_platform_admin())`; kunden ser bara sina egna via `customer_id = current_customer_id()`, personal (`role_level() >= 3`) ser alla i tenant.
- **Ingen anon-policy** — kundportal-data, läcker aldrig publikt (privat som `shop_orders`).

**LIVE vs NY:** allt = **NY**. `modules`-rad (`key='fordon'`, `owns_tables=['vehicles']`, `default_section_position='konto'`, `variant_schema` för `vehicle_type`/`regnr_validation`), `vehicles`-tabell, RLS, `bookings.vehicle_id` + `offert_requests.vehicle_id`.

## 5. Två ytor — Mitt konto (kund) + Admin

**Mitt konto / storefront (kund):** fordons-kort enligt `ModFordon` (preview.jsx) — fyrkantig ikon + **regnr stort i versal-font (ABC 123)** + rad med **Märke: Volvo · Modell: V60 · År: 2019** + "Redigera"-pill. Kunden skapar/redigerar sina fordon. Vid bokning/offert hos bilverkstad dyker fordons-väljaren upp.

**Admin (ägare/personal):** `Fordon`-yta finns redan i `surfaces-more.jsx` som **read-table** över kundernas fordon (kolumner Kund · Reg.nr · Fordon · År; rader ur `AM.MOCK.vehicles`). NB-text: "Konto-modul. Detta är data kunden fyller i sitt Mitt konto — du ser den kopplad till deras bokningar. Visas inte på den publika sidan." Ägaren skapar inte fordon (kunden äger dem); ser dem kopplade till bokning/offert.

## 6. Verklighets-koll (vad som lätt missas)

- **Regnr-format ändrades 2019.** Sverige använder både `ABC 123` (3 bokstäver + 3 siffror) och nya `ABC 12D` (3 bokstäver + 2 siffror + 1 bokstav/siffra), infört när den gamla serien tog slut (källa §9). Validering måste tillåta båda. Normalisera (versalt, utan mellanslag) vid lagring så uppslag/dubblettkoll funkar.
- **Regnr-uppslag är inte gratis och kräver tillstånd.** Transportstyrelsens fordonsdata nås via kommersiella API:er (Bisnode/Dun & Bradstreet/Biluppgifter) **med tillstånd från Transportstyrelsen** (källa §9). Bygg modulen så uppslag är en *valbar* config-feature (`lookup_source`), inte ett hårt beroende — manuell ifyllnad ska alltid funka.
- **Återanvändning över booking + offert är hela värdet.** En ren visnings-profil utan koppling till de två flödena är meningslös. Bygg FK-vägen till båda (cross-ref `booking.md`, `offert.md`).
- **Kundägd, inte publik** — aldrig anon-read, alltid Mitt konto (`defaultPos='konto'`).
- **Flera fordon per kund** — hushåll med flera bilar; bokning/offert måste peka på rätt `vehicle_id`.
- **GDPR:** regnr + ägarkoppling är personuppgift → omfattas av tenantens anonymiserings-/raderingsflöde (DB-sanning §8 `scrub_customer_notes_on_anonymize`-mönster).

## 7. Status idag vs bygg

**Idag:** Mockup finns (`ModFordon` i preview.jsx + `Fordon`-admin i surfaces-more.jsx + `MODULES.fordon` + `MODULE_FACES.fordon`). **Inget i DB, ingen kod.** `live:false`.

**Bygg (när bilverkstad-kund finns, DB-sanning §7.2):**
1. Migration: `modules`-rad `fordon` + `vehicles`-tabell + index + RLS (kundens egna, ingen anon).
2. `verticals`-rad `bilverkstad` (DB-sanning §7.2-exempel finns) med `rules.booking.capture=[fordon]` + `rules.offert.capture=[fordon]`.
3. Koppling: `bookings.vehicle_id` + `offert_requests.vehicle_id` + flödes-logik (cross-ref `booking.md`, `offert.md`).
4. Mitt konto-yta: fordon-CRUD enligt `ModFordon`; ev. regnr-uppslag bakom config-flagga.
5. Admin: read-table finns (surfaces-more `Fordon`) — koppla mot riktig data.

## 8. Öppna beslut för Zivar

1. **Tabellnamn: `vehicles` vs `vehicle_profiles`.** cfg-data `MODULES.fordon` säger `vehicles (ny)`, MEN `Fordon`-admin i `surfaces-more.jsx` använder `vehicle_profiles` i `MT keys`. **Direkt konflikt i underlaget — måste lösas.** Välj en och håll husdjur/fordon konsekventa (se `husdjur.md §8`).
2. **Koppling: dedikerade FK-kolumner (`vehicle_id`) vs generisk capture-JSON i booking/offert?** Rekommendation: explicit FK (typsäkert, querybart). Påverkar `booking.md` + `offert.md`.
3. **Regnr-uppslag (`lookup_source`):** bygga in extern API (Bisnode/Biluppgifter) — kostar + kräver Transportstyrelse-tillstånd — eller manuell ifyllnad bara? Förslag: manuell nu, uppslag som senare config-toggle per tenant.
4. **`vehicle_type` enum nu eller senare?** Hårdkoda bil tills cykel/MC efterfrågas, eller bygg öppet enum direkt?
5. **Validering hård eller mjuk:** blockera spara vid felaktigt regnr-format, eller varna men tillåt (utländska fordon)?

## 9. Källor

- DB-sanning: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §0 (fordon = ingen tabell), §4.2 (privat/anon), §7.2 (ny modul + bilverkstad-`verticals`-exempel med `capture:[fordon]`), §8 (GDPR-anonymisering).
- Mockup/config: `super-admin/cfg-data.js` (`MODULES.fordon`, `SECTIONS.konto`, `MODULE_FACES.fordon`, `BRANCHES.bilverkstad`), `super-admin/preview.jsx` (`ModFordon`), `kund-admin/surfaces-more.jsx` (`Fordon`-admin, använder `vehicle_profiles` — konflikt §8).
- Princip: `10-arkitekturprincip-universal-vs-variant.md`; backlog: `09-modul-bransch-spec-backlog.md`.
- Cross-ref: `moduler/booking.md`, `moduler/offert.md` (fordon-capture/koppling).
- Verklighet (svenskt regnr-format ABC123 + ABC12D): en.wikipedia.org/wiki/Vehicle_registration_plates_of_Sweden.
- Verklighet (regnr→fordonsdata API:er, kräver Transportstyrelse-tillstånd): Bisnode/Dun & Bradstreet Vehicle Data Finder (dnb.com/developers-nordics, wso2api.bisnode.com), Biluppgifter API (apidocs.biluppgifter.se), Transportstyrelsen (transportstyrelsen.se).
