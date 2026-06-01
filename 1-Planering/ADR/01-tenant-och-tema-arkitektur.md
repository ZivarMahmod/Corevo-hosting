# ADR 01 — Tenant- och tema-arkitektur

**Projekt:** Corevo Booking Platform (multi-tenant white-label boknings-SaaS för salonger)
**Stack:** Next.js (App Router) · Supabase (Postgres + Auth) · Cloudflare (hosting + R2) · Stripe Connect
**Status:** Beslutad (Zivar bekräftat)
**Datum:** 2026-05-31
**Typ:** Planering — ingen kod
**Refererar:** `00-modulkarta.md` (M9 fundament), `01-DB-schema.md` (tabeller + RLS)

---

## 1. Beslut (skarpt)

1. **EN kodbas för alla tenants.** Aldrig template-per-kund. Aldrig kodgren per kund. Skillnad mellan kunder = **DATA + TEMA**, inget annat.
   *Varför:* en fix når alla samtidigt, ett enda ställe att underhålla, inga divergerande grenar som ruttnar. Template-per-kund = N kopior att patcha = död på sikt. Matchar M9-målet "ny salong ansluts utan ny kod".
2. **Funktionaliteten är ALLTID identisk för alla tenants.** Det enda som varierar är utseende/layout. Ingen kund får "egen funktion" — funktioner byggs en gång, för alla.
3. **Tema-lager i 3 nivåer** (config → variant → custom). Se avsnitt 3.
4. **Auth = Supabase Auth + egna tabeller.** `users.id = auth.users.id`. `tenant_id` bärs som **JWT-claim i `app_metadata`** (server-satt, ej manipulerbar). Egen auth förkastad (säkerhetsrisk + onödigt jobb).
5. **Service-avgift konfigurerbar per tenant.** Default 5 kr. Fältet stödjer **både fast belopp (öre) OCH procent**. Värden som 0 / 3 / 5 / 10 kr eller X % sätts utan kodändring.

---

## 2. Tenant-modellen

### Hur en tenant identifieras (domän → tenant)

Verifierat mönster: Next.js officiella multi-tenant-guide (v16, uppdaterad 2026-05-28) → tenant löses i **middleware** via Host-header, enligt Vercels Platforms Starter Kit.

```
Besökare → salongx.se   (eller  salongx.corevo.app)
        │
        ▼
┌──────────────────────────────┐
│  Cloudflare (DNS + edge)      │  alla kund-domäner pekar hit
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│  Next.js middleware           │  läser Host-header
│  host → tenant-lookup         │  cache (edge / Cloudflare)
│  mot tenant_domains.domain    │
└──────────────┬───────────────┘
               ▼
        tenant_id = "uuid-x"
   sätts i request-context (header)
               │
               ▼
   App renderar med rätt tenant + tema
```

- **Lookup:** tabellen `tenant_domains` (finns redan: `domain` unik, `is_primary`, `verified`). Middleware slår host → `tenant_id`. Subdomän `*.corevo.app` hanteras samma väg.
- **Cache:** lookupen cachas på edge så varje request inte träffar DB. Invalidieras när domän ändras/verifieras.
- **Okänd host →** fallback/landningssida (marketing-sajt), inte krasch.

### Hur data isoleras (RLS + tenant_id)

Redan fastlagt i `01-DB-schema.md` (verifierat mot Supabase RLS-doc 2026-05-29). Sammanfattat:

- **Varje affärstabell har `tenant_id`** (kolumn T i schemat).
- **RLS på i Postgres.** Policy använder helpern `auth.tenant_id()` som läser claimen ur `app_metadata`. Appen behöver aldrig manuellt `WHERE tenant_id = …` — glömt filter läcker ändå inget.

```
┌──────────── Postgres (Supabase) ─────────────┐
│  bookings   [tenant_id, …]                    │
│  customers  [tenant_id, …]   ◄── RLS policy   │
│  services   [tenant_id, …]       using (      │
│  ...                              tenant_id =  │
│                                   (select      │
│                                   auth.tenant_id())) │
└───────────────────────────────────────────────┘
        ▲
        │  JWT bär tenant_id (app_metadata, server-satt)
   inloggad användare / service-anrop
```

**Två lager:** middleware väljer tenant (routing/UX) + RLS spärrar i DB (säkerhet). Säkerheten vilar på RLS, inte på app-koden.

---

## 3. Tema-lagret (3 nivåer)

Princip: **config-drivet tema via CSS-variabler (design tokens).** Motorn (komponenterna) är identisk; tokens + variant-val + ev. override byter utseende. Standardmönster för Next.js multi-tenant 2026: tenant-värden läses server-side (RSC) och injiceras som CSS custom properties; komponenterna refererar bara variablerna — inga kund-specifika komponenter behövs för ~90 %.

