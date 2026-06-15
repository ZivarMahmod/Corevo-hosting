# 03 — Innehålls- & asset-modellen (content-slots + R2)

> Spår 3 av multi-bransch-bygget. Paraply: `../01-arkitektur/multibransch-plattform-arkitektur.md` §15. Ingång/kontrakt: `00-plan-index.md`.
> **Status: PLANERING. Ingen kod, ingen migration, ingen R2-bucket skapas i denna fas.**
> Detta spår äger: hur en mall får innehåll bakom sig (slots), var bilderna bor (R2), hur kunden får lagom mycket lagring (bibliotek = betald toggle), och hur en bild-swap i super-admin slår igenom på kundens skarpa sida.

Håller de **delade kontrakten** från plan-index ordagrant: `content_slots`, `templates(...sections[])`, `tenant_modules(...config jsonb)`. Bygger PÅ befintliga `media_assets` (DB-schema §2 CMS/media) — uppfinner ingen parallell asset-tabell.

---

## 0. Var detta sitter i lagermodellen

```
template (skin: tokens + sections[])           ← spår 2 äger templates
        │  varje sektion deklarerar slots den behöver
        ▼
content_slots  (per tenant × template × slot)  ← DETTA SPÅR
        │  varje slot binder ETT av: { asset | text | modul-data }
        ├── asset  → media_assets.id  → R2-objekt  → publik CDN-URL
        ├── text   → inline text/rich-text i sloten
        └── module → "rendera modulens egen data här" (bokning/shop/…)
        ▼
storefront  (renderar live-moduler + skin + slot-innehåll)
   på <slug>.boka.corevo.se / egen domän
```

Princip (§15, LÅST): **skelett = moduler + DB; skin = mall.** En slot är limmet mellan skin och data. En slot säger *var* något visas; modulen/asset:en/texten säger *vad*. Saknar mallen ett element kunden behöver → modulen lägger dit det (modulen äger funktionen), inte sloten.

---

## 1. content_slot-datamodellen

### 1.1 Kärnidé
**En rad per (tenant × template × slot-nyckel).** Sloten är en namngiven plats i en mall-sektion. Den pekar på ETT innehåll via en diskriminerad union (`kind`): asset, text eller modul-data. Slot-katalogen (vilka slots en mall HAR) bor på mallen; slot-VÄRDET (vad denna kund stoppade i) bor per tenant.

Två-lagers-modell — viktig:
- **`template_slots`** (mall-nivå, super-admin-data, ej tenant-scopad): mallens *deklaration* av sina slots — "haircut-mallen har `hero.bg`, `team.member[0..3].photo`, `about.heading` …". En rad per (template × slot_key). Detta är resultatet av auto-detect (avsnitt 2) som Zivar godkänt. Default-värde kan ligga här (mallens stockbild/placeholder-text).
- **`content_slots`** (tenant-nivå, RLS-scopad): kundens *ifyllda* värde för en slot. En rad per (tenant × template × slot_key). Saknas rad → storefront faller tillbaka på `template_slots.default_*` (mallens stock).

Varför dela upp: mallen ska kunna kategoriseras/godkännas EN gång (spår 2/4) oberoende av kund; tusen kunder på samma mall delar slot-katalogen men har egna värden; en ny mall-version kan lägga till slots utan att röra kunddata (build-once-never-delete).

### 1.2 Skiss — `template_slots` (mall-nivå, super-admin write / tenant read)
```sql
create table template_slots (
  id           uuid primary key default gen_random_uuid(),
  template_key text not null references templates(key) on delete cascade,
  section_key  text not null,                 -- vilken sektion i templates.sections[] (t.ex. 'team')
  slot_key     text not null,                 -- stabil nyckel, t.ex. 'team.member.0.photo'
  label        text not null,                 -- mänsklig etikett i super-admin ("Frisör 1 – bild")
  kind         text not null
    check (kind in ('asset','text','module')),
  -- vid kind='asset': vilken sorts media + rekommenderad form
  asset_role   text,                          -- 'image' | 'logo' | 'gallery' | 'video' (utbyggbart)
  aspect_hint  text,                          -- '16:9' | '1:1' | '4:5' — för beskärnings-UI (ej hård regel)
  -- vid kind='module': vilken modul + vy som ska renderas här
  module_key   text,                          -- t.ex. 'booking' (matchar modules.key)
  module_view  text,                          -- t.ex. 'service_list' | 'booking_cta'
  repeatable   boolean not null default false,-- true för upprepade kort (team/galleri) — se 2.2
  sort_order   int not null default 0,
  default_kind text,                          -- mallens stock-default (oftast 'asset' eller 'text')
  default_text text,                          -- stock-rubrik/brödtext
  default_asset_key text,                     -- R2-key till mallens stockbild (plattform-ägd, ej tenant)
  unique (template_key, slot_key)
);
```

