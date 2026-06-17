# ARKITEKTUR-SANNING — riktig databas vs onboarding-studio

> **Vad detta är:** En byte-för-byte-avstämning mellan vad som *faktiskt* finns i
> Supabase-databasen (projekt `clylvowtowbtotrahuad`, läst 2026-06-16) och vad
> `onboarding-studio/` visar. Allt nedan är verifierat mot live-schemat — inte gissat.
>
> **Källa:** `information_schema.columns`, `pg_policies`, `pg_proc`, och seed-raderna i
> `modules`, `verticals`, `templates`. Inga data ändrades — endast läst.
>
> **Regel för Code:** Där studion och DB:n skiljer sig är **DB:n sanningen för vad som kan
> deployas IDAG.** Studion visar två lager: vad som är **live** (finns i DB nu) och vad som är
> **roadmap** (avsikt, ej seedad än). Bygg det live'a mot DB. Roadmap-delen ska INTE raderas —
> den är produktägarens vision och byggs i faser (se §7). Markera, deploya inte som färdig.

---

## 0b. LIVE vs ROADMAP (läs detta tillsammans med §0)

Studion ser rikare ut än DB:n **med flit** — de extra modulerna/branscherna är Zivars
**roadmap**, inte hallucinationer. De är nu märkta i `cfg-data.js` med ett `live`-fält:

- **`live: true`** → finns i DB-tabellen `modules`/`verticals` idag. **7 moduler, 5 verticals.** Bygg dessa nu.
- **`live: false`** → roadmap. Visas i studion med en **«Roadmap»-bricka**. Bygg INTE som valbar-att-deploya
  förrän den seedas. **Radera inte** — den är avsiktlig backlog.

> Tidigare löd instruktionen "ta bort alla påhittade". **Det är ändrat:** behåll dem som
> märkt roadmap. Att lägga till en bransch är billigt (en `verticals`-rad, §7.2); en ny
> modul kräver tabell + `modules`-rad + RLS (§7) — gör det när en riktig kund kräver det.

---

## 0. Sammanfattning av gapet (läs detta först)

| Område | Studion visade | Databasen har | Åtgärd |
|---|---|---|---|
| **Moduler** | ~15 (portfolio, husdjur, fordon, intag, orderstatus, recurring, deposit, meny, inlamning …) | **7** (`booking`, `shop`, `offert`, `lojalitet`, `presentkort`, `blogg`, `media_library`) | 7 = `live:true`, bygg nu. Resten = `live:false` (roadmap) — behåll märkta, seeda före deploy (§7). |
| **Branscher (verticals)** | 16 (bilverkstad, tatuering, hundsalong, optiker …) | **5** (`frisör`, `barbershop`, `nagelstudio`, `restaurang`, `generell`) | 5 = `live:true`. Övriga = roadmap (`live:false`) — lägg `verticals`-rad när de behövs (§7.2). |
| **Modulvarianter** | Hårdkodad text per bransch | Riktig `variant_schema` (jsonb) per modul | Använd `variant_schema` — den är detaljerad och styrande. |
| **Bild-uppladdning i preview** | Fungerar inte | `media_assets` + `content_slots.asset_id` finns | Koppla preview-redigering mot dessa (se §5). |
| **Modulnyckel-bugg** | — | `verticals.default_modules` använder `"loyalty"` men `modules.key` är `"lojalitet"` | **Riktig bugg i din seed.** Se §6. |

**Konsekvensen:** studion ser rikare ut än verkligheten — **med flit.** Det live'a (7/5) byggs
mot DB nu; roadmap-delen är märkt och väntar. Faran är inte att visa roadmap, utan att
*deploya* den som färdig. `live`-fältet + «Roadmap»-brickan skiljer dem åt i UI:t.

---

## 1. De 7 riktiga modulerna (tabellen `modules`)

Varje modul = en rad i `modules`. Kolumner: `key`, `name`, `owns_tables` (jsonb),
`variant_schema` (jsonb), `default_config` (jsonb), `default_section_position`.

### 1.1 `booking` — Bokning
- **owns_tables:** `bookings`, `services`, `staff`, `staff_services`, `working_hours`, `time_off`, `slot_holds`
- **default_section_position:** `main`
- **variant_schema:** `{}` (ingen variant — beteende styrs av `services`/`staff`-data, inte en enum)
- **Storefront-yta:** besökaren väljer tjänst → personal → tid → bekräftar. Anropar RPC `create_public_booking(...)`.
- **Admin-yta:** ägaren ser kalender, av-/ombokar, sätter `working_hours`/`time_off`, lägger `services`/`staff`.

