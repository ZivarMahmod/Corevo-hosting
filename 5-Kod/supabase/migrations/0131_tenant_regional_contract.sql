-- Goal 83: Sweden-first tenant regional contract.
-- Locations keep owning calendar timezones; tenant_settings owns safe defaults.

begin;

alter table public.tenant_settings
  add column country_code text,
  add column locale text,
  add column currency text,
  add column default_timezone text;

update public.tenant_settings ts
set default_timezone = coalesce(
  (
    select l.timezone
    from public.locations l
    where l.tenant_id = ts.tenant_id
      and l.is_primary = true
      and l.active = true
      and exists (
        select 1
        from pg_catalog.pg_timezone_names zone
        where zone.name = l.timezone
          and zone.name not like 'posix/%'
          and zone.name not like 'right/%'
          and zone.name <> 'Factory'
      )
    order by l.created_at, l.id
    limit 1
  ),
  'Europe/Stockholm'
)
where ts.default_timezone is null;

update public.tenant_settings
set country_code = 'SE',
    locale = 'sv-SE',
    currency = 'SEK'
where country_code is null
   or locale is null
   or currency is null;

do $timezone_preflight$
begin
  if exists (
    select 1
    from public.locations l
    where not exists (
      select 1
      from pg_catalog.pg_timezone_names zone
      where zone.name = l.timezone
        and zone.name not like 'posix/%'
        and zone.name not like 'right/%'
        and zone.name <> 'Factory'
    )
  ) then
    raise exception 'invalid_existing_location_timezone' using errcode = '22023';
  end if;
end
$timezone_preflight$;

alter table public.tenant_settings
  alter column country_code set default 'SE',
  alter column country_code set not null,
  alter column locale set default 'sv-SE',
  alter column locale set not null,
  alter column currency set default 'SEK',
  alter column currency set not null,
  alter column default_timezone set default 'Europe/Stockholm',
  alter column default_timezone set not null,
  add constraint tenant_settings_country_code_se
    check (country_code = 'SE'),
  add constraint tenant_settings_locale_sv_se
    check (locale = 'sv-SE'),
  add constraint tenant_settings_currency_sek
    check (currency = 'SEK');

