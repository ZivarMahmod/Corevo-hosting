-- Goal 88: atomic theme switch.
-- Mallbyte och sidutkast delar save_site_draft:s kanoniska tenant-radlås, så
-- draftkontroll och settings-skrivning inte kan separeras av en annan session.

create or replace function private.canonical_site_theme(p_settings jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_settings ->> 'theme' in (
      'salvia',
      'leander',
      'zigge',
      'linnea',
      'edit',
      'flora',
      'freshcut',
      'ateljevinter',
      'aurora',
      'blomstertorget',
      'calytrix',
      'eloria',
      'lunaria',
      'onyx',
      'sivsav',
      'solsalt',
      'kalla',
      'siluett',
      'snitt',
      'zentum'
    ) then p_settings ->> 'theme'
    else 'leander'
  end
$$;

revoke all on function private.canonical_site_theme(jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.switch_tenant_theme(
  p_tenant uuid,
  p_expected_settings jsonb,
  p_expected_vertical text,
  p_theme text,
  p_copy jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings jsonb;
  v_vertical_id text;
begin
  if (select auth.uid()) is null
     or not coalesce((select private.is_platform_admin()), false) then
    raise exception 'site_theme_scope_denied' using errcode = '42501';
  end if;
  if p_expected_settings is null or jsonb_typeof(p_expected_settings) <> 'object' then
    raise exception 'site_theme_expected_settings_invalid' using errcode = '22023';
  end if;
  if p_copy is null or jsonb_typeof(p_copy) <> 'object' then
    raise exception 'site_theme_copy_invalid' using errcode = '22023';
  end if;
  if p_theme is null or p_theme not in (
    'ateljevinter',
    'aurora',
    'blomstertorget',
    'calytrix',
    'eloria',
    'freshcut',
    'lunaria',
    'onyx',
    'sivsav',
    'solsalt',
    'kalla',
    'siluett',
    'snitt'
  ) then
    raise exception 'site_theme_invalid' using errcode = '22023';
  end if;

  -- Samma första lås som save_site_draft; alla draft/theme-ordningar blir serialiserade.
  select t.vertical_id
    into v_vertical_id
    from public.tenants t
   where t.id = p_tenant
   for update;
  if not found then
    raise exception 'site_theme_tenant_missing' using errcode = 'P0002';
  end if;

  if exists (
    select 1
      from public.site_revisions sr
     where sr.tenant_id = p_tenant
       and sr.status = 'draft'
  ) then
    raise exception 'site_theme_draft_exists' using errcode = '55000';
  end if;

  if v_vertical_id is distinct from p_expected_vertical then
    raise exception 'site_theme_tenant_conflict' using errcode = '40001';
  end if;

  -- Materialisera även den första settings-raden innan CAS. ON CONFLICT väntar
  -- på en parallell första insert; SELECT FOR UPDATE läser sedan dess sanna state.
  insert into public.tenant_settings (tenant_id, settings)
  values (p_tenant, '{}'::jsonb)
  on conflict (tenant_id) do nothing;

  select ts.settings
    into v_settings
    from public.tenant_settings ts
   where ts.tenant_id = p_tenant
   for update;
  v_settings := coalesce(v_settings, '{}'::jsonb);

  -- Appen räknar fram mallcopy från exakt detta lästa state. CAS förhindrar
  -- att en parallell settings-ändring skrivs över av en gammal beräkning.
  if v_settings is distinct from p_expected_settings then
    raise exception 'site_theme_settings_conflict' using errcode = '40001';
  end if;

  update public.tenant_settings ts
     set settings = v_settings || jsonb_build_object('theme', p_theme, 'copy', p_copy)
   where ts.tenant_id = p_tenant;
end;
$$;

revoke all on function public.switch_tenant_theme(uuid,jsonb,text,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.switch_tenant_theme(uuid,jsonb,text,text,jsonb)
  to authenticated;

comment on function public.switch_tenant_theme(uuid,jsonb,text,text,jsonb) is
  'Root-only atomic theme switch serialized with site draft mutations on the tenant row.';

-- Den omvända ordningen måste också vara säker: om mallbytet vinner tenantlåset
-- får en redan öppen editor inte skapa/uppdatera ett utkast från den gamla mallen.
create or replace function public.save_site_draft(
  p_tenant uuid,
  p_snapshot jsonb,
  p_expected_lock_version bigint default null
) returns table (revision_id uuid, lock_version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision_id uuid;
  v_lock_version bigint;
  v_live_theme text;
  v_snapshot_theme text;
begin
  perform private.assert_site_revision_access(p_tenant);
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'site_snapshot_must_be_object' using errcode = '22023';
  end if;
  perform private.assert_site_snapshot(p_snapshot);

  -- Behåll exakt samma första serialiseringsgräns som revisionsmotorn alltid har haft.
  perform 1 from public.tenants t where t.id = p_tenant for update;
  if not found then
    raise exception 'site_revision_tenant_missing' using errcode = 'P0002';
  end if;

  select private.canonical_site_theme(ts.settings)
    into v_live_theme
    from public.tenant_settings ts
   where ts.tenant_id = p_tenant;
  v_live_theme := coalesce(v_live_theme, 'leander');
  v_snapshot_theme := private.canonical_site_theme(p_snapshot -> 'settings');
  if v_snapshot_theme is distinct from v_live_theme then
    raise exception 'site_revision_theme_conflict' using errcode = '40001';
  end if;

  select sr.id, sr.lock_version
    into v_revision_id, v_lock_version
    from public.site_revisions sr
   where sr.tenant_id = p_tenant and sr.status = 'draft'
   for update;

  if v_revision_id is null then
    if p_expected_lock_version is not null then
      raise exception 'site_revision_conflict' using errcode = '40001';
    end if;
    insert into public.site_revisions as sr (
      tenant_id, status, snapshot, lock_version, created_by, updated_by
    ) values (
      p_tenant, 'draft', p_snapshot, 1, (select auth.uid()), (select auth.uid())
    )
    returning sr.id, sr.lock_version into v_revision_id, v_lock_version;
  else
    if p_expected_lock_version is null or p_expected_lock_version <> v_lock_version then
      raise exception 'site_revision_conflict' using errcode = '40001';
    end if;
    update public.site_revisions sr
       set snapshot = p_snapshot,
           lock_version = sr.lock_version + 1,
           source_revision_id = null,
           updated_by = (select auth.uid()),
           updated_at = now()
     where sr.id = v_revision_id
    returning sr.lock_version into v_lock_version;
  end if;

  return query select v_revision_id, v_lock_version;
end;
$$;

revoke all on function public.save_site_draft(uuid,jsonb,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.save_site_draft(uuid,jsonb,bigint)
  to authenticated;

comment on function public.save_site_draft(uuid,jsonb,bigint) is
  'Optimistic site draft write serialized with theme switches and rejected on live-theme mismatch.';

create or replace function public.restore_site_revision(
  p_tenant uuid,
  p_source_revision_id uuid,
  p_expected_lock_version bigint default null
) returns table (revision_id uuid, lock_version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot jsonb;
  v_revision_id uuid;
  v_lock_version bigint;
  v_live_theme text;
begin
  perform private.assert_site_revision_access(p_tenant);
  perform 1 from public.tenants t where t.id = p_tenant for update;
  if not found then
    raise exception 'site_revision_tenant_missing' using errcode = 'P0002';
  end if;

  select sr.snapshot
    into v_snapshot
    from public.site_revisions sr
   where sr.id = p_source_revision_id
     and sr.tenant_id = p_tenant
     and sr.status = 'published';
  if v_snapshot is null then
    raise exception 'published_site_revision_missing' using errcode = 'P0002';
  end if;

  select private.canonical_site_theme(ts.settings)
    into v_live_theme
    from public.tenant_settings ts
   where ts.tenant_id = p_tenant;
  v_live_theme := coalesce(v_live_theme, 'leander');
  if private.canonical_site_theme(v_snapshot -> 'settings') is distinct from v_live_theme then
    raise exception 'site_revision_theme_conflict' using errcode = '40001';
  end if;

  select sr.id, sr.lock_version
    into v_revision_id, v_lock_version
    from public.site_revisions sr
   where sr.tenant_id = p_tenant and sr.status = 'draft'
   for update;

  if v_revision_id is null then
    if p_expected_lock_version is not null then
      raise exception 'site_revision_conflict' using errcode = '40001';
    end if;
    insert into public.site_revisions as sr (
      tenant_id, status, snapshot, lock_version, source_revision_id, created_by, updated_by
    ) values (
      p_tenant, 'draft', v_snapshot, 1, p_source_revision_id,
      (select auth.uid()), (select auth.uid())
    )
    returning sr.id, sr.lock_version into v_revision_id, v_lock_version;
  else
    if p_expected_lock_version is null or p_expected_lock_version <> v_lock_version then
      raise exception 'site_revision_conflict' using errcode = '40001';
    end if;
    update public.site_revisions sr
       set snapshot = v_snapshot,
           lock_version = sr.lock_version + 1,
           source_revision_id = p_source_revision_id,
           updated_by = (select auth.uid()),
           updated_at = now()
     where sr.id = v_revision_id
    returning sr.lock_version into v_lock_version;
  end if;

  return query select v_revision_id, v_lock_version;
end;
$$;

revoke all on function public.restore_site_revision(uuid,uuid,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.restore_site_revision(uuid,uuid,bigint)
  to authenticated;

comment on function public.restore_site_revision(uuid,uuid,bigint) is
  'Published revision restore serialized with theme switches and rejected on live-theme mismatch.';
