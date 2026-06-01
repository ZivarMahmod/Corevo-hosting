## Goal 13 — Go-live: merge G1–G12 → main → deploy → login på booking.corevo.se

**Thinking: ⚫ Ultrathink** (live-deploy + rör DNS-zonen där POS bor — kräver rollback + redan-givet Zivar-OK)
**Spår:** Ops/Deploy · **Beror på:** G01–G12 (alla kod-klara) · **Modul:** deploy/infra (tvärsnitt)

**Beslut (Zivar 2026-06-01):** Allt byggt från G1→G12 ska till main, deployas live, och vara uppe. ENDA verifierade målet just nu: **Zivar loggar in på `booking.corevo.se` som super_admin och ser plattform-dashboarden.** Inget annat verifieras i denna goal.

**Scope — laserfokus:**
- IN: merge goal-12 → main, deploy Workers-appen live, `booking.corevo.se` → Worker, login fungerar.
- DORMANT (byggt, rörs ej, ska EJ verifieras nu): Stripe/betalning, Resend-notiser, cron, frisorN-storefront-flöden, custom-domän.
- `payments_enabled` default AV → betalflödet är osynligt. Korrekt, lämna så.

---

### ⛔ POS-GUARDRAIL (icke-förhandlingsbar)
`corevo.se`-zonen kör POS i produktion. POS äger: **apex, www, admin, superadmin, kiosk, dev, admin.dev, superadmin.dev, kiosk.dev**.
- Lägg ENBART till nya poster: `booking.corevo.se` (denna goal). `frisorN.corevo.se` senare.
- Rör ALDRIG en befintlig POS-post (ändra/radera/peka om). Läs `1-Planering/cloudflare-nulage.md` före DNS-steget.
- Verifiera POS fortfarande svarar (apex + admin) EFTER att booking lagts till.

---

### Steg

**A. Land + merge (efter att G12-E2E loggat grönt)**
1. Bekräfta G12-E2E grön (back-office super/salon/staff + storefront-gating + @readonly).
2. `goal-12-inloggningsmodell` → **main** (fast-forward, sitter direkt på G11/a122f94). Push origin/main.
3. Flytta `goal-12-inloggningsmodell.md` → `2-Byggplan/goals/_klart/`.

**B. Deploy Workers-appen live**
4. Bygg Workers-bundle: `opennextjs-cloudflare build` (elevad terminal / Developer Mode pga EPERM symlink-spärr på Windows — känd).
5. Sätt prod-env/Worker-secrets (login-minimal):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (moln-projektet `clylvowtowbtotrahuad`)
   - `NEXT_PUBLIC_PLATFORM_HOST=booking.corevo.se`, `NEXT_PUBLIC_ROOT_DOMAIN=corevo.se`
   - `AUTH_COOKIE_DOMAIN` = sätt så back-office-cookien gäller på booking.corevo.se (scopa rätt enligt G12 host-split — kolliderar ej med POS apex).
   - `SUPABASE_SERVICE_ROLE_KEY`: utelämna/tom om login funkar utan (booking kör anon + DEFINER-RPC). Behövs först för invite-vägen (ej nu).
   - Stripe/Resend/Cron-secrets: **hoppa över** (dormant).
6. Deploya Worker.

**C. DNS — booking.corevo.se (sist, kirurgiskt)**
7. Lägg till `booking.corevo.se` → denna Worker (Custom Domain / route). EN ny post. POS orörd (se guardrail).

**D. DB-läge på molnet**
8. Säkerställ migrationer 0001–0008 (+ ev. 0009 om G12 la till en) applicerade på molnet, och att `platform@corevo.se`-användaren finns (seed). Kör seed om saknas.

---

### ⚠️ Zivar gör (bara han kan — utanför Code)
- **JWT-hook PÅ:** Supabase Dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims" → `public.custom_access_token_hook`. **Krävs** för att login ska bära tenant_id + roll. Utan denna → login men fel/ingen behörighet.
- **Super_admin-lösen:** Dashboard → Authentication → Users → `platform@corevo.se` → sätt ett lösen Zivar kan. (Seed-hashen är dev-okänd.)
- **Secrets till Code:** Cloudflare API-token + account ID; Supabase access-token + DB-lösen. Sätts som Worker-/CI-secrets — INTE råa i chatt.

---

### Verifieras (DoD — ENDA målet)
- [ ] `booking.corevo.se` laddar live (HTTPS, Worker svarar).
- [ ] Zivar loggar in med `platform@corevo.se` → landar på plattform-dashboarden på ren `/` (inget `/platform` i URL).
- [ ] Dashboarden visar salonger (super_admin ser tvärs tenants via RLS).
- [ ] `/salonger` + `/fakturering` öppnas rena.
- [ ] **POS-koll:** `corevo.se` (apex) + `admin.corevo.se` svarar som vanligt — oförändrade.

### Anti-patterns
- Rör INTE befintliga POS-DNS-poster (guardrail).
- Aktivera INTE Stripe/Resend/cron nu — utanför scope, håll dormant.
- Deploya INTE förrän G12-E2E är grön + merge på main.

### Rollback
- DNS: ta bort `booking.corevo.se`-posten → tjänsten otillgänglig, POS opåverkad.
- Worker: rulla tillbaka till föregående deployment (eller ta ned route).
- main: `goal-12` mergades som ff — `git reset --hard a122f94` på main + force-push ÅTERSTÄLLER till G11 om merge måste ångras (endast om inga nya commits efter).
- DB: migrationer 0001–0008 redan på molnet sedan tidigare goals — inget nytt destruktivt i denna goal.

**Rapportera KLAR + STANNA.** Nörden verifierar DoD (särskilt POS-kollen) + flyttar goal till `_klart/`.