### 1.3 Skiss — `content_slots` (tenant-nivå, RLS via `private.tenant_id()`)
```sql
create table content_slots (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  template_key text not null,                 -- vilken mall kunden kör (matchar tenant_settings tema)
  slot_key     text not null,                 -- = template_slots.slot_key
  kind         text not null
    check (kind in ('asset','text','module')),
  -- exakt EN av nedan är satt beroende på kind:
  asset_id     uuid references media_assets(id) on delete set null,  -- kind='asset'
  text_value   jsonb,                         -- kind='text': { format:'plain'|'rich', value:'…' }
  module_ref   jsonb,                         -- kind='module': { module_key, view, params }
  updated_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  unique (tenant_id, template_key, slot_key)
);
create index on content_slots (tenant_id, template_key);
```

**Nyckling (kravet i briefen):** unik per `(tenant_id, template_key, slot_key)`. Byter kunden mall behålls gamla mallens slot-rader (build-once-never-delete) men storefront läser bara den aktiva mallens rader → ofarligt, och byter kunden tillbaka är innehållet kvar.

**Resolver-regel (storefront, en plats):** för varje slot i aktiv mall →
1. finns `content_slots`-rad för (tenant, template, slot)? använd den.
2. annars `template_slots.default_*` (mallens stock).
3. `kind='asset'` med `asset_id=null` ⇒ rendera inget / dölj elementet (§15: element utan data tas bort).

### 1.4 Varför inte bara stoppa allt i `tenant_settings.branding`/`settings` (jsonb)?
`branding`/`settings` (DB-schema §2) håller GLOBALA tema-val (logo, primärfärg, font, nav/hero-variant). De är få och tema-breda. Slots är MÅNGA, per-sektion, per-mall och måste vara enskilt redigerbara + cache-invaliderbara + kvot-mätbara (assets). Egen tabell ger rad-nivå-redigering i super-admin-hubben (spår 4) och en ren join slot→asset→URL. Logo förblir i `branding` (det är ett tema-token, inte en slot); en mall får referera `branding.logo_url` i en logo-slot via `default_kind='asset'` som pekar dit — men det är spår 2:s tokenfråga, inte denna.

---

## 2. Auto-upptäckt av slots i en mall

Mål (§15): agenten skannar en rå mall, **föreslår** en slot-lista, **Zivar godkänner** → blir `template_slots`-rader. Aldrig auto-publicera utan godkännande. Detta är en super-admin-tidsoperation (vid mall-onboarding), inte runtime.

### 2.1 Vad som skannas (statisk analys av mallens HTML/markup)
| Signal i mallen | Slot som föreslås | kind |
|---|---|---|
| `<img src>`, `<picture>`, CSS `background-image` på hero/sektion | bild-slot per fyndplats | asset |
| `<h1>/<h2>` + ledande brödtext-stycke i en sektion | rubrik-/text-slot | text |
| Upprepade kort med samma struktur (team-block, galleri, tjänstekort) | **EN repeatable slot-mall** + N instanser | asset/text |
| Logo i header | logo-slot (binder mot `branding.logo_url`) | asset |
| Sektion som motsvarar en modul (boknings-CTA, prislista, "boka tid") | modul-slot | module |

**Exempel — haircut-mallen (de 4 barber-bilderna):** skannern hittar ett team-block med 4 strukturlika kort, var och en med `<img>` + namn + titel. Förslag:
- `team` = `repeatable` med per-instans-slots: `team.member.{i}.photo` (asset), `team.member.{i}.name` (text), `team.member.{i}.role` (text), seedat för i=0..3 från mallens stockinnehåll.
- Lägger kunden till en femte frisör → ny instans-rad i `content_slots` med `slot_key='team.member.4.photo'` (repeatable tillåter växande index). Tar bort en → instans-rad tas bort på tenant-nivå (mallens deklaration orörd).

