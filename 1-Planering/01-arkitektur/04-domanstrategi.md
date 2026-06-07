# 04 — Domänstrategi (Corevo Booking Platform)

Status: PLANERING. Ingen kod. Ingen DNS ändras nu. Detta beskriver bara hur det SKA sättas upp.
Datum: 2026-05-31
Domän-ägare: Zivar. Grunddomän: `corevo.se` (på Cloudflare).

> Kort sammanfattning för dig:
> - `corevo.se` = marknadssajt (rör vi inte).
> - `booking.corevo.se` = DITT kontrollcenter (admin / Platform Admin, M7).
> - `frisor1.corevo.se`, `frisor2.corevo.se` ... = test-sidor för varje frisör under bygget. Riktiga, live-nåbara.
> - `*.corevo.se` (wildcard) = allt okänt skickas till plattform-Workern, som listar ut vilken frisör det är.
> - Kundens EGEN domän (t.ex. `freshcut.se`) = SPÄRRAD. Kopplas INTE förrän du säger ja.

---

## 1. Översiktstabell — vilken domän gör vad

| Domän / subdomän              | Vad den gör                                   | Pekar mot         | Status              |
|-------------------------------|-----------------------------------------------|-------------------|---------------------|
| `corevo.se` (root)            | Marknadssajt (sälja in Corevo)                | Marknadssajt      | LEV (rör ej här)    |
| `www.corevo.se`               | Marknadssajt (redirect → root)                | Marknadssajt      | LEV (rör ej här)    |
| `booking.corevo.se`           | Admin / Platform Admin (M7) — DITT center      | Plattform-Worker  | LIVE-TEST           |
| `frisor1.corevo.se`           | Tenant-sida frisör 1 (boka tid)               | Plattform-Worker  | LIVE-TEST           |
| `frisor2.corevo.se`           | Tenant-sida frisör 2                          | Plattform-Worker  | LIVE-TEST           |
| `frisorN.corevo.se`           | Tenant-sida frisör N (en per tenant)          | Plattform-Worker  | LIVE-TEST           |
| `*.corevo.se` (wildcard)      | Fångar ALLA subdomäner → Worker host-parsar   | Plattform-Worker  | LIVE-TEST           |
| `api.corevo.se`               | (reserverad — ev. API-endpoint senare)        | —                 | RESERVERAD          |
| `[kundens egen domän]`        | Kund kör på eget namn (t.ex. freshcut.se)     | Cloudflare for SaaS | SPÄRRAD (se §6)   |

Förklaring status:
- LEV = lever redan, ingår inte i detta dokument.
- LIVE-TEST = ska bli riktig live-nåbar URL under bygget, så du kan klicka och se att det funkar.
- RESERVERAD = namnet får INTE bli en frisör-slug. Hålls tomt tills vi bestämt.
- SPÄRRAD = får INTE kopplas förrän du uttryckligen godkänner att kunden är redo.

Arbetsnamn-not: admin-panelen heter `booking.corevo.se` som arbetsnamn.
Alternativ som är öppna att välja: `admin.corevo.se` eller `app.corevo.se`. (Se öppna frågor §7.)

---

## 2. Hur en request flödar (ASCII)

```
  Besökare skriver:  frisor1.corevo.se/boka
        |
        v
  +-------------------------------+
  |  Cloudflare DNS               |
  |  *.corevo.se  (wildcard)      |   <-- en post fångar ALLA subdomäner
  +-------------------------------+
        |
        v
  +-------------------------------+
  |  Plattform-Worker             |
  |  (Next.js via OpenNext)       |   <-- EN app kör alla tenants
  +-------------------------------+
        |
        |  1. Läs host-header:  "frisor1.corevo.se"
        |  2. Host-parse:       ta första biten -> "frisor1"
        |  3. Reserverad-koll:  ar "frisor1" i [booking/admin/app/www/api]?  NEJ
        |  4. Slå upp slug:     slug "frisor1" -> tenant_id i databasen
        v
  +-------------------------------+
  |  Supabase (Postgres)          |
  |  RLS filtrerar pa tenant_id   |   <-- DATA-skyddet sitter HÄR
  +-------------------------------+
        |
        v
  Rätt frisörs sida visas (bara frisor1:s tjänster/tider)


  Specialfall — admin:
  booking.corevo.se  --> host-parse "booking" --> RESERVERAD --> visa Admin-panel (M7)
                         (INTE en tenant)
```

Viktigt i bilden: EN Worker + EN Next.js-app kör allt. Det är host-namnet (vilken subdomän
man kom in på) som avgör vilken frisör som visas. Datan hålls isär av RLS i databasen, inte
av domänen.

---

