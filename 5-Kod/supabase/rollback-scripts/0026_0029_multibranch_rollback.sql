-- ============================================================================
-- ROLLBACK — Multi-bransch DB-grund (0026–0029)  ·  spår 1
--
-- ⚠️ DESTRUKTIV. Bryter projektets build-once-never-delete-regel med AVSIKT:
-- denna fil är ENBART för en SAFE Supabase-branch under utveckling (06-syntes:
-- "Allt byggs på SAFE Supabase-branch tills du säger deploy"). KÖR ALDRIG mot
-- prod (clylvowtowbtotrahuad). På prod gäller framåt-only.
--
-- Tar bort allt 0026–0028 skapade + återställer 0029 (om körd). Ordning =
-- omvänd beroendeordning (policies/triggers → tenant-tabeller → katalog → kolumn).
-- IDEMPOTENT: drop ... if exists genomgående. Säker att köra om / delvis.
--
-- media_assets: vi DROPPAR den här eftersom 0026 skapade den. OBS — om ett annat
-- spår senare gör media_assets till en delad tabell med data, KOMMENTERA UT
-- media_assets-droppen nedan innan rollback körs (annars förloras de raderna).
-- ============================================================================

-- ── 0029: återställ users.tenant_id (endast om inga null-rader finns) ──
do $$
begin
  if exists (select 1 from public.users where tenant_id is null) then
    raise notice 'hoppar users NOT NULL-återställning: tenant_id IS NULL-rader finns';
  else
    alter table public.users alter column tenant_id set not null;
  end if;
end $$;
comment on column public.users.tenant_id is null;

-- ── 0027: policies (drop före tabell-drop; tabell-drop tar annars med dem, men
--    explicit gör filen säker att köra delvis) ──
drop policy if exists media_assets_public_read   on public.media_assets;
drop policy if exists media_assets_rls           on public.media_assets;
drop policy if exists content_slots_public_read  on public.content_slots;
drop policy if exists content_slots_rls          on public.content_slots;
drop policy if exists tenant_modules_rls         on public.tenant_modules;
drop policy if exists template_slots_admin_write on public.template_slots;
drop policy if exists template_slots_read        on public.template_slots;
drop policy if exists templates_admin_all        on public.templates;
drop policy if exists templates_read_active      on public.templates;
drop policy if exists modules_admin_write        on public.modules;
drop policy if exists modules_read               on public.modules;
drop policy if exists verticals_admin_write      on public.verticals;
drop policy if exists verticals_read             on public.verticals;

-- ── 0026: triggers + guard-funktion ──
drop trigger  if exists trg_tenant_modules_state_guard on public.tenant_modules;
drop function if exists public.tenant_modules_state_guard();
do $$
declare t text;
begin
  foreach t in array array['media_assets','verticals','modules','templates','content_slots','tenant_modules']
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I;', t);
  end loop;
end $$;

-- ── 0026: tenants.vertical_id (FK + index + kolumn) ──
alter table public.tenants drop constraint if exists tenants_vertical_id_fkey;
drop index if exists public.tenants_vertical_id_idx;
alter table public.tenants drop column if exists vertical_id;

-- ── 0026: tabeller (omvänd beroendeordning) ──
drop table if exists public.content_slots  cascade;
drop table if exists public.template_slots cascade;
drop table if exists public.tenant_modules cascade;
drop table if exists public.templates      cascade;
drop table if exists public.modules        cascade;
drop table if exists public.verticals      cascade;
-- media_assets: skapad av 0026. Kommentera ut nästa rad om annat spår äger den med data.
drop table if exists public.media_assets   cascade;
