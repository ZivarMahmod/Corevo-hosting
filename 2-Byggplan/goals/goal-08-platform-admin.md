/goal

KÖR: platform-admin / Corevos kontrollcenter (G08, modul M7).

KONTEXT (läs först):
- Repo: privat Frisor-sas, kod i 5-Kod/ (pnpm + Turborepo monorepo, Next.js 15, Supabase, OpenNext/Cloudflare Workers). Jobba direkt på main i mappen du redan har, `git pull` först, en commit per punkt (sekventiell körning, ingen branch).
- main har KLAR: G01 scaffold, G02 DB/RLS/seed, G03 publik, G04 bokningsmotor, G4.5 auth/login + roll-routing. DB live i Supabase (clylvowtowbtotrahuad).

DITT REVIR (skriv bara här):
- app/(platform)/...  +  components/platform/  +  lib/platform/ (egen undermapp).

DELAT (läs/återanvänd, ändra ALDRIG utan att flagga): packages/auth (kräv-roll/kräv-inloggad från G4.5), packages/db, packages/ui, packages/config, supabase/migrations. middleware.ts: host-check för booking.corevo.se KAN behöva en liten rad — finns den inte redan från G4.5, lägg minimalt + flagga i KLAR-rapporten.

NAMN-FAKTA (använd EXAKT — goal-filens äldre namn är ersatta):
- RLS-helper: private.tenant_id(). Roll: users.role_id → roles.level; platform = platform_admin-rollen i roles. INTE profiles (gammalt).
- Tvär-tenant: använd platform_admin RLS-bypass-policy från G02 (föredra) eller service-role i server-Actions med extra role-guard.
- Tabeller: tenants, tenant_settings, users, roles. SCHEMA-REGEL: behöver du audit_log eller tenant_domains och de INTE finns i schemat → STANNA och flagga (schemaändring görs solo, inte i denna goal). Skapa ingen migration här.

⛔ DOMÄN-SPÄRR (viktigast): tenants kör live på *.corevo.se-subdomäner. Kundens EGNA domän (CNAME/custom hostname) är SPÄRRAD. Steg 5 = bygg UI:t (fält + planerad CNAME-instruktion + status-platshållare + "DO NOT RUN YET"-banner) bakom hård flagga DOMAIN_PROVISIONING_ENABLED=false. INGET Cloudflare-anrop, INGEN custom hostname på kundnamn körs skarpt. tenant_domains-rad (om tabellen finns) = status blocked/pending_manual.

MÅL: platform_admin hanterar hela plattformen — skapa/administrera tenants, driver onboarding-trappan, plan/status, översikt, support — separat från tenant-data.

BYGG (detalj: 2-Byggplan/goals/goal-08-platform-admin.md):
1. Skyddad layout app/(platform)/ på reserverad subdomän booking.corevo.se (lokalt booking.localhost:3000), strikt role=platform_admin. booking löser ALDRIG till en tenant.
2. Tenant-lista + sök/filter (tvär-tenant via platform_admin-policy).
3. Skapa-tenant (steg 1, transaktion): tenants + unik subdomän-slug under corevo.se (avvisa reserverade booking/admin/app/www/api) + tenant_settings default + invite salon_admin. Sätt även FLÖDE 2-prismodell: tenant_settings.billing_model = 'per_booking' | 'flat_monthly' + startavgift + avgift (öre). (Saknas kolumnerna i schemat → lägg en migration, du är sekventiell på main.)
4. Branding-form (steg 2) → tenant_settings.
5. Onboarding-checklista per tenant (status steg 1–6, färg).
6. Kundens egna domän (steg 5) — SPÄRRAT enligt domän-spärren ovan.
7. Lansera (steg 6): plan/status (active/suspended). Suspendera → publika sajten blockeras.
8. Metrics-dashboard (antal tenants, bokningar, aktiva salonger) + FLÖDE 2-faktureringsunderlag: per tenant per kalendermånad → antal completed-bokningar (exkl. avbokade/no-show) × per_booking-avgift, ELLER fast belopp för flat_monthly. Läs-vy som Zivar fakturerar manuellt från. Ingen Stripe-koppling.
9. Read-only tenant-insyn + audit-loggning (om audit_log finns; annars flagga).

DoD (bevis krävs):
- Skapa tenant + slug + tenant_settings + invite → tenant bokningsbar i M2/M3, live på frisorN.corevo.se. Reserverad slug avvisas.
- Branding från M7 slår igenom på publika sajten.
- Onboarding-checklista visar status per steg.
- Steg 5 SPÄRRAT: inget skarpt domän-anrop går iväg, "DO NOT RUN YET"-banner visas.
- Vanlig salon_admin når INTE (platform)-ytan.
- Suspendera tenant → publika sajten blockeras.
- pnpm build + lint gröna.

Klart → rapportera KLAR med DoD-bevis (+ ev. flaggor) och STANNA.