### 2.2 Repeatable-mönstret (kärnan i auto-detect)
- `template_slots` håller EN deklaration med `repeatable=true` + `default_count` (här 4) + en slot_key-mall (`team.member.{i}.photo`).
- `content_slots` materialiserar instanser per index (`{i}` ersatt). Min/max-antal kan ligga i `template_slots` (t.ex. galleri 0–24).
- Storefront itererar instanserna i `sort_order`/index och renderar mallens kort-markup per instans.

### 2.3 Förslags-flödet (super-admin, godkänn-loop)
1. Agent skannar mall → genererar förslags-JSON (lista av slots med kind, label-gissning, aspect_hint, repeatable-grupper).
2. Super-admin-vy visar förslagen ovanpå en live-preview av mallen (spår 4), varje förslag markerat på sin plats.
3. Zivar: behåll / döp om / ändra kind / ta bort / slå ihop. (T.ex. "den här bilden är dekor → ingen slot".)
4. Godkänt → skriver `template_slots`. Mallen blir "slot-redo" och kan väljas i onboarding.
> Auto-detect = **förslag**, godkännande = **sanning**. Matchar §15-regeln "agent auto-upptäcker → Zivar godkänner" och projektets design-trohet (aldrig auto-improvisera in i skarpt).

---

## 3. Asset-lagring i Cloudflare R2

Bygger på befintliga `media_assets(id, tenant_id, r2_key, url, type, alt, size_bytes)`. Föreslagna tillägg (additivt, build-once): `width int`, `height int`, `content_hash text`, `source text` ('upload'|'library'|'stock'), `library_item_id uuid null`. `url` = den publika CDN-URL:en storefront läser direkt.

### 3.1 Bucket-modell — EN bucket, prefix per tenant
**En R2-bucket för plattformen** (t.ex. `corevo-tenant-assets`), inte en bucket per kund. R2 har inget hårt bucket-tak som gör per-kund-bucket nödvändigt, och en bucket + prefix ger enklast lifecycle, billing-summering och kod. Isolering sker i DB (RLS på `media_assets`/`content_slots`) + i nyckel-prefix, inte i separata buckets.

**Nyckel-struktur (content-addressed):**
```
tenants/{tenant_id}/{asset_role}/{content_hash}.{ext}
   ex: tenants/8f3c…/image/a1b2c3d4e5f6.webp
plattform-stock (ej tenant, mallarnas default-bilder):
   platform/templates/{template_key}/{slot_key}/{hash}.{ext}
bildbibliotek (delad katalog, kopieras till tenant vid val — se 4):
   library/{category}/{item_id}/{variant}.{ext}
```
**Content-addressed (hash i nyckeln) — bärande val:** samma bild laddas aldrig två gånger; en bild-swap skriver ett NYTT objekt med ny nyckel (gammalt objekt orört) → **URL ändras → cachen missar automatiskt** (avsnitt 5). Detta löser cache-invalidering nästan gratis. `tenant_id` i prefixet gör per-tenant-städning och kvot-summering trivialt (lista prefix).

### 3.2 CDN-leverans — publik bucket bakom custom domain
- R2-bucketen exponeras som **public bucket bakom en custom domain** (t.ex. `assets.corevo.se` eller `cdn.boka.corevo.se`), INTE via `r2.dev` (det är dev-only och saknar cache/WAF-kontroll). Custom domain = full Cloudflare Cache + WAF framför objekten. (Källa: CF R2 public-buckets-doc, avsnitt nedan.)
- Upload-headers på objekten: `Cache-Control: public, max-age=31536000, immutable` (säkert eftersom nyckeln är content-addressed). + korrekt `Content-Type`.
- Smart Tiered Cache på den zonen → en övre cache-nivå nära bucketen.
- **Storefront läser INTE R2 via SDK vid request.** Storefront läser `content_slots → media_assets.url` ur Postgres (en kolumn) och sätter den URL:en i `<img src>`. Bilden hämtas av slutanvändarens browser direkt från CDN-domänen. Worker rör aldrig bild-bytes på den heta vägen.
- Upload-vägen (super-admin lägger/byter bild) går via en Worker/Edge Function med R2-binding (`env.BUCKET.put(key, body)`), som beräknar hash, skriver objektet, skriver `media_assets`-raden, och uppdaterar slotens `asset_id`. (Källa: CF R2 Workers-API-doc.)

