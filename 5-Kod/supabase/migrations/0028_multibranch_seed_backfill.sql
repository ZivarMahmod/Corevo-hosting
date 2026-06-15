-- ============================================================================
-- 0028 — Multi-bransch DB-grund · SEED + BACKFILL (spår 1)
--
-- Seedar:
--   • frisör-vertical (default_modules {booking:live,loyalty:draft,shop:off},
--     default_template 'salvia', terminology {staff:Stylist,service:Klippning})
--   • booking-modulen (+ media_library-modulen, 03-innehall-asset storage-hook)
--   • salvia-templates-rad (status='active' så storefront/tenant kan läsa den)
-- Backfill:
--   • befintliga tenants får vertical_id='frisör' (mjuk default, mutabel)
--   • + tenant_modules booking:live  → FreshCut renderar OFÖRÄNDRAT
--   (FreshCut = tenant 11111111-1111-1111-1111-111111111111, slug 'demo',
--    tenant_settings.settings.theme='salvia' redan satt i seed-freshcut.sql).
--
-- ANCHOR-NOT: 00-plan-index/memory nämner en anchor-tenant 'corevo-system'. Den
-- finns INTE i nuvarande seed/migrationer (enda tenant = demo→FreshCut). Vi skapar
-- INGEN ny anchor här (utanför detta spårs scope) — backfillen scopar därför till
-- ALLA befintliga tenants generiskt (frisör-default), vilket inkluderar FreshCut.
-- Om en 'corevo-system'-anchor senare införs väljer den sin egen vertical då.
--
-- IDEMPOTENT: on conflict do nothing / do update. Säker att köra om.
-- Körs EFTER 0026 (tabeller) + 0027 (RLS). Seed-INSERT av booking:live passerar
-- state-vakten (0026 §9) eftersom migrationen kör utan PostgREST-JWT (no_request).
--
-- ROLLBACK: se 0026_0029_multibranch_rollback.sql (avsnitt 0028).
-- ============================================================================

-- ── 1. verticals: frisör (launch-branscher i 06-syntes: frisör/barbershop/ ───
--    nagelstudio/restaurang/generell — frisör seedas nu, övriga utökas lätt). ─
insert into public.verticals (key, name, default_modules, default_template, terminology, rules)
values (
  'frisör',
  'Frisör',
  '{"booking":"live","loyalty":"draft","shop":"off"}'::jsonb,
  'salvia',
  '{"staff":"Stylist","service":"Klippning"}'::jsonb,
  '{}'::jsonb
)
on conflict (key) do update
  set name             = excluded.name,
      default_modules  = excluded.default_modules,
      default_template = excluded.default_template,
      terminology      = excluded.terminology,
      updated_at       = now();

-- ── 2. modules: booking (kärnmodul) + media_library (03 storage-billing-hook) ─
insert into public.modules (key, name, owns_tables, variant_schema, default_config, default_section_position)
values
  (
    'booking',
    'Bokning',
    '["bookings","services","staff","staff_services","working_hours","time_off","slot_holds"]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    'main'
  ),
  (
    'media_library',
    'Bildbibliotek',
    '["media_assets"]'::jsonb,
    '{}'::jsonb,
    -- bas-kvot (06-syntes beslut: 25 bilder / 500 MB inkluderat). billing = BARA hook.
    '{"included_bytes":524288000,"quota_bytes":524288000,"billing":{"metric":"stored_gb","unit_price_hook":"media_library.storage_gb","billable_since":null}}'::jsonb,
    null
  )
on conflict (key) do update
  set name                     = excluded.name,
      owns_tables              = excluded.owns_tables,
      default_config           = excluded.default_config,
      default_section_position = excluded.default_section_position,
      updated_at               = now();

-- ── 3. templates: salvia (status='active' → tenant/anon får läsa) ───────────
-- Minimal kanonisk rad; full tokens/sections/tags ägs/berikas av spår 02. tags.licens
-- noteras (02: salvia-temat driver FreshCut:s färger/default-bilder).
insert into public.templates (key, name, tags, tokens, sections, status)
values (
  'salvia',
  'Salvia',
  '{"bransch":"frisör","typ":"storefront","stil":"modern","licens":"unknown","scope":"booking"}'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  'active'
)
on conflict (key) do update
  set name       = excluded.name,
      status     = 'active',
      updated_at = now();

-- ── 4. BACKFILL: alla befintliga tenants → vertical_id='frisör' ─────────────
-- Mjuk default: sätt bara där det saknas (mutabel; vi skriver inte över ett val).
update public.tenants
   set vertical_id = 'frisör'
 where vertical_id is null;

-- ── 5. BACKFILL: tenant_modules booking:live för alla befintliga tenants ────
-- FreshCut (och alla nuvarande tenants) får booking aktivt → renderar oförändrat.
-- on conflict do nothing → kör om utan att nolla ett senare ändrat state.
-- INSERT med state='live' passerar state-vakten (migration = no_request, privileg).
insert into public.tenant_modules (tenant_id, module_key, state, config, activated_at)
select t.id, 'booking', 'live', '{}'::jsonb, now()
  from public.tenants t
on conflict (tenant_id, module_key) do nothing;

-- (media_library lämnas 'off' per tenant tills kund slår på toggeln — ingen seed-rad.)

-- ── 6. Sanity: visa att FreshCut fick sin grund (no-op om saknas) ──────────
do $$
declare
  v_demo uuid := '11111111-1111-1111-1111-111111111111';
  v_vert text;
  v_state text;
begin
  select vertical_id into v_vert from public.tenants where id = v_demo;
  select state into v_state from public.tenant_modules
   where tenant_id = v_demo and module_key = 'booking';
  if v_vert is not null then
    raise notice 'backfill OK: FreshCut vertical_id=% booking=%', v_vert, coalesce(v_state,'(saknas)');
  else
    raise notice 'backfill: demo/FreshCut-tenant (%) finns ej i denna DB — hoppar', v_demo;
  end if;
end $$;