### 1.2 `shop` — Webshop
- **owns_tables:** `shop_products`, `shop_orders`, `shop_order_items`
- **default_section_position:** `main`
- **variant_schema.fulfilment:** enum `ship` | `pickup_within_days` | `order_in_then_pickup`
  - params: `pickup_within_days.pickup_days` (int, default 3), `order_in_then_pickup.lead_days` (int, default 7)
- **default_config:** `payment.enabled = false` → **betal-rails PAUSADE (beslut 14.2).** Varukorg + order skapas, men inga pengar rör sig.
- **Storefront:** produktlista → varukorg → lägg order (`shop_orders.payment_status='unpaid'`).
- **Admin:** CRUD på `shop_products`, hanterar `shop_orders` (status `pending`→…).

### 1.3 `offert` — Offert
- **owns_tables:** `offert_requests`
- **default_section_position:** `main`
- **variant_schema.mode:** enum `request_quote` | `estimate_form` | `callback`
  - params: `estimate_form.response_days` (default 2), `callback.response_days` (default 1)
- **default_config:** `payment.enabled = false` — offert är underlag, rör inga pengar.
- **Storefront:** formulär → INSERT i `offert_requests` (anon får INSERT, se §4).
- **Admin:** läser förfrågningar, sätter `status` (`new`→besvarad), `estimate_cents`.

### 1.4 `lojalitet` — Lojalitet
- **owns_tables:** `loyalty_ledger`
- **default_section_position:** `main`
- **variant_schema.variant:** enum `points` | `stamp_card`
  - params: `stamp_goal` (default 10), `points_per_visit` (default 50)
- **default_config:** `{variant:"points", headline:"Bli stammis", stamp_goal:10, points_per_visit:50}`
- **Automation:** trigger `earn_loyalty_on_completed()` skriver i `loyalty_ledger` när en bokning blir `completed`. **Detta är redan byggt i DB.**
- **Storefront/Mitt konto:** kunden ser sitt saldo (summa `points_delta`).
- **Admin:** ställer regler, ser alla medlemmars saldon.

### 1.5 `presentkort` — Presentkort
- **owns_tables:** `gift_cards`
- **default_section_position:** `main`
- **variant_schema.fulfilment:** enum `digital` | `physical`
  - params: `amount_presets` (int_array, default [200,500,1000]), `currency` (default SEK)
- **default_config:** `payment.enabled = false`.
- **Storefront:** köp-flöde (UI; rails pausade) → `gift_cards`-rad.
- **Admin:** ser sålda kort, `balance_cents`, löser in.

### 1.6 `blogg` — Blogg
- **owns_tables:** `blog_posts`
- **default_section_position:** `main`
- **variant_schema.layout:** enum `list` | `grid` | `featured` (default `grid`), param `posts_per_page` (default 6)
- **Storefront:** publika inlägg (`blog_posts.status='published'` — anon-läsbar).
- **Admin:** skriver/redigerar/publicerar.

### 1.7 `media_library` — Bildbibliotek (INFRA, ingen publik yta)
- **owns_tables:** `media_assets`
- **default_section_position:** `null` ← betyder **ingen sektion på sajten.** Det är infrastruktur.
- **default_config:** `quota_bytes = 524288000` (500 MB), billing-hook `media_library.storage_gb`
- **Roll i flödet:** lagrar alla uppladdade bilder (R2). Allt bildval i preview (§5) landar här.

> **Inga andra moduler finns.** portfolio/husdjur/fordon/intag/orderstatus/recurring/
> deposit/meny/inlamning som studion visade har **ingen rad i `modules` och ingen tabell.**
> De får INTE visas som valbara förrän de faktiskt seedas (migrations-förslag i §7).

---

## 2. De 5 riktiga branscherna (tabellen `verticals`)

Kolumner: `key`, `name`, `default_template`, `default_modules` (jsonb), `terminology` (jsonb), `rules` (jsonb).

| key | name | default_template | default_modules | terminology | rules |
|---|---|---|---|---|---|
| `frisör` | Frisör | `salvia` | booking=live, shop=off, loyalty=draft | staff=Stylist, service=Klippning | — |
| `barbershop` | Barbershop | `zigge` | booking=live, shop=off, loyalty=draft | staff=Barberare, service=Klippning | — |
| `nagelstudio` | Nagelstudio | `linnea` | booking=live, shop=off, loyalty=draft | staff=Nagelteknolog, service=Behandling | — |
| `restaurang` | Restaurang | `leander` | booking=live, shop=off, loyalty=off | unit=bord, staff=Personal, service=Rätt | booking.object=table |
| `generell` | Generell | `edit` | booking=live, shop=off, loyalty=off | — | — |

