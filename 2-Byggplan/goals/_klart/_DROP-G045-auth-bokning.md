/goal

KONTEXT (ny session — läs först):
- Repo: ETT privat Frisor-sas-repo, koden i 5-Kod/ (monorepo: pnpm + Turborepo, Next.js 15, Supabase, OpenNext/Cloudflare → Workers). Jobba på main, lokalt.
- KLAR på main: G01 scaffold, G02 DB/RLS/seed, G03 publik webbplats (commit 181eb21). DB live i Supabase-molnet (projekt clylvowtowbtotrahuad).
- Kör SERIELLT, en goal i taget. Detta är en solo-goal som lägger grunden (auth + bokning) före den parallella portal-vågen (G05/G06/G07).
- Namn-fakta (använd EXAKT): RLS-helpern heter private.tenant_id(). Tabeller/kolumner: staff / staff_id, start_ts / end_ts. Dubbelbokningsskydd finns som EXCLUDE/btree_gist-constraint på bookings (staff_id + tstzrange) från foundation.

MÅL: Bygg två grundstenar i en runda — (A) auth/login + roll-routing som alla portaler ska stå på, och (B) bokningsmotorn (M3, kärnan).

== DEL A — Auth, login & roll-routing (delad grund) ==
- Login/logout via Supabase Auth (e-post + lösen; magic link valfritt). Använd befintliga @supabase/ssr-klienter i packages/auth.
- Session i hela appen; läs användarens roll via users.role_id → roles.level (8-nivå).
- Roll-baserade route-guards i middleware för route-grupperna som kommer: (kund) / (personal) / (admin) / (platform). Låg nivå når bara sitt, platform_admin/super_admin når tvärs (service-role-väg).
- Bygg en liten delad auth-helper (kräv-roll / kräv-inloggad) som portalerna återanvänder.
- MFA-redo: förbered Supabase MFA (TOTP) så den kan aktiveras för admin/personal-roller (full enrollment-UI byggs i admin-goal). 2FA är vårt riktiga skydd (leaked-password medvetet uppskjuten).
- NOTERA: riktig token-claim (tenant_id) via Custom Access Token Hook kräver att Zivar slår på Auth-Hook-toggeln i Dashboard. RLS funkar redan via app_metadata, så login + guards kan byggas och testas nu.

== DEL B — Bokningsmotorn (M3) ==
Bygg enligt 2-Byggplan/goals/goal-04-bokningsmotor.md. Referensflöde: FreshCut-stilen (tjänst → personal "Alla/Hilal/John…" → dag + tider → bekräftelse).

Steg:
1. Migration 0005 (framtidssäkring för multi-store): ny tabell locations (id, tenant_id, name, address, timezone, is_primary) med tenant-RLS; location_id på staff, services, working_hours, time_off, bookings (default → primär location). Seed en primär location för frisor1 + koppla befintlig staff/services. (Franchise = grupp över tenant är separat beslut — bygg inte nu.)
2. lib/booking/availability.ts — ren, testbar slot-beräkning: tenant + service + (valfri) staff + datum → lediga slots, hänsyn till working_hours, befintliga bookings, time_off, varaktighet + ev. buffert. UTC i DB, presenteras i locationens timezone.
3. app/boka/actions.ts — getAvailableSlots(serviceId, staffId?, date) + createBooking(...). createBooking lutar sig på EXCLUDE-constraintet, fångar exclusion_violation → vänligt "tiden togs precis". Returnerar { bookingId, requiresPayment } som krok för G09.
4. app/boka/ — stegvis UI med tenant-temat (CSS-variabler från G03): tjänst → personal (eller "Alla") → kalender + tider → kunduppgifter (gäst: namn/e-post/telefon, eller inloggad kund) → bekräftelse. Få klick, snabbt — det är säljargumentet.
5. Bekräftelsesida + rena sömmar framåt: krok för betalning (G09) och krok/flagga för recension-nudge efter besök (Google-review, fyrar vid status=completed, byggs senare) — lämna bara snygg plats.

DEV + PREVIEW: bygg/testa lokalt (frisor1.localhost:3000). Uppdatera workers.dev-previewen så Zivar kan klicka login + hela boka→bekräfta-flödet live (?tenant=frisor1). corevo.se/POS lämnas orörda.

VERIFIERA (DoD — bevis krävs):
Auth:
- Login/logout fungerar; session hålls; fel lösen avvisas vänligt.
- Roll-guard: en låg roll når inte (admin)/(platform)-route; platform_admin når tvärs.
Bokning:
- Slot-beräkning korrekt i enhetstester (krock, time_off, arbetstidsgräns, varaktighet, kanttider).
- Två samtidiga createBooking på samma slot → bara en lyckas (dubbelbokning omöjlig).
- Hela flödet boka→bekräftelse end-to-end mot frisor1.
- Bokning får rätt tenant_id + location_id; syns ej för annan tenant (RLS).
- location_id finns på staff/services/bookings/working_hours/time_off, defaultat till primär location.
Helhet:
- Live-preview: login + boka-flödet klickbart på workers.dev.
- pnpm build + lint + tester gröna.

När allt är grönt: rapportera KLAR med DoD-bevis och stanna där. Nästa blir den parallella portal-vågen (G05/G06/G07) som står på den här auth-grunden.