-- Keep portal recovery/contact-change normalization on the same Sweden-only
-- trust boundary as storefront booking. Legacy masks remain valid evidence;
-- every newly generated SMS mask uses Swedish local presentation.
create or replace function private.customer_portal_normalize_recovery_lookup(p_lookup text)
returns table (channel text, normalized text, masked text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_value text := pg_catalog.btrim(p_lookup);
  v_compact text;
  v_local text;
  v_domain text;
begin
  if v_value is null or pg_catalog.length(v_value) not between 3 and 200 then
    return;
  end if;
  if pg_catalog.strpos(v_value, '@') > 0 then
    v_value := pg_catalog.lower(v_value);
    if v_value !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then return; end if;
    v_local := pg_catalog.split_part(v_value, '@', 1);
    v_domain := pg_catalog.split_part(v_value, '@', 2);
    return query select 'email'::text, v_value,
      pg_catalog.left(v_local, 1) || '•••@' || v_domain;
    return;
  end if;

  v_compact := pg_catalog.regexp_replace(v_value, '[[:space:]()\-]', '', 'g');
  if v_compact ~ '^0046(70|72|73|76|79)[0-9]{7}$' then
    v_compact := '+' || pg_catalog.substr(v_compact, 3);
  elsif v_compact ~ '^0(70|72|73|76|79)[0-9]{7}$' then
    v_compact := '+46' || pg_catalog.substr(v_compact, 2);
  end if;
  if v_compact !~ '^\+46(70|72|73|76|79)[0-9]{7}$' then return; end if;
  return query select 'sms'::text, v_compact,
    '0' || pg_catalog.substr(v_compact, 4, 2)
      || ' ••• •• ' || pg_catalog.right(v_compact, 2);
end;
$$;
revoke all on function private.customer_portal_normalize_recovery_lookup(text)
  from public, anon, authenticated, service_role;

create or replace function private.customer_portal_safe_contact_mask(
  p_channel text,
  p_mask text
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_mask is not null
    and p_mask = pg_catalog.btrim(p_mask)
    and pg_catalog.length(p_mask) between 3 and 200
    and not private.customer_portal_forbidden_unicode(p_mask)
    and case p_channel
      when 'sms' then p_mask ~ '^(07[0-9]|\+[0-9]{2}) ••• •• [0-9]{2}$'
      when 'email' then p_mask ~ '^[^@[:space:]•]•••@[^@[:space:]•]+\.[^@[:space:]•]+$'
      else false
    end
$$;
revoke all on function private.customer_portal_safe_contact_mask(text, text)
  from public, anon, authenticated, service_role;

-- Active contact-change proofs last only ten minutes. Revoke any deployment-
-- crossing flow so an old mask cannot strand the user halfway through.
update private.customer_portal_contact_change_flows
set revoked_at = statement_timestamp(),
    new_destination = null,
    updated_at = statement_timestamp()
where completed_at is null
  and revoked_at is null;

create or replace function private.guard_iana_timezone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_timezone text := pg_catalog.to_jsonb(new) ->> tg_argv[0];
begin
  if v_timezone is null or not exists (
    select 1
    from pg_catalog.pg_timezone_names zone
    where zone.name = v_timezone
      and zone.name not like 'posix/%'
      and zone.name not like 'right/%'
      and zone.name <> 'Factory'
  ) then
    raise exception 'invalid_iana_timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_iana_timezone()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_tenant_settings_default_timezone_iana
  on public.tenant_settings;
create trigger trg_tenant_settings_default_timezone_iana
  before insert or update of default_timezone on public.tenant_settings
  for each row execute function private.guard_iana_timezone('default_timezone');

drop trigger if exists trg_locations_timezone_iana on public.locations;
create trigger trg_locations_timezone_iana
  before insert or update of timezone on public.locations
  for each row execute function private.guard_iana_timezone('timezone');

create or replace function private.guard_tenant_settings_active_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.assert_active_tenant_mutation(new.tenant_id);
  elsif tg_op = 'DELETE' then
    -- A parent tenant row is already gone when its FK cascade reaches here.
    -- Direct deletes still see the parent and must pass the lifecycle guard.
    if not exists (
      select 1 from public.tenants tenant where tenant.id = old.tenant_id
    ) then
      return old;
    end if;
    perform private.assert_active_tenant_mutation(old.tenant_id);
  else
    perform private.assert_active_tenant_mutation(old.tenant_id);
    if new.tenant_id is distinct from old.tenant_id then
      perform private.assert_active_tenant_mutation(new.tenant_id);
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.guard_tenant_settings_active_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_tenant_settings_active_mutation
  on public.tenant_settings;
create trigger trg_tenant_settings_active_mutation
  before insert or update or delete on public.tenant_settings
  for each row execute function private.guard_tenant_settings_active_mutation();

-- Storefront and customer portal need only the four regional fields. Existing
-- row-level public-read policy still limits them to active tenants.
grant select (
  country_code, locale, currency, default_timezone
) on table public.tenant_settings to anon;

-- Keep the small 0122 service-only wrapper and replace only its regional seam.
create or replace function public.customer_portal_session_snapshot(
  p_session_public_id uuid,
  p_secret_digest text,
  p_rotated_secret_digest text default null,
  p_rotated_key_version integer default null
) returns table (outcome text, snapshot jsonb, recovery_tenant_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_result record;
  v_origin text;
  v_snapshot jsonb;
  v_country_code text;
  v_locale text;
  v_currency text;
  v_timezone text;
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, statement_timestamp()
  );

  select * into v_result
  from private.customer_portal_session_snapshot(
    p_session_public_id,
    p_secret_digest,
    p_rotated_secret_digest,
    p_rotated_key_version
  );

  v_snapshot := v_result.snapshot;
  if v_result.outcome = 'ok' and v_snapshot is not null and v_session.tenant_id is not null then
    v_origin := private.customer_portal_booking_origin(v_session.tenant_id);
    select
      ts.country_code,
      ts.locale,
      ts.currency,
      coalesce(location_timezone.timezone, ts.default_timezone)
    into v_country_code, v_locale, v_currency, v_timezone
    from public.tenant_settings ts
    left join lateral (
      select l.timezone
      from public.locations l
      where l.tenant_id = ts.tenant_id
        and l.is_primary = true
        and l.active = true
      order by l.created_at, l.id
      limit 1
    ) location_timezone on true
    where ts.tenant_id = v_session.tenant_id;

    v_snapshot := v_snapshot || pg_catalog.jsonb_build_object(
      'bookingOrigin', v_origin,
      'defaultCountry', v_country_code,
      'locale', v_locale,
      'currency', v_currency,
      'timezone', v_timezone
    );
  end if;

  return query select v_result.outcome, v_snapshot, v_result.recovery_tenant_slug;
end;
$$;

revoke all on function public.customer_portal_session_snapshot(
  uuid, text, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.customer_portal_session_snapshot(
  uuid, text, text, integer
) to service_role;

commit;
