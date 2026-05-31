/goal

KÖR: salon-admin (G07, modul M6). Du är en av 3 Code i den parallella portal-vågen (Våg A) — G05 kund, G06 personal, G07 admin bygger samtidigt. Bygg bara admin-reviret, så glider vågen rent.

KONTEXT (ny session — läs först):
- Repo: privat Frisor-sas, kod i 5-Kod/ (monorepo: pnpm + Turborepo, Next.js 15, Supabase, OpenNext/Cloudflare Workers). Jobba lokalt.
- main har KLAR + mergat: G01 scaffold, G02 DB/RLS/seed, G03 publik, G04 bokningsmotor, G4.5 auth/login + roll-routing. DB live i Supabase-molnet (clylvowtowbtotrahuad). R2-binding finns från G01.
- Jobba direkt på main i mappen du redan har. `git pull` först. En commit per punkt. (Sekventiell körning — du är ensam Code i mappen, ingen branch behövs.)

DITT REVIR (skriv bara här):
- app/(admin)/...  +  components/admin/  +  lib/admin/  +  lib/r2/ (egen, R2-uppladdning).

DELAT (läs/återanvänd, ändra ALDRIG): packages/auth (kräv-roll/kräv-inloggad från G4.5), packages/db, packages/ui, packages/config, middleware.ts, supabase/migrations. Behövs en schemaändring → STANNA och flagga; görs solo före vågen. Allt här är ren app-kod (CRUD mot befintligt schema).

NAMN-FAKTA (använd EXAKT — goal-filens äldre namn är ersatta):
- RLS-helper: private.tenant_id(). Roll: users.role_id → roles.level; admin = salon_admin-rollen som redan finns i roles. INTE profiles (gammalt).
- Route-grupp heter (admin). Tabeller: services, staff/staff_id, staff_services, working_hours, bookings, locations/location_id, tenant_settings; branding på tenants.brand.
- Login + guards FINNS i G4.5 — återanvänd.

MÅL: Salongsägaren (salon_admin) hanterar hela sin salong: tjänster/priser, personal, scheman, white-label-branding, inställningar och bokningsöversikt — allt scoped till egen tenant.

BYGG:
1. Skyddad layout app/(admin)/ — delad kräv-roll(salon_admin)-helper, scoped till egen tenant.
2. lib/r2/upload.ts — bilduppladdning till R2 server-side (presigned PUT eller via Worker). Exponera ALDRIG R2-secrets mot klient; spara publik URL i DB.
3. CRUD: tjänster (services: namn, varaktighet, pris, kategori, aktiv), personal (staff + koppla staff_services, aktivera/avaktivera), öppettider/scheman per personal (working_hours).
4. Branding: logo→R2, primary_color, tema → tenants.brand. Invalidera M2-tenant-cache vid spar (revalidateTag) så publika sajten visar nytt direkt.
5. Salonginställningar: namn, kontakt, avbokningsregel (M4 läser den från tenant_settings), tidszon, custom_domain (visa instruktion — faktisk DNS/CF-koppling görs i G08/ops, inte här).
6. Bokningsöversikt: alla tenant-bokningar, filter (datum/personal/status) + manuell statusändring. Enkel dashboard: dagens/veckans bokningar.

DoD (bevis krävs):
- Skapa tjänst → syns i M2/M3 direkt. Lägg personal + koppla tjänst → bokningsbar i M3.
- Ändra branding (logo+färg) → publika M2-sajten visar nytt utseende.
- Admin ser ALLA egna tenant-bokningar, inte annan tenants (RLS-bevis).
- R2-uppladdning funkar, URL sparas, inga secrets i klienten.
- pnpm build + lint gröna.

Klart → rapportera KLAR med DoD-bevis och STANNA. Nörden verifierar + mergar en i taget.
