-- ============================================================================
-- 0030 — Multi-bransch · FLER BRANSCHER (launch-set, spår 5 onboarding/storefront)
--
-- 06-syntes-beslut LÅST launch-branscher: frisör, barbershop, nagelstudio,
-- restaurang, generell. frisör seedades i 0028; denna fil lägger de fyra övriga
-- som verticals-PRESETS (etikett, INTE lås — operatören kan toggla allt i wizarden).
--
-- Seedar per bransch:
--   • verticals-rad   (default_modules, default_template, terminology, rules)
--   • templates-rad   (status='active', tags.bransch=<vertical> → wizardens
--                       bransch-filtrerade Temamall-steg får träffar att lista)
--
-- TEMAMALL-KOPPLING (00-plan-index: verticals.default_template → templates.key,
-- mjuk koppling). Mall-radens tags.bransch = vertical-nyckeln så onboarding-wizarden
-- kan lista mallar filtrerat på vald bransch (CreateTenantForm steg "Temamall"):
--   barbershop  → zigge   (mörk/rå barber)
--   nagelstudio → linnea  (varm skandinavisk)
--   restaurang  → leander (romantisk editorial — bordsbokning)
--   generell    → edit    (elegant minimal, bransch-neutral)
-- salvia (frisör) seedades redan i 0028 och rörs INTE här.
--
-- default_modules: booking:live för ALLA (plattformens baslinje/FreshCut-paritet);
-- loyalty:draft där det är rimligt (frisör-likt: barbershop/nagelstudio), annars off.
-- shop:off överallt (ingen butik vid launch). default_modules är ren jsonb-preset
-- (ingen FK mot modules) — wizarden golvar booking till minst live oavsett.
--
-- terminology = etikett-överlägg (00-plan-index): { staff, service } per bransch.
--   barbershop  staff=Barberare   service=Klippning
--   nagelstudio staff=Nagelteknolog service=Behandling
--   restaurang  staff=Personal     service=Rätt   (+ unit=bord, bokningsobjekt)
--   generell    {} (neutral — ingen bransch-jargong)
--
-- IDEMPOTENT: on conflict (key) do update. Säker att köra om. Körs EFTER 0026
-- (tabeller) + 0027 (RLS) + 0028 (frisör-seed). Build-once-never-delete (inget
-- droppas; befintliga branscher/mallar skrivs inte över utöver kontrakts-fälten).
-- Seed-INSERT kör utan PostgREST-JWT (no_request) → state-vakten (0026 §9) passeras.
--
-- ROLLBACK: radera de fyra verticals- + templates-nycklarna nedan (men vi tar
-- aldrig bort branscher i drift — se 0026_0029_multibranch_rollback.sql-mönstret).
-- ============================================================================

-- ── 1. verticals: barbershop, nagelstudio, restaurang, generell ─────────────
insert into public.verticals (key, name, default_modules, default_template, terminology, rules)
values
  (
    'barbershop',
    'Barbershop',
    '{"booking":"live","loyalty":"draft","shop":"off"}'::jsonb,
    'zigge',
    '{"staff":"Barberare","service":"Klippning"}'::jsonb,
    '{}'::jsonb
  ),
  (
    'nagelstudio',
    'Nagelstudio',
    '{"booking":"live","loyalty":"draft","shop":"off"}'::jsonb,
    'linnea',
    '{"staff":"Nagelteknolog","service":"Behandling"}'::jsonb,
    '{}'::jsonb
  ),
  (
    'restaurang',
    'Restaurang',
    '{"booking":"live","loyalty":"off","shop":"off"}'::jsonb,
    'leander',
    '{"staff":"Personal","service":"Rätt","unit":"bord"}'::jsonb,
    '{"booking":{"object":"table"}}'::jsonb
  ),
  (
    'generell',
    'Generell',
    '{"booking":"live","loyalty":"off","shop":"off"}'::jsonb,
    'edit',
    '{}'::jsonb,
    '{}'::jsonb
  )
on conflict (key) do update
  set name             = excluded.name,
      default_modules  = excluded.default_modules,
      default_template = excluded.default_template,
      terminology      = excluded.terminology,
      rules            = excluded.rules,
      updated_at       = now();

-- ── 2. templates: zigge, linnea, leander, edit (status='active') ────────────
-- Minimala kanoniska rader; full tokens/sections berikas av spår 02. tags.bransch
-- = vertical-nyckeln så wizardens bransch-filtrerade Temamall-steg får träffar.
-- salvia ägs av 0028 och seedas INTE om här.
insert into public.templates (key, name, tags, tokens, sections, status)
values
  (
    'zigge',
    'Zigge',
    '{"bransch":"barbershop","typ":"storefront","stil":"mörk","licens":"unknown","scope":"booking"}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    'active'
  ),
  (
    'linnea',
    'Linnea',
    '{"bransch":"nagelstudio","typ":"storefront","stil":"skandinavisk","licens":"unknown","scope":"booking"}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    'active'
  ),
  (
    'leander',
    'Leander',
    '{"bransch":"restaurang","typ":"storefront","stil":"editorial","licens":"unknown","scope":"booking"}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    'active'
  ),
  (
    'edit',
    'Edit',
    '{"bransch":"generell","typ":"storefront","stil":"minimal","licens":"unknown","scope":"booking"}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    'active'
  )
on conflict (key) do update
  set name       = excluded.name,
      tags       = excluded.tags,
      status     = 'active',
      updated_at = now();

-- ── 3. Sanity: visa launch-branscherna + deras mall (no-op vid fel) ─────────
do $$
declare
  v_count int;
begin
  select count(*) into v_count from public.verticals
   where key in ('frisör','barbershop','nagelstudio','restaurang','generell');
  raise notice 'verticals launch-set: %/5 seedade', v_count;
end $$;
