# Modul: Husdjursprofil (husdjur)

> Status-källa: DB-sanning (`02-Arkitektur-sanning.md`) vinner över mockup. **NY modul — ingen `modules`-rad, ingen tabell idag** (DB-sanning §0/§1: "husdjur … har ingen rad i `modules` och ingen tabell"). Roadmap (`live:false` i `cfg-data.js`). Default-position **`konto`** (Mitt konto) — INTE en publik sektion. Driver hundsalongens booking-slot-längd. Följer princip 10: EN motor, aldrig fork, aldrig kundkod.

## 1. Kärna (universell)

En **profil per husdjur kopplad till kunden** som bär de datafält bokningen läser. Profilen bor i kundportalen (Mitt konto), inte på den publika sidan.

- **Vad den är:** kundägd post (`pets`) — `namn, ras, storlek, vikt, allergier, anteckningar` — knuten till `customers`/kundens auth-användare (cfg-data `MODULES.husdjur`).
- **Vad den gör:** matar booking. Vid bokning hos en hundsalong väljer kunden vilket husdjur det gäller → profilens `ras`/`storlek`/`vikt`/`päls` styr **slot-längden** och kan styra pris (källa: cfg-data `build` "Bokning (hund) läser pet för slot-längd", `variants.hund`).
- **Default state:** `off`. Tänds bara för branscher som behöver den (hundsalong). `tenant_modules` togglar per kund.
- **Position:** `defaultPos: "konto"` → renderas i sektionen **Mitt konto** (`SECTIONS.konto`, "Kundportal-moduler"), aldrig i `main`. Ägaren ser datan kopplad till bokningarna (MODULE_FACES `husdjur.adm`).
- **Två ansikten (MODULE_FACES):** kund — "ser/fyller sin husdjursprofil i Mitt konto"; admin — "ser husdjursdatan kopplad till bokningarna".

## 2. Universal vs variant — beslut + axlar

**Beslut: EN husdjurs-modul. Idag bara EN variant (`hund`).** Andra djurslag (katt/häst/exotiskt) = framtida varianter på SAMMA tabell via `species`-fält + config — aldrig en "katt-modul" som fork (princip 10). Skillnaden djur→djur är data (fält som visas/krävs), inte en annan tabell → VARIANT, inte ny modul.

### De fyra lagren applicerade på husdjur (princip 10)

| Lager | Var | Husdjur-exempel |
|---|---|---|
| 1. `variant_schema` (enum+params) | `modules.variant_schema` | `species: hund` (default; enum öppnar för katt/häst senare). Param: vilka fält som är synliga/obligatoriska per art. |
| 2. `verticals.rules` | `verticals.rules` (jsonb) | `booking.capture: [husdjur]` (hundsalong) → bokningen kräver pet-val + läser slot-längd ur profilen. |
| 3. `verticals.terminology` | `verticals.terminology` (jsonb) | "Husdjur" / "Hund" / "Mitt djur" — orden i kundportalen. |
| 4. `tenant_modules.config` | `tenant_modules.config` (jsonb) | Per salong: vilka fält som krävs (kräv vikt? kräv vaccinationsdatum?), om allergier är obligatoriskt. |

### Variant-axlar (det som faktiskt skiljer) — alla = data

- **`species`** — `hund` idag. Styr fältuppsättningen (ras-lista, storleksklasser). Öppet enum för framtid.
- **`slot_driver`** — vilka profilfält som påverkar booking-slot: `storlek` (S/M/L/XL) + `pälstyp` (kort/lång/dubbel/lockig) + ev. `vikt`. Verklighet: liten kort päls ≈ 30–90 min, stor tjock/dubbel päls 2–3 h, matta +1–2 h (se §6). Mappas till `services.duration_min`-modifierare eller en slot-tabell.
- **`required_fields[]`** — per tenant: vilka fält som är obligatoriska (namn alltid; vikt/allergi valbart).

## 3. Per bransch — tabell

Husdjur är default `off` överallt; tänds bara där den behövs. Tabellen visar alla branscher i `cfg-data.BRANCHES` för fullständighet (`rec` = rekommenderad/på, övriga = av).

