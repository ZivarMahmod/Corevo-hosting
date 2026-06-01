# G13 Go-live — status + Zivar-steg

booking.corevo.se (back-office) + demo.corevo.se (storefront) på Worker
`bokningsplatformen`. POS (corevo.se Pages) orörd hela vägen — verifierat.

## ✅ LIVE + verifierat (denna session)
- **booking.corevo.se** (Custom Domain) — login funkar live, alla 3 roller (Playwright-verifierat):
  - `platform@corevo.se` / `Demo!1234` → ren `/` "Plattform · Översikt" (super_admin) — INTE `/platform`.
  - `admin@frisor1.se` / `Demo!1234` → `/admin` "Salongsadmin" (Frisör Demo).
  - `klippare@frisor1.se` / `Demo!1234` → `/personal` "Personal — idag" (staff).
  - `/salonger` + `/fakturering` skyddade (redirect→/login utan session).
- **demo.corevo.se** (Custom Domain) — storefront live: `/` (Frisör Demo + 3 tjänster + Boka), `/boka`, `/registrera` (formulär) renderar 200.
- **Moln-DB** konsoliderad: frisor1→`demo` (customer-accounts PÅ, demo.corevo.se), frisor2 raderad.
- **POS-koll:** `corevo.se` + `admin.corevo.se` → 200, oförändrade.
- **Worker** `bokningsplatformen` deployad (senaste version med `vars`-blocket nedan).

### Viktig fix denna session — NEXT_PUBLIC_* som RUNTIME vars
OpenNext-bygget inlinar INTE NEXT_PUBLIC_* konsekvent i alla server-chunks (storefront-home
läste `process.env` i runtime → undefined → 500; demo.corevo.se → tenant-kind `unknown` för att
ROOT_DOMAIN-fallback var `localhost:3000`). Fix: lägg dem som `vars` i `wrangler.jsonc` (OpenNext
mappar `vars`→`process.env`). Alla är PUBLIKA värden (anon-nyckeln är browser-exponerad). Klart + deployat.

## ⛔ KVAR (Zivar — kräver secret/owner)

### 1. `SUPABASE_SERVICE_ROLE_KEY` som Worker-SECRET → kund-register
Kund-självregistrering (`/registrera`) använder service-role-admin-API:t (G05-design:
bakar tenant_id + auto-confirm). Utan nyckeln → 500. De 3 back-office-loggin + storefront-bläddring
+ `/boka` funkar UTAN den. Sätt (nyckeln finns i Dashboard → Settings → API → `service_role`):
- **Dashboard:** Workers & Pages → `bokningsplatformen` → Settings → Variables and Secrets → Add → typ **Secret** → `SUPABASE_SERVICE_ROLE_KEY` = `<service_role-nyckeln>`. (Deploya om om så krävs.)
- **eller ge nyckeln till Code** → `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` + redeploy + verifiering.
(Detta är en RIKTIG secret — lägg den ALDRIG i `wrangler.jsonc vars`/git.)

### 2. Radera `frisor3` (rensar `/salonger`) — owner i SQL-editor
`/salonger` listar idag `demo` + `frisor3` (G08-testrest). Cascade träffar append-only `audit_log`-guarden
(G10), så Code får inte. Du (owner/postgres) kör:
```sql
begin;
alter table public.audit_log disable trigger user;   -- owner-privilegium
delete from public.tenants where slug='frisor3';      -- cascade rensar 4 audit-rader
alter table public.audit_log enable trigger user;
commit;
```

### 3. JWT-hook (för NYA konton) — valfritt
Dashboard → Auth → Hooks → `public.custom_access_token_hook`. De 3 seed-kontona funkar UTAN.

## Bygg-bugg (permanent fix rekommenderas)
`opennextjs-cloudflare build` kraschar i mappen `firsör-sas` pga **`ö` i sökvägen** (esbuild edge-config
ENOENT — INTE EPERM/Developer-Mode). Workaround denna gång: bygg från ASCII-kopia (`C:\tmp\kod`,
`pnpm install` + build + `wrangler deploy`). **Permanent fix:** döp om repo-mappen ASCII (`firsör-sas`→`frisor-sas`).

## Rollback
- DNS: ta bort Custom Domains booking/demo → tjänst nere, POS opåverkad.
- Worker: rulla tillbaka deployment i Dashboard.
- main: `git reset --hard a122f94` + force-push (bara om inga nya commits efter mergen).
