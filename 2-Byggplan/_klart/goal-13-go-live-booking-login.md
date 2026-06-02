## Goal 13 — Go-live: merge G1–G12 → main → deploy → login

**⚫ Ultrathink** (live-deploy + rör DNS-zonen där POS bor — rollback krävs, Zivar-OK givet)
**Beror på:** G01–G12 (kod-klara)

**Mål (ENDA verifierade):** Zivar loggar in live på `booking.corevo.se` med de 3 seed-kontona + en demo-storefront live på `demo.corevo.se`.

**Scope:** IN = merge goal-12→main, deploya Workern, booking + demo live, login funkar. DORMANT (rörs ej): Stripe, Resend, cron. `payments_enabled` default AV — lämna.

**EN demo-salong (ingen frisor1/frisor2-split):**
- Seeda EN tenant: "Frisör Demo", slug `demo`, host `demo.corevo.se`, `customer_accounts_enabled=true`.
- TA BORT frisor2-rader ur seed; konsolidera frisor1→demo. De 3 kontona (`platform@`,`admin@`,`klippare@`, alla `Demo!1234`) pekar på demo.
- Multi-tenant-motorn rörs INTE — bara seed ändras.

### ⛔ POS-GUARDRAIL
`corevo.se`-zonen kör POS live. POS äger: apex, www, admin, superadmin, kiosk, dev*. Lägg ENBART nya hostar (`booking`, `demo` — fria). Rör ALDRIG en POS-post. Läs `1-Planering/cloudflare-nulage.md` före DNS. Verifiera POS svarar EFTER.

### Steg
1. Bekräfta G12-E2E grön → merge `goal-12-inloggningsmodell`→main (ff, sitter på a122f94), push origin. Flytta goal-12-filen→`_klart/`.
2. Bygg Workers-bundle: `opennextjs-cloudflare build` (elevad terminal/Developer Mode pga EPERM symlink — känd).
3. Worker-secrets (login-minimal): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (moln `clylvowtowbtotrahuad`), `NEXT_PUBLIC_PLATFORM_HOST=booking.corevo.se`, `NEXT_PUBLIC_ROOT_DOMAIN=corevo.se`, `AUTH_COOKIE_DOMAIN` (scopa enligt G12 host-split). Stripe/Resend/cron = hoppa.
4. Deploya Worker.
5. DNS: `booking.corevo.se` finns redan (bind mot ny Worker) + lägg `demo.corevo.se`→samma Worker. Båda fria, POS orörd.
6. Moln-DB: migrationer 0001–0008 applicerade + kör konsoliderad seed (demo-tenant, frisor2 bort, 3 konton→demo).

### Zivar gör (bara han)
- JWT-hook: Dashboard→Auth→Hooks→`public.custom_access_token_hook`. (De 3 seed-kontona funkar UTAN — claims inbakade. Hooken för NYA konton.)
- Lösen på `platform@corevo.se` (Dashboard→Auth→Users) om `Demo!1234` ska bytas.
- Secrets till Code: CF API-token + account ID, Supabase access-token + DB-lösen. Som secrets, ej råa.

### DoD
- [ ] `booking.corevo.se` live (HTTPS).
- [ ] Login funkar live: `platform@`→plattform-dashboard (ren `/`, inget `/platform`); `admin@`→demo-admin; `klippare@`→personalvy.
- [ ] `/salonger` + `/fakturering` rena.
- [ ] `demo.corevo.se` storefront + `/boka` + `/konto` (kund-register funkar).
- [ ] POS-koll: `corevo.se` + `admin.corevo.se` oförändrade.

### Anti-patterns
- Rör INTE POS-DNS-poster. Aktivera INTE Stripe/Resend/cron. Deploya EJ före grön E2E + merge.

### Rollback
- DNS: ta bort booking/demo-poster → tjänst nere, POS opåverkad.
- Worker: rulla tillbaka till föregående deployment.
- main: `git reset --hard a122f94` + force-push (bara om inga nya commits efter mergen).

**Rapportera KLAR + STANNA.** Nörden verifierar DoD (särskilt POS) + flyttar till `_klart/`.