## 3. Wildcard-setup på Cloudflare (verifierat — KÖRS NÄR DU SÄGER TILL)

Mål: alla `*.corevo.se` ska träffa plattform-Workern (OpenNext Next.js).

Två delar måste stämma: (A) DNS-posten och (B) hur Workern kopplas till den.

### A. DNS-post (wildcard)
```
Typ:    A  (eller AAAA)
Namn:   *            (= *.corevo.se)
Värde:  proxy-placeholder-IP (t.ex. 192.0.2.1)
Proxy:  PÅ (orange moln)   <-- MÅSTE vara proxy:ad, annars kör inte Workern
```
- `*.corevo.se` täcker EN nivå djupt: `frisor1.corevo.se` = JA.
  Men `boka.frisor1.corevo.se` (två nivåer) = NEJ, täcks inte av ett enkelt `*`.
  För bygget räcker en nivå.
- `booking.corevo.se` kan ha EGEN A/CNAME-post (proxy:ad) ELLER fångas av samma wildcard
  + reserverad-listan i koden. Rekommendation: egen explicit post för admin = tydligare.

### B. Koppla Workern (välj EN av två sätt)

Sätt 1 — Workers Route (klassisk, funkar bra för wildcard i egen zon):
```
Route-mönster:  *.corevo.se/*
Zon:            corevo.se
Worker:         corevo-platform
```
- Route med `*` matchar subdomäner i din zon. Detta är vägen för wildcard.

Sätt 2 — Custom Domain på Workern:
- Custom Domain skapar en route + DNS-post automatiskt MEN en Worker Custom Domain
  pekar normalt på ETT exakt namn (t.ex. `booking.corevo.se`), inte ett wildcard.
- Slutsats: använd **Custom Domain för `booking.corevo.se`** (exakt namn, snyggt cert)
  och **Workers Route `*.corevo.se/*`** för alla tenant-subdomäner.

### SSL för wildcard (viktigt)
- Cloudflares standard Universal SSL-cert täcker `corevo.se` + `*.corevo.se`
  (= roten + en nivå subdomäner). Det räcker för `frisorN.corevo.se`.
- Två nivåer (`*.*.corevo.se`) täcks INTE av standardcertet — vi behöver inte det nu.
- Allt detta gäller subdomäner UNDER corevo.se. Kundens egna domäner = annan mekanism (§6).

> KÖR-INTE-NU-flagga: A + B ovan ändrar live-DNS. Görs först när du säger till.
> Marknadssajten på `corevo.se` (root) påverkas INTE av wildcard — root är en egen post.

---

## 4. Subdomän → tenant-mappning

Hur `frisor1` blir en frisör i systemet.

### Var slug lagras
Två tabeller (rekommendation):
```
tenants
  id            (uuid)        <- tenant_id, används av RLS överallt
  slug          (text, unik)  <- "frisor1"  (subdomänens första bit)
  display_name  (text)        <- "Frisör Ett" / riktigt salongsnamn
  ...

tenant_domains   (för framtiden — kundens egna domäner, §6)
  tenant_id     (uuid)
  hostname      (text, unik)  <- "freshcut.se"
  status        (text)        <- 'pending' / 'active'  (SPÄRRAD tills godkänd)
```
Under bygget: bara `tenants.slug` behövs. `frisor1` → rad med slug `frisor1` → `tenant_id`.

### Host-parse-logik (pseudokod, ingen riktig kod här)
```
host      = request host           // "frisor1.corevo.se"
sub       = host före ".corevo.se" // "frisor1"

om sub i RESERVED:                 // se nedan
    -> admin/plattform-route (inte tenant)
annars:
    tenant = slå upp tenants där slug = sub
    om hittad  -> visa tenant-sida (tenant_id sätts på sessionen/queryn)
    om saknas  -> 404 "okänd salong"
```

### Reserverade subdomäner (får ALDRIG bli en frisör-slug)
```
RESERVED = [ booking, admin, app, www, api ]
```
- En frisör kan alltså inte registrera slug `admin` etc. Validera vid skapande.
- Lägg till fler vid behov (t.ex. `status`, `mail`, `cdn`) — håll listan på ETT ställe i koden.

---

## 5. Auth (inloggning) över subdomäner

Problem: du loggar in på `booking.corevo.se` men en frisör loggar in på `frisor1.corevo.se`.
Vi vill att Supabase-auth-cookien funkar på rätt subdomäner.

### Lösning: cookie-domän `.corevo.se`
- Sätt auth-cookiens domän till `.corevo.se` (med inledande punkt).
- Då gäller cookien för `booking.corevo.se` OCH `frisor1.corevo.se` OCH alla `*.corevo.se`.
- Konkret: i Supabase SSR-klienten anges `cookieOptions: { domain: '.corevo.se' }`
  (samt `secure: true`, `sameSite: 'lax'`). Görs i bygg-steget, inte nu.