### 3.3 Namngivning & format
- Normalisera vid upload till `webp` (+ ev. behåll original för nedladdning). Lagra `width`/`height` för layout/`aspect_hint`-validering.
- Storleksvarianter (responsivt): antingen (a) generera 2–3 bredder vid upload (`…/{hash}@{w}.webp`) eller (b) Cloudflare Images/Image Resizing framför bucketen. **Förslag V1: (a) enkla fasta bredder** (mindre rörliga delar, ingen extra produkt). Image Resizing är en senare optimering — öppen fråga om kostnad.

---

## 4. Bildbibliotek som BETALD toggle + storage-billing-hook

### 4.1 Modell
- **Varje kund får X bilder / Y MB inkluderat** i basplanen (förslag: t.ex. 25 bilder eller 500 MB — Zivar sätter siffran). Det räcker för en typisk storefront (hero, team, galleri).
- **Bildbiblioteket** = en kurerad delad katalog (stockbilder per bransch) OCH/ELLER utökad egen lagringskvot. Att slå på det = en **modul/feature-toggle per kund**, exakt som "toggle per kund = röd tråd".
- Toggle bor i **`tenant_modules`** som en modul, t.ex. `module_key='media_library'`, med `state` (off/draft/live/paused) och `config jsonb`. Detta är platsen §15 utpekar ("storage-billing-hook i `tenant_modules`").

### 4.2 Var det bokförs — `tenant_modules.config` (det delade kontraktet)
```jsonc
// tenant_modules-rad: (tenant_id, module_key='media_library', state, config)
"config": {
  "plan": "library_pro",            // null/avsaknad = bara bas-kvoten
  "quota_bytes": 5368709120,        // 5 GB tak för denna kund (bas + köpt)
  "included_bytes": 524288000,      // 500 MB ingår utan biblioteks-toggle
  "billing": {                      // STORAGE-BILLING-HOOK (rails pausade → bara hook nu)
    "metric": "stored_gb",          // R2 debiterar lagring, ej egress (egress=fri) → mät GB
    "unit_price_hook": "media_library.storage_gb",  // pris-nyckel, faktisk siffra när rails öppnas
    "billable_since": null          // sätts när rails aktiveras (compliance: rör pengar → parkerat)
  }
}
```
> **Compliance-flagga (matchar §14.2 + memory):** detta är BARA en hook. Inga belopp, ingen fakturering, inga betal-rails aktiveras i denna fas. Pris-nyckeln (`unit_price_hook`) pekar mot prissättning som beslutas när rails öppnas. Pushar aldrig en betalleverantör som tvång.

**Varför mäta lagring (GB), inte bandbredd:** R2:s prismodell = lagring `$0.015/GB-månad`, **egress GRATIS**, fri-nivå 10 GB-månad (CF R2 pricing-doc). Bandbredd kostar alltså inget — den naturliga och enda meningsfulla kvot-axeln är *lagrad volym per tenant*. Det gör hooken ärlig mot den faktiska kostnaden.

### 4.3 Enkel kvot/mätning
- **Mätning:** `sum(media_assets.size_bytes) where tenant_id = X` = kundens använda lagring. Billigt (indexerat på tenant_id), inget R2-API-anrop behövs för mätning eftersom `size_bytes` speglas i DB vid upload.
- **Tak-check vid upload:** innan `put` → om `använt + ny_fil > quota_bytes` ⇒ vägra med "uppgradera bildbibliotek" (leder till toggle-uppsälj, Zivar slår på `media_library`). Bas-kunder utan toggle: tak = `included_bytes`.
- **Periodisk sanity-summering** (valfritt, senare): jämför DB-summa mot faktisk R2-prefix-storlek per tenant för drift-koll. Inte nödvändigt för V1.
- Bibliotekets stockbilder som kunden *väljer* kopieras (eller refereras) till tenantens prefix → räknas mot kvoten bara om de materialiseras per tenant (förslag: referera delad `library/`-bild via egen `media_assets`-rad med `source='library'` och `size_bytes` satt, så kvoten är konsekvent). Öppen detalj, ej blockerande.

