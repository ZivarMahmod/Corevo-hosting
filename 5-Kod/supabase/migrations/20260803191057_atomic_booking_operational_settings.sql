-- Booking visibility belongs to tenant_modules. Provider and external destinations
-- are a narrow operational patch and must never replace the co-owned settings JSON.

create or replace function private.booking_external_url_is_valid(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_url is not null
    and length(p_url) <= 2048
    and p_url ~ '^https://[^/?#[:space:]@]+'
    and p_url !~ '[[:cntrl:]]'
    and p_url !~ '^https://[^/]*@'
$$;

revoke all on function private.booking_external_url_is_valid(text)
  from public, anon, authenticated, service_role;

create or replace function public.update_booking_operational_settings(
  p_tenant uuid,
  p_provider text,
  p_external_url text,
  p_external_cta_urls jsonb,
  p_verification_mode text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_urls jsonb := coalesce(p_external_cta_urls, '{}'::jsonb);
  v_url_count integer;
  v_patch jsonb;
  v_settings jsonb;
begin
  perform private.assert_site_revision_access(p_tenant);

  if p_provider not in ('corevo', 'external') then
    raise exception 'booking_provider_invalid' using errcode = '22023';
  end if;
  if p_verification_mode is not null
     and p_verification_mode not in ('sms_only', 'sms_with_email_fallback', 'email_only') then
    raise exception 'booking_verification_mode_invalid' using errcode = '22023';
  end if;
  if p_provider = 'external' and p_external_url is null then
    raise exception 'booking_external_url_required' using errcode = '22023';
  end if;
  if p_external_url is not null
     and not private.booking_external_url_is_valid(p_external_url) then
    raise exception 'booking_external_url_invalid' using errcode = '22023';
  end if;

  if jsonb_typeof(v_urls) <> 'object' or pg_column_size(v_urls) > 65536 then
    raise exception 'booking_external_cta_urls_invalid' using errcode = '22023';
  end if;
  v_url_count := (select count(*) from jsonb_object_keys(v_urls));
  if v_url_count > 64 or exists (
       select 1
         from jsonb_each(v_urls) item
        where jsonb_typeof(item.value) <> 'string'
           or length(item.key) > 80
           or not (
             item.key in ('nav', 'hero', 'services-footer', 'results', 'studio', 'final', 'contact', 'mobile')
             or item.key ~* '^service:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           )
           or not private.booking_external_url_is_valid(item.value #>> '{}')
     ) then
    raise exception 'booking_external_cta_urls_invalid' using errcode = '22023';
  end if;

  v_patch := jsonb_build_object(
    'provider', p_provider,
    'external_url', to_jsonb(p_external_url),
    'external_cta_urls', v_urls
  );
  if p_verification_mode is not null then
    v_patch := v_patch || jsonb_build_object('verificationMode', p_verification_mode);
  end if;

  insert into public.tenant_settings as ts (tenant_id, settings)
  values (p_tenant, jsonb_build_object('booking', v_patch))
  on conflict (tenant_id) do update
    set settings = jsonb_set(
      coalesce(ts.settings, '{}'::jsonb),
      '{booking}',
      (
        case when jsonb_typeof(ts.settings -> 'booking') = 'object'
          then ts.settings -> 'booking'
          else '{}'::jsonb
        end
      ) || v_patch,
      true
    )
  returning settings into v_settings;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'tenant.booking_settings_update',
    'tenant_settings',
    p_tenant,
    jsonb_build_object(
      'provider', p_provider,
      'global_url', case when p_external_url is null then 'cleared' else 'set' end,
      'cta_slot_count', v_url_count,
      'cta_slot_ids', coalesce((select jsonb_agg(key order by key) from jsonb_object_keys(v_urls) key), '[]'::jsonb)
    )
  );

  return v_settings;
end;
$$;

revoke all on function public.update_booking_operational_settings(uuid,text,text,jsonb,text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_booking_operational_settings(uuid,text,text,jsonb,text)
  to authenticated;

create or replace function private.corevo_booking_provider_enabled(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select ts.settings #>> '{booking,provider}'
      from public.tenant_settings ts
     where ts.tenant_id = p_tenant
  ), 'corevo') = 'corevo'
$$;

revoke all on function private.corevo_booking_provider_enabled(uuid)
  from public, anon, authenticated, service_role;

-- External providers expose links, never Corevo availability or booking writes.
create or replace function public.get_public_bookable_starts(
  p_tenant uuid,
  p_location uuid,
  p_service uuid,
  p_staff_ids uuid[],
  p_starts timestamptz[]
) returns table (staff_id uuid, start_ts timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.module_public_readable(p_tenant, 'booking')
     or not private.corevo_booking_provider_enabled(p_tenant) then
    return;
  end if;

  return query
  select available.staff_id, available.start_ts
    from private.get_public_bookable_starts_goal87_impl(
      p_tenant, p_location, p_service, p_staff_ids, p_starts
    ) available;
end;
$$;

create or replace function private.guard_corevo_booking_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_maintenance boolean :=
    session_user in ('postgres', 'supabase_admin')
    and coalesce((select auth.role()), '') = '';
begin
  if not v_maintenance
     and not private.corevo_booking_provider_enabled(new.tenant_id) then
    raise exception 'booking_provider_external' using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_corevo_booking_provider()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_corevo_booking_provider on private.booking_verification_challenges;
create trigger trg_corevo_booking_provider
  before insert on private.booking_verification_challenges
  for each row execute function private.guard_corevo_booking_provider();

drop trigger if exists trg_corevo_booking_provider on public.bookings;
create trigger trg_corevo_booking_provider
  before insert or update of tenant_id, staff_id, service_id, location_id, start_ts, end_ts
  on public.bookings
  for each row execute function private.guard_corevo_booking_provider();

-- A visible external module must have a usable destination. This keeps the
-- realtime toggle honest even when a caller bypasses the admin action.
create or replace function private.guard_booking_module_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider text;
  v_external_url text;
begin
  if new.module_key <> 'booking' or new.state <> 'live' then
    return new;
  end if;

  select coalesce(ts.settings #>> '{booking,provider}', 'corevo'),
         ts.settings #>> '{booking,external_url}'
    into v_provider, v_external_url
    from public.tenant_settings ts
   where ts.tenant_id = new.tenant_id;

  if coalesce(v_provider, 'corevo') = 'external'
     and not private.booking_external_url_is_valid(v_external_url) then
    raise exception 'booking_external_url_required' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_booking_module_visibility()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_booking_module_visibility on public.tenant_modules;
create trigger trg_booking_module_visibility
  before insert or update of state on public.tenant_modules
  for each row execute function private.guard_booking_module_visibility();

-- Services belong to the visible booking module regardless of provider. An
-- external provider changes each CTA destination, never the module gate.
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
  for select to anon
  using (
    active = true
    and exists (
      select 1 from public.tenants t
       where t.id = services.tenant_id and t.status = 'active'
    )
    and (select private.module_public_readable(services.tenant_id, 'booking'))
  );

-- Existing website-only customers used booking=off as a provider flag. Migrate
-- that legacy combination once: provider becomes external and the visible module
-- becomes live. Future off always means hidden, regardless of provider.
with migrated as (
  update public.tenant_settings ts
  set settings = jsonb_set(ts.settings, '{booking,provider}', '"external"'::jsonb, true)
  where jsonb_typeof(ts.settings -> 'booking') = 'object'
    and private.booking_external_url_is_valid(ts.settings #>> '{booking,external_url}')
    and coalesce(ts.settings #>> '{booking,provider}', '') = ''
  returning ts.tenant_id
)
insert into public.tenant_modules (tenant_id, module_key, state, config, updated_at)
select migrated.tenant_id, 'booking', 'live', '{}'::jsonb, now()
from migrated
on conflict (tenant_id, module_key) do update
set state = 'live', updated_at = now();
