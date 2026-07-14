-- 0061 — Återkommande blockeringar + kundflaggor (goal-66, B-22/B-23 + B-25).
--
-- ── DEL 1: time_off.series_id ────────────────────────────────────────────────
-- "Lunch varje dag" ska inte kräva fem klick i veckan. Modellen är MATERIALISERAD:
-- upprepningen skrivs som vanliga time_off-rader (en per förekomst, 12 månader fram),
-- som delar ett series_id. Ingen RRULE-motor, ingen expansion vid läsning — kalendern,
-- get_busy_intervals och realtidskanalen läser exakt samma rader som idag. En sanning.
--
-- "Denna och framåt" = radera seriens rader med start_ts >= den valda. Bakåt skrivs
-- aldrig om (raderna för förra veckan är historik om vad som faktiskt var blockerat).
--
-- ponytail: materialisering har ett tak — serien tar slut efter 12 månader och måste
-- läggas om. Taket är medvetet: en regelmotor (RRULE) är priset för "för evigt", och
-- det priset betalas först om kunderna faktiskt springer in i taket.

alter table public.time_off
  add column if not exists series_id uuid;

comment on column public.time_off.series_id is
  'Grupperar en återkommande blockering (materialiserade rader). NULL = engångsblockering.';

-- "Denna och framåt" frågar alltid (tenant, serie, start >= X) — indexet gör den
-- frågan billig. Partiellt: engångsblockeringar (den stora majoriteten) indexeras inte.
create index if not exists time_off_series_idx
  on public.time_off (tenant_id, series_id, start_ts)
  where series_id is not null;

-- ── DEL 2: customers.hidden_at + self_book ───────────────────────────────────
-- hidden_at (B-25 "Dölj kund"): soft delete. Kunden försvinner ur listor och sök,
-- men raden — och hela bokningshistoriken — finns kvar. INTE GDPR-radering; den
-- vägen är status='anonymized' (0011). En dold kund kan visas igen; en anonymiserad
-- kan inte återskapas.
--
-- self_book (B-25-toggle): får kunden boka SJÄLV via sajten/kundkontot? false =
-- salongen bokar åt hen (telefonen fungerar alltid). Vakten sitter i appens
-- kundflöde — ägarens egen bokning i kalendern påverkas aldrig.

alter table public.customers
  add column if not exists hidden_at timestamptz,
  add column if not exists self_book boolean not null default true;

comment on column public.customers.hidden_at is
  'Soft delete: dold ur listor/sök sedan denna tidpunkt. NULL = synlig. Historiken behålls.';
comment on column public.customers.self_book is
  'false = kunden kan inte boka själv via sajten; salongen bokar åt hen.';
