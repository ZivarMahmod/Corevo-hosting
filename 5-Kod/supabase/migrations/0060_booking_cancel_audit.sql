-- 0060 — Avbokningsspår: när, och av vem (goal-66, B-24 "ångralogg").
--
-- VARFÖR: en avbokad tid försvinner idag ur kalendern utan att någon kan svara på
-- "vem avbokade, och när?". Wavys trygghet sitter exakt där: en logg över de senaste
-- 30 dagarnas avbokningar, med vem/när/vad — och en väg tillbaka. Utan de här två
-- kolumnerna kan loggen aldrig säga mer än "den är borta".
--
-- MODELL: två nullbara kolumner på bookings. Ingen ny tabell — avbokningen ÄR en
-- egenskap hos bokningen, inte ett eget objekt. Befintliga rader får NULL (vi hittar
-- inte på en historik vi inte har: en gammal avbokning visas som "okänt när/av vem",
-- aldrig som ett gissat datum).
--
-- cancelled_by: 'customer' = kunden avbokade själv (självservicelänken i mejlet),
--               'business' = salongen avbokade i adminen.
-- Ingen enum — texten är begriplig i en SQL-prompt och kräver ingen typmigration när
-- en tredje aktör (t.ex. 'system' vid utebliven betalning) dyker upp.

alter table public.bookings
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text
    check (cancelled_by is null or cancelled_by in ('customer', 'business', 'system'));

comment on column public.bookings.cancelled_at is
  'När bokningen avbokades. NULL = inte avbokad, eller avbokad före 0060 (okänt).';
comment on column public.bookings.cancelled_by is
  'Vem som avbokade: customer (självservice), business (adminen), system (automatik).';

-- Ångraloggen frågar alltid "avbokade, senaste 30 dagarna, denna tenant" — ett
-- partiellt index håller den frågan billig utan att belasta skrivningar på aktiva
-- bokningar (de allra flesta rader har cancelled_at = NULL och hamnar aldrig i indexet).
create index if not exists bookings_cancelled_recent_idx
  on public.bookings (tenant_id, cancelled_at desc)
  where cancelled_at is not null;
