## Goal 06 — Personalportal M5

**Spår:** C · **Beror på:** G04 · **Modul:** M5 (Personalportal)

**Mål:** Inloggad personal ser sin egen dagskalender/bokningar, kan markera frånvaro och hantera sina arbetstider — så salongen drivs operativt.

**Kontext:** G02 (DB/RLS: `staff`, `working_hours`, `time_off`, `bookings`), G04 (bokningsmotor) klara. Auth-mönster finns från G05 (kan delas) men role=staff.

**Omfattning (bygg detta):**
- Staff-auth + skyddad layout `app/(staff)/...` (session + role=staff).
- Vyer:
  - Dag-/veckokalender med personalens egna bokningar (kund, tjänst, tid, status).
  - Markera bokning som `completed`/`no_show`.
  - Hantera egna `working_hours`.
  - Lägg/ta bort `time_off` (frånvaro) — påverkar tillgänglighet i M3 direkt.
- Snabböversikt "idag": antal bokningar, nästa kund.

**Utanför scope:**
- Skapa/redigera tjänster och prislista (G07 Salon Admin).
- Hantera andra anställda (G07).
- Löner/rapporter (G07/senare).

**Berörda områden/filer:** `5-Kod/app/(staff)/`, `5-Kod/components/staff/`, `5-Kod/lib/booking/` (återanvänd availability).

**Steg:**
1. Skyddad `(staff)`-layout med role=staff-check.
2. Kalendervy som hämtar personalens egna bokningar (RLS scoped).
3. Status-Actions (`completed`/`no_show`).
4. UI + Actions för egna `working_hours`.
5. UI + Actions för `time_off` (verifiera att M3-tillgänglighet uppdateras).
6. `pnpm build` + lint.

**Verifieras (DoD):**
- Personal ser endast egna bokningar (inte kollegors, inte annan tenant).
- Lägg time_off → slotten försvinner i M3 bokningsflöde.
- Ändring av working_hours → nya/borttagna slots i M3.
- Statusändring sparas och syns.
- `pnpm build` grön.

**Tekniska noter:**
- RLS: staff `select` bokningar där `staff_id = current_staff_id()`; salon_admin ser alla i tenant.
- Tillgänglighetsberäkning återanvänds från G04 (`lib/booking/availability.ts`) — ingen dubblerad logik.
- Kalender i salongens tidszon.
