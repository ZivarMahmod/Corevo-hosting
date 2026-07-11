-- ============================================================================
-- 0056 — Kurser blir en EGEN modul (Zivar: "allt vi bygger ska inte in direkt,
-- det ska finnas en av och på som jag kan välja för varje kund").
--
-- Bakgrund: 0052 skapade tenant_events/event_registrations men registrerade
-- ingen modul — kurser gate:ades på BOOKING, så varje kund med booking live
-- fick kurser automatiskt. Denna migration registrerar `kurser` i modules-
-- katalogen (samma mönster som 0034 blogg) så livscykeln off/draft/live/paused
-- styrs per kund i kundkortets Moduler-kort. Kod-gaterna byts från 'booking'
-- till 'kurser' i samma commit.
--
-- Backfill: BARA kunder som faktiskt har tenant_events-rader (floristen) får
-- kurser=live — alla andra faller till default 'off' (ingen rad). Det är hela
-- poängen: kurser försvinner från kunder som aldrig bett om den.
--
-- IDEMPOTENT. Build-once-never-delete (inget droppas).
-- ============================================================================

insert into public.modules
  (key, name, owns_tables, variant_schema, default_config, default_section_position)
values (
  'kurser',
  'Kurser & event',
  '["tenant_events","event_registrations"]'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  'main'
)
on conflict (key) do update
  set name       = excluded.name,
      owns_tables = excluded.owns_tables,
      updated_at  = now();

-- Backfill: live endast där kurser faktiskt används idag.
insert into public.tenant_modules (tenant_id, module_key, state, activated_at)
select distinct e.tenant_id, 'kurser', 'live', now()
  from public.tenant_events e
on conflict (tenant_id, module_key) do nothing;

-- Bransch-förval: florister onboardas med kurser live (kursverksamhet är
-- kärnaffär i branschen). Övriga branscher lämnas orörda → off.
update public.verticals
   set default_modules = coalesce(default_modules, '{}'::jsonb) || '{"kurser":"live"}'::jsonb
 where key = 'florist';