| Bransch | variant-val | UI-skillnad | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| Hundsalong / grooming | `species=hund`, `slot_driver=storlek+päls` | Pet-kort i Mitt konto (namn, ras, vikt, allergier) + pet-väljare i bokning | Kund väljer husdjur vid bokning → profil styr slot-längd/pris; groomer ser ras/allergi/anteckning vid jobbet | Tid + pris beror helt på ras/storlek/päls/matta; allergi/hudåkomma styr produktval — **kärnan i grooming-bokning** (`rec: husdjur`) |
| Frisör | off | — | — | Människor, inga husdjur |
| Barbershop | off | — | — | Samma som frisör |
| Nagelstudio | off | — | — | — |
| Restaurang | off | — | — | — |
| Florist | off | — | — | — |
| Privatklinik (människa) | off | — | — | `intag` (människa) är dess profil-modul, inte husdjur |
| Bilverkstad | off | — | — | `fordon` är dess profil-modul |
| Cykelbutik | off | — | — | — |
| Optiker | off | — | — | — |
| Café | off | — | — | — |
| Tatuering | off | — | — | — |
| Fotograf | off | — | — | (Ev. framtida "djurfotografering" — då variant, ej ny modul) |
| Skräddare | off | — | — | — |
| Second hand | off | — | — | — |
| Städföretag | off | — | — | — |
| Låssmed | off | — | — | — |
| Generell | off (valbar) | — | — | Finns i `opt`-listan; kund kan slå på |

**Veterinär/djurpensionat** finns inte som vertical idag men är den självklara expansionen — då återanvänds SAMMA `pets`-tabell (ev. `species`-utökning), aldrig ny modul (princip 10 + DB-sanning §7.2: ny bransch = `verticals`-rad).

## 4. DB-form

**Status: NY — inget finns i DB idag.** Kräver ny tabell + `modules`-rad + RLS + ev. ny booking-kolumn (DB-sanning §7.2: "fordonsinfo/husdjur som EGNA moduler kräver nya tabeller + `modules`-rader + RLS … gör det bara när en riktig kund kräver det").

**Föreslagen tabell `pets`** (kundens egen data — RLS = kundens egna rader, INTE anon-läsbar; jfr känsliga `customer_notes` i DB-sanning §4.3):

| Kolumn | Typ | Not |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid NOT NULL FK→`tenants` | on delete cascade |
| `customer_id` | uuid NOT NULL FK→`customers` | profilägaren (kund) |
| `name` | text NOT NULL | "Bella" |
| `species` | text NOT NULL default `'hund'` | check-enum för framtid |
| `breed` | text | ras (fri text + ev. ras-lista i UI) |
| `size` | text | S/M/L/XL (storleksklass; driver slot) |
| `weight_kg` | numeric | valbart; kan finjustera slot/pris |
| `coat_type` | text | kort/lång/dubbel/lockig (driver slot) |
| `allergies` | text | allergi/hudåkomma — styr produktval |
| `notes` | text | fri anteckning (kund + personal) |
| `created_at` / `updated_at` | timestamptz | `set_updated_at`-trigger (0001) |

**Booking-koppling (cross-ref `booking.md`):** booking behöver en FK-väg pet→bokning. Två alternativ för Zivar (§8): (a) `bookings.pet_id uuid references pets(id)`, eller (b) generisk `bookings` capture-JSON. `booking.md §4` förutsätter `capture: [husdjur] → FK till pets`.

**RLS (kundens egna):**
- `pets_rls` (authenticated): `using/with check (tenant_id = private.tenant_id() or private.is_platform_admin())` — personal (`role_level() >= 3`) ser alla i tenant; kunden ser bara sina egna via `customer_id = current_customer_id()`.
- **Ingen anon-policy.** Husdjursprofil är kundportal-data, läcker aldrig publikt (till skillnad från `blog_posts`/`media_assets` som har anon-read). Mönster: privat som `shop_orders` (DB-sanning §4.2 "Ordrar är INTE anon-läsbara").
- Allergier/hälsoanteckning är känsligt → överväg samma snäva läsning som `customer_notes` (endast `role_level() >= 3` för personal-anteckningsfältet).

**LIVE vs NY:** allt = **NY**. `modules`-rad (`key='husdjur'`, `owns_tables=['pets']`, `default_section_position='konto'`, `variant_schema` för `species`), `pets`-tabell, RLS, ev. `bookings.pet_id`.

## 5. Två ytor — Mitt konto (kund) + Admin

**Mitt konto / storefront (kund):** pet-kort enligt `ModHusdjur` (preview.jsx) — rund avatar + namn (Bella) + rad med **Ras: Golden retriever · Vikt: 28 kg · Allergier: Kyckling** + "Redigera"-pill. Kunden skapar/redigerar sina husdjur här. Vid bokning hos hundsalong dyker pet-väljaren upp i bokningsflödet (cross-ref `booking.md` capture).

**Admin (ägare/personal):** ingen separat CRUD-yta för ägaren att skapa pets (kunden äger dem) — ägaren **ser** husdjursdatan kopplad till bokningar (MODULE_FACES `husdjur.adm` "ser husdjursdatan kopplad till bokningarna"). Groomer ser ras/vikt/allergi/anteckning på bokningskortet. Spegla `Fordon`-admin-mönstret i `surfaces-more.jsx` (read-table över kundernas fordon) → motsvarande read-table över kundernas husdjur.