> **Återanvänder befintliga schema-fält** (`tenant_settings` finns redan med `branding jsonb`, `settings jsonb`, `payment_mode`). Theming ryms i `branding` + `settings`. Bara avgiftsfält behöver nytt (avsnitt 7).

| Nivå | Vad | Var det lagras | Hur det renderas | Täcker |
|------|-----|----------------|------------------|--------|
| **1 — Config** | Logga, färger, typsnitt | `tenant_settings.branding` (jsonb) | Server läser tenant → injicerar som CSS-variabler (`--color-primary`, `--font-body`, …) på layout-wrapper. Komponenter använder bara variablerna. | ~90 % |
| **2 — Layout-varianter** | Färdiga val: hamburgermeny A/B, hero 1/2/3 osv. | `tenant_settings.settings.layout` (jsonb, t.ex. `nav_variant`, `hero_variant`) | Variant-fält → komponentval (map: `A → <NavA/>`, `B → <NavB/>`). Alla varianter finns i kodbasen; kunden väljer bara. | ~9 % |
| **3 — Custom** | Kund vill nåt helt eget | `tenant_settings.settings.custom_override` (flagga + ref) | Corevo bygger isolerad override för just den tenanten. Laddas villkorligt enbart för den tenanten. Motorn + andra tenants orörda. | ~1 % |

### Nivå 1 — konkret flöde (config)

```
tenant_settings.branding (jsonb)
   { "color_primary":"#b5651d", "font_body":"Inter", "logo_url":"…" }
        │  läses server-side (RSC) vid render
        ▼
<body style="--color-primary:#b5651d; --font-body:Inter">
        ▼
.btn { background: var(--color-primary) }   ← samma komponent, alla tenants
```

Byte av färg/logga = **uppdatera `branding`-jsonb**, ingen deploy. Corevo eller kunden klickar in det (M7 Platform Admin / M6 Salon Admin).

### Nivå 2 — konkret flöde (varianter)

```
tenant_settings.settings.layout = { "nav":"B", "hero":"2" }
        ▼
function Nav({variant}) {            function Hero({variant}) {
  if (variant==="A") <NavA/>           if (variant==="2") <Hero2/>
  if (variant==="B") <NavB/>           ...
}                                     }
```

Rent variant-val (feature-flag-stil): ett enda val-ställe per slot, inga utspridda if-satser. Ny variant = ny komponent + nytt giltigt värde, för alla.

### Nivå 3 — custom-override utan att röra resten (verifierat säkert mönster)

Problem: en kunds custom-CSS får **inte läcka** till andra tenants (samma app, samma kodbas).

Lösning — **scoping** så CSS:en bara biter inom den tenantens DOM:

```
<body data-tenant="uuid-x">
   … custom CSS laddas BARA när tenant = uuid-x …

/* tenant-override (villkorligt laddad) */
[data-tenant="uuid-x"] .hero { clip-path: … ; }
```

- **Villkorlig laddning** server-side: `if (settings.custom_override) → injicera tenant-X-override`. Andra tenants får aldrig ens filen.
- **All custom-CSS scopas** under `[data-tenant="…"]` (eller wrapper-klass) → kan fysiskt inte träffa annan kunds sidor.
- Custom = **additivt ovanpå** nivå 1+2, aldrig en gren. Motorn + övriga tenants rörs aldrig.
- Custom-komponent-override (om mer än CSS behövs): laddas via samma flagga, isolerad fil per tenant, mappad på `tenant_id`.

> **Verifiering:** Next.js officiella multi-tenant-guide (v16.2.6, 2026-05-28) rekommenderar middleware-baserad tenant-resolution + Vercels Platforms Starter Kit som referensarkitektur. Tema via CSS custom properties injicerade server-side från tenant-config är det etablerade React/Next-mönstret. Scoping via attribut/klass + villkorlig laddning är standardmetoden för att isolera per-tenant CSS. (Vercel doc-sök gav tomt svar i sessionen; guiden hämtades däremot direkt och bekräftar middleware-mönstret.)

---

## 4. Auth-modellen

Redan grundlagd i `01-DB-schema.md` avsnitt 4 (verifierat mot Supabase-doc). Sammanfattat för ADR:

```
Användare loggar in  →  Supabase Auth (auth.users)
        │
        │  vid skapande/inbjudan: Custom Access Token Hook sätter
        │     app_metadata.tenant_id = "uuid-x"  (server-side, ej klient)
        ▼
JWT (access token) innehåller app_metadata.tenant_id
        │
        ▼
Varje DB-anrop bär JWT → auth.tenant_id() läser claim → RLS filtrerar rader
```