```
Inloggad session-cookie
   domain = .corevo.se
        |
        +--> booking.corevo.se     (du / admin)
        +--> frisor1.corevo.se     (frisör 1)
        +--> frisor2.corevo.se     (frisör 2)
```

### SÄKERHETSNOT (läs denna — viktig)
Cookie-domänen `.corevo.se` delar bara SJÄLVA INLOGGNINGS-SESSIONEN (vem du är).
Den delar INTE och skyddar INTE datan.

```
  Cookie (.corevo.se)  =  "vem är du?"   (auth-session)
  RLS + tenant_id      =  "vad får du se?" (data-isolering)
```

- Tenant-isolering (att frisör 1 aldrig ser frisör 2:s bokningar) sker via
  **RLS (Row Level Security) + tenant_id** i Postgres — INTE via cookien.
- Att två tenants delar cookie-domän läcker INTE data, så länge varje query körs
  under en RLS-policy som filtrerar på rätt `tenant_id`.
- Regel: ALDRIG lita på subdomänen ensam för åtkomst. Servern måste alltid
  härleda `tenant_id` och låta RLS filtrera. Cookien säger bara vem användaren är.

> Om RLS saknas eller är fel = data kan läcka mellan frisörer. RLS är skyddet. Prioritet.

---

## 6. Kunddomän-spärren (kundens egna namn)

Regel just nu: **INGEN** CNAME / custom hostname på en kunds eget namn (t.ex. `freshcut.se`)
förrän DU uttryckligen godkänner att kunden är redo att gå live.

- Under hela bygget kör varje kund på `frisorN.corevo.se` (test, du äger domänen).
- `tenant_domains.status` hålls `pending` tills godkänt.

### När tiden kommer (FRAMTIDA onboarding-steg — ej nu)
Teknik: **Cloudflare for SaaS — Custom Hostnames**.
```
1. Kund pekar sin domän till oss:
     CNAME  freshcut.se  ->  (vår SaaS-fallback-origin, t.ex. ssl.corevo.se)
2. Vi skapar ett Custom Hostname i Cloudflare for SaaS för "freshcut.se".
3. Cloudflare utfärdar SSL-cert för kundens domän automatiskt (per hostname).
4. Vi lägger raden i tenant_domains: hostname=freshcut.se, status=active.
5. Worker host-parse känner igen "freshcut.se" -> rätt tenant_id (via tenant_domains).
```
- Detta är en SEPARAT mekanism från `*.corevo.se`-wildcardet (som bara gäller corevo.se).
- Pekare: detaljerad gör-ordning skrivs i ett framtida onboarding-dokument
  (kommande "go-live / onboarding-steg"), som bygger vidare på §4 (tenant_domains)
  och §3 (Cloudflare-setup). Tills dess: SPÄRRAD.

> KÖR-INTE-NU-flagga: inget av detta görs förrän du säger "kund X är redo".

---

## 7. Öppna frågor (max 4)

1. **Admin-subdomänens namn:** `booking.corevo.se` (arbetsnamn) vs `admin.corevo.se`
   vs `app.corevo.se`? Vilket vill du ha? (Påverkar bara namnet, inte tekniken.)
2. **Frisörers slug:** ska det vara `frisorN` (frisor1, frisor2 ...) eller riktigt namn
   (`freshcut.corevo.se`)? Numrerat = enkelt under test. Namn = snyggare för kund.
3. **Wildcard nu eller per-tenant-post:** kör vi EN `*.corevo.se`-wildcard direkt,
   eller lägger en explicit DNS-post per frisör i början (mer kontroll, mindre magi)?
4. **Reserverad-lista:** räcker `[booking, admin, app, www, api]`, eller vill du
   blockera fler ord direkt (t.ex. `mail`, `status`, `support`)?

---

## Snabb-checklista (när du säger KÖR)
```
[ ] Bekräfta admin-subdomän-namn (fråga 1)
[ ] Bekräfta slug-stil (fråga 2)
[ ] DNS: wildcard *.corevo.se (A, proxy PÅ)          <- §3A
[ ] DNS/Custom Domain: booking.corevo.se             <- §3B
[ ] Workers Route: *.corevo.se/*  -> corevo-platform <- §3B
[ ] Verifiera Universal SSL täcker *.corevo.se       <- §3 SSL
[ ] tenants-tabell + slug + RLS på tenant_id         <- §4, §5
[ ] cookieOptions.domain = .corevo.se                <- §5
[ ] Kunddomäner: lämna SPÄRRADE                       <- §6
```