## 6. Verklighets-koll (vad som lätt missas)

- **Slot-längd är hela poängen.** Grooming-tid styrs av storlek + pälstyp + matta: små korthår ~30–90 min, medium 1,5–2,5 h, stora/dubbla/lockiga 2–3 h, matta +1–2 h, kraftigt matt hund +flera timmar (källor §9). Om profilen inte matar slot-motorn är modulen meningslös — **bygg kopplingen pet→`services.duration_min`/slot, inte bara en visnings-profil.**
- **Allergi/hudåkomma är inte kosmetik** — det styr schampoval och kan vara djurskydd. Fältet ska finnas och vara läsbart för personal vid jobbet.
- **Flera husdjur per kund** — en kund kan ha flera hundar; bokningen måste peka på RÄTT individ (`pet_id`), annars blir slot-längden fel.
- **Kundägd, inte publik** — får aldrig anon-read. Ligger i Mitt konto, inte i `main`. Lätt att av misstag rendera som publik sektion — `defaultPos='konto'` måste respekteras.
- **Vaccinations-/försäkringsdatum** kan bli krav för pensionat/veterinär (framtida vertical) — lämna `notes`/config-utrymme, men bygg inte spekulativt nu.

## 7. Status idag vs bygg

**Idag:** Mockup finns (`ModHusdjur` i preview.jsx + `MODULES.husdjur` + `MODULE_FACES.husdjur`). **Inget i DB, ingen kod.** `live:false`.

**Bygg (när hundsalong-kund finns, DB-sanning §7.2):**
1. Migration: `modules`-rad `husdjur` + `pets`-tabell + index + RLS (kundens egna, ingen anon).
2. `verticals`-rad/uppdatering `hund` med `rules.booking.capture=[husdjur]` (+ ev. `slot_source` som läser pet).
3. Booking-koppling: `bookings.pet_id` + slot-längd-logik som läser `pets.size/coat_type` → `services.duration_min`-modifierare (cross-ref `booking.md §4/§8`).
4. Mitt konto-yta: pet-CRUD (skapa/redigera/radera egna husdjur) enligt `ModHusdjur`.
5. Admin: husdjur syns på bokningskort + read-table (spegla `Fordon`-admin).

## 8. Öppna beslut för Zivar

1. **Tabellnamn: `pets` vs `pet_profiles`.** cfg-data säger `pets (ny)`. Fordon-admin i `surfaces-more.jsx` använder dock `vehicle_profiles` (inte `vehicles`) i sin `MT keys` — **risk för inkonsekvent namngivning mellan husdjur/fordon.** Välj en konvention (`pets`/`vehicles` ELLER `pet_profiles`/`vehicle_profiles`) och var konsekvent.
2. **Booking-koppling: `bookings.pet_id`-kolumn vs generisk capture-JSON?** Påverkar `booking.md`. Rekommendation: explicit `pet_id` FK (typsäkert, querybart för slot-längd).
3. **Slot-längd-modell:** modifierar pet `services.duration_min` (per tjänst × storlek) eller en separat pris/tid-matris (ras/storlek → minuter)? Detta är kärnvärdet — behöver designas med en riktig hundsalong.
4. **`species` enum nu eller senare?** Bygg `species='hund'`-default men lämna enum öppet, eller hårdkoda hund tills katt/häst efterfrågas?
5. **Känsligt fält:** ska `allergies`/hälsoanteckning ha snävare RLS (endast personal, jfr `customer_notes`) eller är kund-läsbart OK?

## 9. Källor

- DB-sanning: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §0 (husdjur = ingen tabell), §4.2/§4.3 (RLS/känsligt), §7.2 (ny modul kräver tabell+RLS), §8 (booking-automation).
- Mockup/config: `4-Dokument-Underlag/01-acceptans/super-admin/cfg-data.js` (`MODULES.husdjur`, `SECTIONS.konto`, `MODULE_FACES.husdjur`, `BRANCHES.hund`), `super-admin/preview.jsx` (`ModHusdjur`).
- Admin-mönster: `4-Dokument-Underlag/01-acceptans/kund-admin/surfaces-more.jsx` (`Fordon`-konto-modul som mall).
- Princip: `1-Planering/05-multibransch-bygge/10-arkitekturprincip-universal-vs-variant.md`; backlog: `09-modul-bransch-spec-backlog.md`.
- Cross-ref: `moduler/booking.md` (capture, slot-längd, RPC).
- Verklighet (grooming-tid per ras/storlek/päls): williamsburgpethotels.com/how-long-does-dog-grooming-take, houndsy.com (modern-tails), sploot.space, silvermaplepetcenter.com — samstämmiga: små 1–1,5 h, medium 1,5–2,5 h, stora 2–3 h, jättar 3 h+, matta +1–2 h, dubbelpäls +30–60 min.