- **Egna tabeller länkas:** `users.id = auth.users.id`. Profildata + roll (`role_id`, 8-nivå) i egna tabeller; identitet/lösenord hos Supabase Auth.
- **`tenant_id` i token:** `app_metadata` (server-kontrollerat, kan ej manipuleras av klienten — till skillnad från `user_metadata`).
- **RLS läser claimen:** via `auth.tenant_id()`-helpern (STABLE, subquery-wrappad → planner-cache).
- **Varför inte egen auth:** lösenord, sessions, MFA, återställning = säkerhetskänsligt, löst sedan länge av Supabase. Egen auth = risk + jobb utan vinst.
- **1 user = 1 tenant** (default, JWT-claim). Corevo Admin/Super Admin (nivå 7-8) via global roll/service-role, ej tenant-scopad. Multi-tenant-per-user är öppen fråga 3 i schemat.

---

## 5. Avgiftsmodell (fast kr ELLER procent per tenant)

Fältet måste uttrycka **antingen** fast belopp **eller** procent. Lösning: typ + värde, lagras i `tenant_settings`.

| Fält | Typ | Betydelse | Exempel |
|------|-----|-----------|---------|
| `service_fee_type` | text/enum (`'fixed'` \| `'percent'`) | Hur värdet tolkas | `'fixed'` |
| `service_fee_value` | int (öre vid fixed) / numeric (procent) | Beloppet eller procent-talet | `500` (= 5 kr) / `2.5` (= 2,5 %) |

Beräkning vid bokning:
```
type = 'fixed'   → avgift = service_fee_value              (öre)
type = 'percent' → avgift = price_cents * service_fee_value / 100
```

- **Default:** `type='fixed'`, `value=500` → 5 kr.
- Täcker 0 kr (`fixed`/`0`), 3 / 5 / 10 kr, valfri procent — **utan kodändring**, bara data.
- **Fast belopp i öre** (heltal, matchar `price_cents`/`amount_cents` i schemat) → undvik decimal-fel. Procent som numeric.
- Avgiften flödar in i Stripe Connect (application fee). Split mot connected account regleras i Stripe-ADR (M8), inte här.

---

## 6. Konsekvenser

| Lätt (vinst) | Svårt (kostnad / att vakta) |
|--------------|------------------------------|
| En fix når alla tenants direkt | Delad kodbas → en bugg kan slå mot alla. Kräver bra tester + RLS-disciplin |
| Onboarda ny kund = ny rad + tema, ingen deploy (M9-målet) | Custom-nivån (3) måste hållas liten + scopad, annars växer special-skuld |
| Tema-byte utan deploy (data-drivet i `branding`) | Nya varianter måste byggas generiskt för alla, inte som dold kund-special |
| Säker dataisolering via RLS oavsett app-buggar | RLS-policy måste finnas på *varje* tenant-tabell — glömd tabell = läcka. Måste in i migration-checklista |
| Identisk funktionalitet = enkel support, en mental modell | Press från kund om "bara en liten egen funktion" måste hållas tillbaka (bryter beslut 1 & 2) |
| Supabase Auth = ingen egen säkerhetsbörda | Beroende av Supabase (auth + RLS-claim-flöde + token-refresh vid ev. tenant-byte) |

---

## 7. Ändringar i DB-schemat

Schemat (`01-DB-schema.md`) har redan det mesta. Bara avgiftsfälten är nya. Theming ryms i befintliga jsonb-kolumner.

**`tenant_settings` — befintliga kolumner som återanvänds (ingen ändring):**

| Kolumn | Typ | Används till |
|--------|-----|--------------|
| `branding` | jsonb | Tema nivå 1: färger, typsnitt, `logo_url` |
| `settings` | jsonb | Tema nivå 2: `layout.{nav_variant,hero_variant,…}` · nivå 3: `custom_override` (flagga + ref) |
| `payment_mode` | text | (finns) on_site/online/both/coming_soon |

**`tenant_settings` — NYA kolumner (avgift):**

| Kolumn | Typ | Default | Syfte |
|--------|-----|---------|-------|
| `service_fee_type` | text not null, check in (`'fixed'`,`'percent'`) | `'fixed'` | Avgiftstyp |
| `service_fee_value` | int not null | `500` | Belopp (öre) vid fixed, eller procent-tal vid percent |

> Alternativ: lägga avgiften i `settings`-jsonb istället för egna kolumner. **Rekommendation: egna kolumner** — avgiften läses/aggregeras i M8 (betalningar) och M7 (Corevo-avgifter), då vill man ha typad kolumn + index, inte jsonb-uppslag. Theming däremot är ren render-config → jsonb räcker.

**Inget nytt behövs för:**
- Domän-lookup → `tenant_domains` finns redan.
- RLS → helper `auth.tenant_id()` + policy-mönster finns redan i schemat. Nya `service_fee_*` ärver `tenant_settings` befintliga RLS-policy (samma rad, samma tenant).
- Auth-koppling → `users.id = auth.users.id` finns redan.

**Process-krav (oförändrat från schemat):**
- Ingen ny tenant-tabell utan RLS-policy (migration-checklista).
- `tenant_id` sätts i `app_metadata` via Custom Access Token Hook (öppen fråga 1 i schemat).

---

*Slut ADR 01.*
