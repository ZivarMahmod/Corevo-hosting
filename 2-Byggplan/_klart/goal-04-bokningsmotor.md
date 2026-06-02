## Goal 04 — Bokningsmotor M3 (kärnan)

**Spår:** B · **Beror på:** G02 · **Modul:** M3 (Bokningsmotor)

**Mål:** Bygg själva boknings-flödet: välj tjänst → välj personal → se lediga tider (beräknade från arbetstider, befintliga bokningar, frånvaro) → bekräfta bokning. Detta är hjärtat; M4/M5/M6/M8 bygger ovanpå.

**Kontext:** G02 klar (`services`, `staff`, `staff_services`, `working_hours`/`availability`, `time_off`, `bookings`). G03 kan köra parallellt och länkar hit via `/boka`. `database.types.ts` finns.

**Omfattning (bygg detta):**
- Tillgänglighets-motor (`lib/booking/availability.ts`): given tenant + service + (valfri) staff + datumintervall → lista lediga slot-tider. Tar hänsyn till:
  - personalens `working_hours`,
  - befintliga `bookings` (krockar),
  - `time_off`,
  - tjänstens `varaktighet_min` + ev. buffert.
- Boknings-Server-Actions (`app/boka/actions.ts`):
  - `getAvailableSlots(serviceId, staffId?, date)`,
  - `createBooking(...)` med **transaktionssäker krockkontroll** (no double-booking).
- Bokningsflöde-UI (`app/boka/`): stegvis — tjänst → personal (eller "valfri") → kalender/tider → kunduppgifter → bekräftelse.
- Gäst-bokning tillåten (namn/e-post/telefon) ELLER inloggad kund (kopplas i G05).
- Bokningsstatus sätts `pending`/`confirmed` enligt tenant-policy.
- Bekräftelsesida + bekräftelse-data (e-postutskick stubbas, byggs i G10).

**Utanför scope:**
- Betalning (G09 — `createBooking` lämnar krok för payment_intent).
- Kundkonto/historik-UI (G05).
- Personalens egen kalendervy (G06).
- Admin-redigering av tjänster/scheman (G07).

**Berörda områden/filer:** `5-Kod/lib/booking/`, `5-Kod/app/boka/`, `5-Kod/app/boka/actions.ts`, `5-Kod/components/booking/`.

**Steg:**
1. Skriv `availability.ts` med ren, testbar slot-beräkning (input → output, inga sidoeffekter).
2. Enhetstesta slot-logiken (krock, frånvaro, kanttider, varaktighet).
3. Bygg Server Actions för slots + createBooking; krockkontroll i samma DB-transaktion (`select ... for update` eller unik constraint på `(tenant_id, staff_id, start_ts)`).
4. Bygg stegvis boknings-UI under `/boka`.
5. Bekräftelsesida; lämna `paymentRequired`-flagga/krok för G09.
6. `pnpm build` + lint + tester gröna.

**Verifieras (DoD):**
- Slot-beräkning korrekt i enhetstester (minst krock, time_off, arbetstidsgräns, varaktighet).
- Två samtidiga `createBooking` på samma slot → endast en lyckas (double-booking omöjlig).
- Hela flödet boka→bekräftelse fungerar end-to-end mot demo-tenant.
- Bokning skapas med rätt `tenant_id` och syns inte för annan tenant (RLS).
- `pnpm build` grön.

**Tekniska noter:**
- Lägg DB-constraint mot dubbelbokning: unik index/exclusion constraint på överlappande `(tenant_id, staff_id, [start_ts,end_ts))` — Postgres `btree_gist` exclusion är idealiskt.
- All slot-matematik i UTC i DB; presentera i salongens tidszon.
- `createBooking` returnerar krok `{ bookingId, requiresPayment }` så G09 kan koppla på Stripe utan att röra kärnflödet.
- Gäst-bokningar: skapa/återanvänd en `profiles`-rad med role=customer (eller separat `guest`-fält) inom tenant.
