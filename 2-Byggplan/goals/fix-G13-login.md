## Fix-G13 — Login nekar + storefront hittar ej tenant (live)

**🔴 Think hard** · Fix under G13 · **Reproducerat live av Nörden via browser** (custom domains attachade)

### Symptom (verifierat live)
1. **Login NEKAR** `platform@corevo.se` / `Demo!1234` → "Fel e-post eller lösenord." Reproducerat på TRE hostar: `booking.corevo.se`, `bokningsplatformen.zivar68.workers.dev`, (tidigare `bookning`). Host-/cert-oberoende → buggen är i login-flödet självt. Äkta tangentinmatning.
2. **`demo.corevo.se`** (custom domain, serverar Workern) → "Sidan kunde inte hittas / salongen inte tillgänglig." Host-baserad tenant-resolution matchar inte demo-domänen. (`?tenant=demo` funkar — host-vägen gör det inte.)
3. **OBS domänbyte:** rätt host är nu `booking.corevo.se` (Zivar bytte från `bookning`). `bookning.corevo.se` är borttagen (Error 1016). `NEXT_PUBLIC_PLATFORM_HOST` MÅSTE sättas = `booking.corevo.se` + re-deploya, annars känner host-spliten inte igen plattform-värden.

> ⚠️ Code rapporterade "alla 3 konton autentiserar" — men login-FORMULÄRET nekar. Gapet = troligen ett API/script-test som lyckades medan den deployade login-server-actionen failar. Verifiera via formuläret, inte sidovägar.

### BUGG 1 — login-formuläret nekar giltigt konto
Diagnos (kör i ordning):
- Använder den deployade login-server-actionen rätt Supabase **runtime-config**? `NEXT_PUBLIC_*` inlinas vid build, men server-actionen kan behöva URL/anon-nyckel som **Worker-secret vid runtime**. Saknas → auth failar tyst → "fel lösenord". Sätt Worker-secrets, re-deploya.
- Verifiera på molnet: `select email, (encrypted_password is not null) from auth.users where email='platform@corevo.se';` finns + har lösen.
- Bekräfta lösen-hash: testa `signInWithPassword('platform@corevo.se','Demo!1234')` mot SAMMA projekt+anon-nyckel som Workern använder. Fel → re-seeda lösen `crypt('Demo!1234', gen_salt('bf'))`.
- Kör GoTrue NULL-token-normaliseringen på molnet (känd 500-fälla för handseeded users).

### BUGG 2 — storefront hittar ej tenant på host
- Host-resolutionen (`lib/tenant*.ts`) ska slå upp tenant via `tenant_domains.domain = host`. Verifiera att en rad finns: `domain='demo.corevo.se'` kopplad till demo-tenanten (slug `demo`). Saknas/fel → lägg/rätta i seed + applicera på molnet.
- Säkerställ att host-vägen (inte bara `?tenant=`) resolvar. `demo.corevo.se` → demo-tenant → storefront renderar med riktiga tjänster.

### DoD (re-verifieras live av Nörden)
- [ ] `platform@corevo.se`/`Demo!1234` loggar in via formuläret på `booking.corevo.se` → plattform-dashboard (ren `/`). admin@ + klippare@ likaså, rätt vy.
- [ ] `demo.corevo.se` renderar storefronten (hero + riktiga tjänster) + `/boka` + `/konto`.
- [ ] `booking.corevo.se` host-routing rätt (plattform), `NEXT_PUBLIC_PLATFORM_HOST=booking.corevo.se`.
- [ ] POS-koll: `corevo.se` + `admin.corevo.se` oförändrade.

**Rapportera KLAR + STANNA.** Nörden re-verifierar allt live via browser.