**Viktigt:**
- `tenants.vertical_id` (text) pekar på `verticals.key`. Onboardingens branschval = sätt detta.
- `default_modules` är BARA defaults — de kopieras till `tenant_modules` vid skapande och kan sedan ändras fritt. Bransch låser ingenting.
- `terminology` driver orden i UI (Stylist vs Barberare vs Personal). Studion ska läsa detta, inte hårdkoda.
- `rules.booking.object='table'` (restaurang) = boka bord, ingen personal/tjänst. Detta är hur "restaurang-varianten" ska härledas — från `rules`, inte en egen modul.

---

## 3. Templates (tabellen `templates`) — 27 st, inte 5

Studion sa "5 teman". DB har **27 aktiva templates**, var och en taggad:
`tags = {typ, stil, scope, licens, bransch}`.

- **typ:** `storefront` (publik sajt) eller `admin` (admin-skal)
- **licens:** `fri` (får användas fritt) eller `kräver-kredit` (vendor-mall, licenskostnad) eller `unknown`
- **bransch:** vilken vertical mallen är gjord för
- **sections:** jsonb-array av sektioner (vissa har 0 = inte fullt seedade än)

Storefront-mallar med `licens=fri`: `connect-plus`, `lumiere`, `polish`, `edit` (+ admin-skal `breeze-admin`, `celestial-admin`, `sneat`, `star-admin2`).
Resten är `kräver-kredit` (vendor-importerade: `foody`, `restoran`, `feane`, `haircut`, `barberx`, `alotan` …).

Mallar som ännu saknar `sections` (n=0): `edit`, `leander`, `linnea`, `zigge` — dessa är **defaults för verticals men inte färdig-seedade.** Det betyder: en frisör-onboarding pekar default på `salvia` (7 sektioner, OK), men nagelstudio pekar på `linnea` (0 sektioner — tom). **Detta är en lucka Code måste täppa.**

### 3.1 Hur en template blir en sajt
`templates.sections` (struktur) + `template_slots` (vad varje slot är: text/bild/modul) +
`content_slots` (tenantens ifyllda värden) = den renderade sajten.

`template_slots`-kolumner som spelar roll:
- `kind`: `text` | `image` | `module`
- `asset_role` / `aspect_hint`: för bild-slots (vilken roll, vilket bildförhållande)
- `module_key` + `module_view`: om sloten renderar en modul (t.ex. `booking` i vyn `inline`)
- `default_text` / `default_asset_key`: fallback innan tenant fyllt i

---

## 4. RLS — vem ser vad (verifierat ur `pg_policies`)

All isolering bygger på tre hjälpfunktioner i schemat `private`:
- `private.tenant_id()` — tenant för inloggad användare
- `private.is_platform_admin()` — DU (superadmin, `superbooking@corevo.se`)
- `private.role_level()` — rollnivå; **>= 3 = personal/admin** hos tenanten
- `private.current_customer_id()` — kundens egen rad

### 4.1 Fyra läsare, fyra nivåer

| Vem | Hur de identifieras | Ser |
|---|---|---|
| **Superadmin (du)** | `is_platform_admin() = true` | ALLT, alla tenants (varje policy har `OR is_platform_admin()`) |
| **Ägare/personal** | `role_level() >= 3` + matchande `tenant_id` | Allt inom sin egen tenant |
| **Kund (inloggad)** | `auth_user_id = auth.uid()` / `current_customer_id()` | Bara sina egna rader (bokningar, favoriter, loyalty) |
| **Besökare (anon)** | rollen `anon` | Bara publika `SELECT`-policys (se nedan) |

### 4.2 Vad anon (besökare) får — exakt
- **Läsa:** `tenants` (status=active), `tenant_settings`, `tenant_modules` (state live/paused), `services` (active), `staff` (active), `staff_services`, `working_hours`, `working_hour_slots`, `locations`, `shop_products`, `blog_posts` (published), `media_assets`, `content_slots`, `templates` (active), `template_slots`, `modules`, `verticals`.
- **Skriva:** `offert_requests` (INSERT) — besökaren får skicka offertförfrågan utan konto. Inget annat.
- **Bokning:** sker via RPC `create_public_booking(...)` (SECURITY DEFINER), inte direkt INSERT.

### 4.3 Känsliga undantag
- `customer_notes` (hårtyp, allergier, intern anteckning): **endast `role_level() >= 3`** — kunden ser inte sina egna notes, bara personal.
- `audit_log`: append-only (trigger `block_audit_mutation` stoppar UPDATE/DELETE).
- `bookings`: kund ser bara där `customer_profile_id = auth.uid()`; personal ser alla i tenant. Hard-delete blockerad av `block_booking_hard_delete()`.