---

## 5. Bild-swap i super-admin → kundens SKARPA sida (var datat bor + cache)

### 5.1 Var datat bor (en sanningskälla)
Den skarpa sidan läser **alltid** live ur Postgres: `content_slots.asset_id → media_assets.url`. Det finns ingen separat "publicerad kopia" av slot-innehåll — storefront renderar mot DB. Alltså: byter Zivar en bild i super-admin-hubben (spår 4) och skriver `content_slots`-raden, är nästa render på kundsidan redan korrekt. (Modul-publicering off/draft/live styr om en MODUL syns; slot-innehåll på en redan-live mall är direkt.)

### 5.2 Swap-flödet
1. Zivar klickar en bild-slot i live-previewen (spår 4) → väljer ny bild (upload eller ur bibliotek).
2. Worker: beräkna `content_hash` → `put` nytt R2-objekt på `tenants/{id}/image/{hash}.webp` → skapa/återanvänd `media_assets`-rad (ny URL) → `update content_slots set asset_id=…, updated_at=now()` för (tenant, template, slot).
3. Storefront nästa render läser nya `asset_id` → nya `url`. Klart.

### 5.3 Cache-invalidering — content-addressing som primär, purge som fallback
- **Primärt (gratis):** content-addressed nyckel ⇒ ny bild = **ny URL**. Gamla URL:en cachas vidare ofarligt (ingen pekar på den längre), nya URL:en är en cache-miss första gången och fylls sen. **Ingen aktiv purge behövs för bild-bytet.**
- **HTML-sidans cache:** om storefront-sidan (Worker-svaret) cachas på edge måste DEN invalideras så `<img src>` pekar på nya URL:en. Två rena vägar:
  - (a) Rendera storefront-HTML **utan edge-cache** eller med kort TTL + `stale-while-revalidate` (sidan är liten, bilderna är det tunga och de är permanent-cachade). Enklast, rekommenderas V1.
  - (b) **Single-file purge by URL** (instant, rekommenderad CF-metod) av kundens sid-URL:er när en slot ändras (CF cache-purge-doc; fri plan 800 URL/s, 100/request — gott om marginal). Cache-tag-purge kräver Enterprise → undvik som beroende.
- **Stabil-nyckel-undantag:** om vi någonsin överskriver samma R2-nyckel (t.ex. logo på fast sökväg) → då KRÄVS single-file purge by URL av just den objekt-URL:en. Content-addressing undviker detta för slot-bilder.

### 5.4 Konsekvens
Modellen ger "WYSIWYG på skarpa sidan" som §15 vill ha, utan en separat publiceringspipeline för innehåll: DB är källan, content-hash gör bild-cache självinvaliderande, och en kort sid-TTL (eller riktad URL-purge) gör att markup-ändringen syns direkt.

---

## 6. Öppna frågor till Zivar
1. **Bas-kvot:** hur mycket lagring/antal bilder ingår gratis per kund innan biblioteks-toggle (t.ex. 25 bilder / 500 MB)? Och vad är nästa steg-tak (5 GB?).
2. **Responsiva varianter:** fasta bredder genererade vid upload (enklast, V1) eller Cloudflare Images/Image Resizing framför bucketen (snyggare, extra produkt + kostnad)?

---

## 7. Kontrakt-status (mot plan-index)
Håller alla delade namn: `content_slots` (slot per template-sektion → `{asset|text|module}`, nyckel per tenant×template×slot ✓), `templates(...sections[])` (refereras, ej ändrad ✓), `tenant_modules(...config jsonb)` (storage-billing-hook lagd i `config`, modul `media_library` ✓). Bygger på `media_assets` (additiva kolumner, build-once ✓). RLS: `content_slots` tenant-scoped via `private.tenant_id()`; `template_slots` = super-admin write / tenant read (✓ matchar plan-index katalog-regel). **Ingen kontrakt-krock.** En notering till spår 1 (DB-grund): RLS-helpern heter `private.tenant_id()` (HANDOFF/CLAUDE), medan `01-DB-schema.md` skissar `auth.tenant_id()` — bör synkas i DB-grund-spåret.
```
