-- ▸ FIL: 0063_booking_no_show.sql
-- ▸ (döp SQL-Editor-fliken till detta — Supabase kallar den annars "Untitled query")

-- 0063 — Uteblivna kunder (no_show).
--
-- En utebliven kund är en RIKTIG kostnad: tappad intäkt + tappad tid. Kan den inte
-- registreras kan den inte räknas. Statusen är därför en fjärde utgång på bokningen
-- vid sidan av avbokad — priset står kvar på raden, så den förlorade intäkten går att
-- summera i statistiken.
--
-- Modellen: bookings.status är TEXT + check-constraint (0001 §bookings), INTE en
-- Postgres-enum. Migrationen byter alltså ut check-constraintet, den skapar ingen
-- enum-typ.
--
-- Dubbelbokningsspärren (`no_double_booking`, partiellt index i 0001 på
-- status in ('pending','confirmed','completed')) rör vi INTE: en utebliven tid ska
-- inte fortsätta blockera resursen.
--
-- Idempotent — dubbelkörning ofarlig (repot för ingen migrationshistorik, schemat är
-- sanningen). Villkoret läser den FAKTISKA constraint-definitionen på public.bookings:
-- conname ensamt räcker inte (namn är unika per tabell, inte globalt), därför conrelid.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%no_show%'
  ) then
    alter table public.bookings drop constraint if exists bookings_status_check;
    alter table public.bookings
      add constraint bookings_status_check
      check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show'));
  end if;
end $$;

comment on column public.bookings.status is
  'pending | confirmed | completed | cancelled | no_show. no_show = kunden kom aldrig; '
  'priset (price_cents) står kvar så den förlorade intäkten kan räknas. Ångerbar → confirmed.';