---

## 5. Bild-uppladdning & text-redigering i preview (det du saknade)

Du sa: *"väldigt viktigt att jag kan trycka i preview och lägga in en bild senare som idag inte går."* Här är den riktiga kopplingen — allt finns redan i DB:

**Text-slot (klicka text → skriv om):**
1. Preview renderar en slot ur `template_slots` (t.ex. `slot_key='hero.title'`, `kind='text'`).
2. Användaren klickar och skriver.
3. UPSERT i `content_slots`: `{tenant_id, template_key, slot_key, kind:'text', text_value:{...}}`.
4. Publika sajten läser `content_slots` (anon-läsbar) → texten syns live.

**Bild-slot (klicka ruta → ladda upp bild):**
1. Slot ur `template_slots` med `kind='image'`, `asset_role`, `aspect_hint`.
2. Användaren väljer/laddar bild → fil till **Cloudflare R2** → rad i `media_assets` `{tenant_id, r2_key, url, type:'image', width, height}`.
3. UPSERT i `content_slots`: `{..., kind:'image', asset_id: <media_assets.id>}`.
4. Publika sajten läser `content_slots.asset_id → media_assets.url`.

> **Därför funkar det inte i mockupen idag:** mockupen har ingen R2-uppladdning och
> ingen `content_slots`-skrivning — den är bara visuell. För att göra det "på riktigt"
> behöver Code: (a) en signed-upload-endpoint mot R2, (b) UPSERT-logik mot `content_slots`.
> Allt DB-stöd (tabeller, RLS, kvot 500 MB) finns redan.

---

## 6. Riktig bugg hittad i din seed

`verticals.default_modules` använder nyckeln **`"loyalty"`**:
```json
{"shop": "off", "booking": "live", "loyalty": "draft"}
```
men modulen i `modules`-tabellen har nyckeln **`"lojalitet"`**.

**Effekt:** när onboarding kopierar `default_modules` → `tenant_modules.module_key`, skapas
en rad `module_key='loyalty'` som **inte matchar** någon `modules.key='lojalitet'`. Lojalitet
slås då aldrig på korrekt från default.

**Fix (välj en, var konsekvent):** antingen byt seed till `"lojalitet"` i alla `verticals.default_modules`, eller byt modulnyckeln till `loyalty` överallt. Rekommendation: **`lojalitet`** (modultabellen + RLS + owns_tables refererar redan så). Migration-förslag i §7.

---

## 7. Migrations-FÖRSLAG (ej körda — din beslut)

> Dessa är förslag formade ur din arkitektur. Inget är applicerat. Kör i staging först.

### 7.1 Rätta loyalty-nyckeln
```sql
UPDATE verticals
SET default_modules = default_modules - 'loyalty'
  || jsonb_build_object('lojalitet', default_modules->'loyalty')
WHERE default_modules ? 'loyalty';
```

### 7.2 Om du vill ha de extra branscherna (bilverkstad, tatuering, …)
De kräver INTE nya tabeller om de återanvänder befintliga moduler. Lägg bara rader i
`verticals` med passande `default_template`, `terminology`, `rules`. Exempel bilverkstad:
```sql
INSERT INTO verticals (key, name, default_template, default_modules, terminology, rules)
VALUES ('bilverkstad', 'Bilverkstad', 'edit',
  '{"booking":"live","offert":"draft"}',
  '{"staff":"Mekaniker","service":"Servicetyp","unit":"fordon"}',
  '{"booking":{"object":"slot","capture":["fordon"]}}');
```
Men "fordonsinfo/orderstatus" som EGNA moduler kräver nya tabeller + `modules`-rader +
RLS. Det är ett separat, större jobb — gör det bara när en riktig kund kräver det.

### 7.3 Seeda saknade template-sektioner
`edit`, `leander`, `linnea`, `zigge` har `sections=[]`. Innan de används som vertical-default
måste de få `sections` + `template_slots`, annars blir sajten tom.

---

## 8. Automation som REDAN finns i DB (du behöver inte bygga)

Ur `pg_proc` — relevanta funktioner/triggers som redan kör:

