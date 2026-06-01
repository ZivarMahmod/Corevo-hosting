# G13 Go-live — status + Zivar-steg

Go-live av booking.corevo.se (back-office) + demo.corevo.se (storefront) på Worker
`bokningsplatformen`. POS (corevo.se Pages) orörd hela vägen.

## ✅ Klart av Code (denna session)
- **Merge:** G12 låg redan på `main` (`8f9e7f0`), goal-12 i `_klart/`. `main == origin/main`.
- **Moln-DB konsoliderad** (migr 0001–0008 redan applicerade):
  - frisor1 → **demo** (slug `demo`, namn "Frisör Demo", `customer_accounts_enabled=true`, domän `demo.corevo.se`). De 3 kontona orörda (samma tenant_id).
  - **frisor2 raderad** (0 audit-rader → ren cascade).
  - frisor3 kvar — se Zivar-steg 2 (4 audit-rader → append-only-guard blockerar Code).
- **`seed.sql`** omskriven → en demo-salong (för framtida `db reset`).
- **Worker-bundle byggd + deployad** → `bokningsplatformen` (workers.dev). Bygget gjordes från en ASCII-kopia (se "Bygg-bugg" nedan).

## ⛔ Zivar-steg (bara du — kräver Dashboard/owner)

### 1. Custom Domains (gör tjänsten live) — POS-säkert
Dashboard → **Workers & Pages → `bokningsplatformen` → Settings → Domains & Routes → Add → Custom Domain**:
- `booking.corevo.se`
- `demo.corevo.se`

Custom Domain skapar DNS + cert automatiskt, scopat till Workern. **Rör INGEN POS-post.**
Lägg ALDRIG en route `*.corevo.se/*` — den skulle kapa admin/www/kiosk/superadmin (POS ner).

### 2. Radera frisor3 (rensar `/salonger`) — owner i SQL-editor
Cascade träffar den append-only `audit_log`-guarden (G10), så Code får inte. Du (owner/postgres) kör:
```sql
begin;
alter table public.audit_log disable trigger user;   -- owner-privilegium
delete from public.tenants where slug='frisor3';      -- cascade rensar 4 audit-rader
alter table public.audit_log enable trigger user;
commit;
```

### 3. JWT-hook (för NYA konton) — valfritt nu
Dashboard → Auth → Hooks → "Customize Access Token (JWT) Claims" → `public.custom_access_token_hook`.
De 3 seed-kontona funkar UTAN (claims inbakade). Hooken behövs först när du skapar konton i appen.

### 4. (Valfritt) byt lösen på `platform@corevo.se`
Dashboard → Auth → Users. Annars `Demo!1234`.

## DoD-verifiering (efter steg 1)
- `https://booking.corevo.se` → login. `platform@corevo.se`/`Demo!1234` → ren `/` plattform-dashboard; `admin@frisor1.se` → demo-admin; `klippare@frisor1.se` → personalvy. `/salonger` + `/fakturering` rena.
- `https://demo.corevo.se` → storefront + `/boka` + `/konto` (registrera kund funkar).
- **POS-koll:** `https://corevo.se` + `https://admin.corevo.se` oförändrade.

## Bygg-bugg (permanent fix rekommenderas)
OpenNext-bygget (`opennextjs-cloudflare build`) kraschar i mappen `firsör-sas` pga **`ö` i sökvägen** — esbuild skriver `.open-next/.build/open-next.config.edge.mjs` till en fel-kodad `file://`-väg → `ENOENT` (INTE EPERM/Developer-Mode som tidigare antagits). Workaround denna gång: bygg från ASCII-kopia (`C:\tmp\kod`, `pnpm install` + build).
**Permanent fix:** döp om repo-mappen utan `ö`, t.ex. `firsör-sas` → `frisor-sas`. Då bygger/deployer det rakt av.

## Rollback
- DNS: ta bort Custom Domains booking/demo → tjänst nere, POS opåverkad.
- Worker: rulla tillbaka deployment i Dashboard.
- main: `git reset --hard a122f94` + force-push (bara om inga nya commits efter mergen).
