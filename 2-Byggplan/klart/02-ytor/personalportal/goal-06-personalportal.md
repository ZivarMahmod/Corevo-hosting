/goal

KÖR: personalportalen (G06, modul M5). Du är en av 3 Code i den parallella portal-vågen (Våg A) — G05 kund, G06 personal, G07 admin bygger samtidigt. Bygg bara personal-reviret, så glider vågen rent.

KONTEXT (ny session — läs först):
- Repo: privat Frisor-sas, kod i 5-Kod/ (monorepo: pnpm + Turborepo, Next.js 15, Supabase, OpenNext/Cloudflare Workers). Jobba lokalt.
- main har KLAR + mergat: G01 scaffold, G02 DB/RLS/seed, G03 publik, G04 bokningsmotor, G4.5 auth/login + roll-routing. DB live i Supabase-molnet (clylvowtowbtotrahuad).
- Jobba direkt på main i mappen du redan har. `git pull` först. En commit per punkt. (Sekventiell körning — du är ensam Code i mappen, ingen branch behövs.)

DITT REVIR (skriv bara här):
- app/(personal)/...  +  components/personal/  +  lib/personal/ (egen undermapp).

DELAT (läs/återanvänd, ändra ALDRIG): packages/auth (kräv-roll/kräv-inloggad från G4.5), packages/db, packages/ui, packages/config, middleware.ts, supabase/migrations, lib/booking/availability.ts (från G04 — återanvänd, dubblera aldrig logiken). Behövs en schemaändring → STANNA och flagga; görs solo före vågen. Allt här är ren app-kod mot befintligt schema.

NAMN-FAKTA (använd EXAKT — goal-filens äldre namn är ersatta):
- RLS-helper: private.tenant_id(). Roll: users.role_id → roles.level (8-nivå). INTE profiles / current_staff_id() (gammalt).
- Route-grupp heter (personal) — inte (staff). Tabeller: staff/staff_id, bookings, working_hours, time_off, locations/location_id, start_ts/end_ts.
- Login + guards FINNS i G4.5 — återanvänd, bygg inte om.

MÅL: Inloggad personal ser egen dagskalender/bokningar, markerar frånvaro och hanterar egna arbetstider — salongen drivs operativt.

BYGG:
1. Skyddad layout app/(personal)/ — delad kräv-roll(personal)-helper.
2. Dag-/veckokalender med personalens EGNA bokningar (kund, tjänst, tid, status), RLS-scoped, i locationens tidszon. Slå upp hur personalens staff-rad knyts till inloggad user i schemat — gissa inte.
3. Status-Actions: markera bokning completed / no_show.
4. UI + Actions för egna working_hours.
5. UI + Actions för time_off (frånvaro) — verifiera att M3-tillgängligheten uppdateras direkt (availability läser time_off).
6. "Idag"-snabböversikt: antal bokningar, nästa kund.

DoD (bevis krävs):
- Personal ser BARA egna bokningar (ej kollegors, ej annan tenant — RLS-bevis).
- Lägg time_off → slotten försvinner i M3 boka-flödet.
- Ändra working_hours → nya/borttagna slots i M3.
- Statusändring sparas + syns.
- pnpm build + lint gröna.

Klart → rapportera KLAR med DoD-bevis och STANNA. Nörden verifierar + mergar en i taget.