| Funktion | Vad den gör | Typ |
|---|---|---|
| `create_public_booking(...)` | Skapar bokning från publika sajten (validerar slot, tenant via slug) | RPC (anon) |
| `get_busy_intervals(...)` | Upptagna tider för personal i ett spann (driver lediga slots) | RPC |
| `get_public_booking(id)` | Hämtar en bokning publikt (bekräftelsesida) | RPC |
| `resolve_tenant_by_domain(host)` | Mappar domän/subdomän → tenant (multi-tenant routing) | RPC |
| `earn_loyalty_on_completed()` | Skriver `loyalty_ledger` när bokning blir completed | trigger |
| `record_booking_status_change()` | Loggar i `booking_status_history` vid statusbyte | trigger |
| `expire_abandoned_pending_bookings(ttl)` | Städar pending-bokningar äldre än TTL | cron-jobb |
| `seed_explicit_slots_from_hours(staff, step)` | Genererar bokningsbara slots ur arbetstider | RPC |
| `custom_access_token_hook(event)` | Stoppar in tenant_id/roll i JWT vid login | auth-hook |
| `tenant_modules_state_guard()` | Vaktar giltiga state-övergångar på moduler | trigger |
| `block_audit_mutation()` / `block_booking_hard_delete()` | Skyddar append-only / mot radering | trigger |
| `customer_contact_hash(...)` / `scrub_customer_notes_on_anonymize()` | GDPR: hash + anonymisering | RPC/trigger |
| `check_rate_limit(...)` | Rate-limit (skydd mot spam-bokningar) | RPC |

> **Python-scripten du nämnde:** de mesta "automatiska" finns redan som Postgres-funktioner/
> triggers/cron ovan. Det som rimligen ligger utanför DB (och vill ha ett script/edge-function):
> R2-bilduppladdning, utskick av välkomstmail/magic-link vid lansering, subdomän-provisionering
> (Cloudflare). Se §9.

---

## 9. Vad "Lansera" FAKTISKT gör (rader som skapas)

När du i studion trycker **Lansera kunden**, detta är sekvensen mot DB (det Code ska implementera):

1. **`tenants`** — INSERT `{slug, name, plan:'standard', status:'active', vertical_id, city}`.
2. **`tenant_settings`** — INSERT `{tenant_id, branding:{...}, settings:{...}, payment_mode:'on_site', payments_enabled:false}`.
3. **`tenant_modules`** — en rad per vald modul `{tenant_id, module_key, state:'live'|'draft'|'off', config:<default_config el. tweakad>}`.
4. **`tenant_domains`** — INSERT `{tenant_id, domain:'<slug>.corevo.se', is_primary:true, verified:true}`.
5. **`locations`** — minst en primär location `{tenant_id, name, is_primary:true, timezone:'Europe/Stockholm'}`.
6. **`roles`/`users`** — ägaren får en rad i `users` kopplad till tenant + ägar-roll (level >= 3).
7. **Auth-invite** — magic-link till `owner.email` (Supabase Auth; `custom_access_token_hook` stoppar in tenant_id i JWT).
8. **Subdomän** — Cloudflare-rutt för `<slug>.corevo.se` (edge/worker; `resolve_tenant_by_domain` gör DB-uppslaget vid request).
9. **Content** — kopiera `template_slots.default_*` → `content_slots` så sajten inte är tom dag 1.

**Allt utom steg 7–8 är ren DB-insert.** Steg 7–8 är de enda som behöver en
edge-function/Python-script (mail + Cloudflare-API). Det är där "automatiseringen" ska byggas.

---

## 10. Hur studion ska rättas (konkret lista till Code)

1. `cfg-data.js`: de **7 `live:true`-modulerna** byggs mot DB (`owns_tables` + `variant_schema`). Roadmap-moduler (`live:false`) lämnas kvar, märkta — **radera inte.**
2. `cfg-data.js`: de **5 `live:true`-branscherna** mappas mot riktiga `verticals` (läs `terminology`/`rules`/`default_template`/`default_modules`). Roadmap-branscher står kvar tills de seedas (§7.2).
3. Tabellnamnen på de 7 live-modulerna är nu rättade i `cfg-data.js` (`staff`, `shop_products`, `blog_posts`, `loyalty_ledger` …). `kund-admin/data.js` är kanon om något ändå krockar.
4. Modulväljaren: visa `default_section_position` (main vs null=infra). `media_library` är aldrig en "sektion".
5. Variant-kontrollerna: generera ur `variant_schema` (enum + params), inte hårdkodat.
6. Mallgalleriet: läs `templates` filtrerat på `tags.bransch` + visa `tags.licens` (fri/kräver-kredit).
7. Preview-redigering: koppla text→`content_slots`, bild→`media_assets`+`content_slots` (§5).
8. Lansera: utför sekvensen i §9 mot DB.
9. Rätta loyalty-nyckel-buggen (§6) innan default-moduler kopieras.

---

*Genererad ur live-schema 2026-06-16. Läs-endast access. Inga rader ändrades.*
