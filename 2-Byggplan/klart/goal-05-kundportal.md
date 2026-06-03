/goal

KÖR: kundportalen (G05, modul M4). Du är en av 3 Code i den parallella portal-vågen (Våg A) — G05 kund, G06 personal, G07 admin bygger samtidigt. Bygg bara kund-reviret, så glider vågen rent.

KONTEXT (ny session — läs först):
- Repo: privat Frisor-sas, kod i 5-Kod/ (monorepo: pnpm + Turborepo, Next.js 15, Supabase, OpenNext/Cloudflare Workers). Jobba lokalt.
- main har KLAR + mergat: G01 scaffold, G02 DB/RLS/seed, G03 publik, G04 bokningsmotor, G4.5 auth/login + roll-routing. DB live i Supabase-molnet (clylvowtowbtotrahuad).
- Jobba direkt på main i mappen du redan har. `git pull` först. En commit per punkt. (Sekventiell körning — du är ensam Code i mappen, ingen branch behövs.)

DITT REVIR (skriv bara här):
- app/(kund)/...  +  components/kund/  +  lib/kund/ (egen undermapp).

DELAT (läs/återanvänd, ändra ALDRIG): packages/auth (kräv-roll/kräv-inloggad-helpern från G4.5), packages/db, packages/ui, packages/config, middleware.ts, supabase/migrations, lib/booking/ (availability + createBooking från G04). Behövs en schemaändring → STANNA och flagga; den görs solo före vågen, inte här. Allt i denna goal är ren app-kod mot befintligt schema.

NAMN-FAKTA (använd EXAKT — goal-filens äldre namn är ersatta):
- RLS-helper: private.tenant_id(). Roll: users.role_id → roles.level (8-nivå). INTE profiles / profiles.role / current_profile_id() (gammalt).
- Route-grupp heter (kund) — inte (customer). Tabeller: bookings, services, staff/staff_id, locations/location_id, start_ts/end_ts, tenant_settings.
- Login + guards FINNS i G4.5 — bygg inte om dem, återanvänd den delade auth-helpern.

MÅL: Inloggad kund ser, om-/avbokar sina tider, ser historik och hanterar profil — kopplat till bokningsmotorn (M3).

BYGG:
1. Kund-signup/koppling: e-post+lösen och/eller magic link via befintliga @supabase/ssr-klienter (packages/auth). Skapa/koppla users-rad med kund-roll + tenant_id vid signup. (Login själv finns redan.)
2. Skyddad layout app/(kund)/konto/ — använd den delade kräv-inloggad + kräv-roll(kund)-helpern; annars redirect till login.
3. Vyer: "Mina tider" (kommande + tidigare, egna), bokningsdetalj med om-/avbokning (respektera tenantens tidsgräns från tenant_settings), profil (namn, telefon, e-post).
4. Om-/avboknings-Actions: statusändring som frigör slotten (krockfrigöring). Vid ombokning — återanvänd createBooking-krocklogiken från G04, dubblera inte.
5. Koppling inloggad kund → M3: sätt kundens id på bokningen enligt schemat (slå upp rätt kolumn på bookings, gissa inte).

DoD (bevis krävs):
- Kund kan signa upp, logga in, se BARA sina bokningar (RLS-bevis; tenant A ser ej tenant B).
- Av-/ombokning ändrar status + frigör slotten (ny bokning på samma tid möjlig efteråt).
- Oinloggad på /konto/* → redirect till login.
- pnpm build + lint gröna.

Klart → rapportera KLAR med DoD-bevis och STANNA. Nörden verifierar + mergar en i taget.
