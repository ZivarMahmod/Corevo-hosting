-- 0122 — Tenant-bound public booking origin for passwordless customer portal.
-- The 0120 read model remains intact in private; public wrappers harden only
-- booking-origin projection while preserving RPC signatures and pagination.

create or replace function private.customer_portal_booking_origin(p_tenant uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_domain text;
begin
  select t.slug into v_slug
  from public.tenants t
  where t.id = p_tenant and t.status = 'active';

  if v_slug is null then return null; end if;

  select d.domain into v_domain
  from public.tenant_domains d
  where d.tenant_id = p_tenant
    and d.verified
    and d.domain = lower(d.domain)
    and length(d.domain) between 4 and 253
    and d.domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
    and d.domain !~ '(^|\.)(xn--|admin|internal|localhost|portal|sms)(\.|$)'
    and pg_catalog.strpos(d.domain, 'corevo') = 0
    and d.domain <> 'corevo.se'
    and d.domain !~ '\.corevo\.se$'
  order by d.is_primary desc, d.created_at, d.id
  limit 1;

  if v_domain is not null then return 'https://' || v_domain; end if;

  if v_slug = lower(v_slug)
     and length(v_slug) between 1 and 63
     and v_slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
     and v_slug !~ '^xn--'
     and v_slug not in (
       'booking', 'admin', 'app', 'www', 'api', 'superadmin', 'kiosk', 'dev',
       'odoo', 'superbooking', 'minbooking', 'boka', 'mina', 'internal',
       'localhost', 'portal', 'sms'
     ) then
    return 'https://' || v_slug || '.boka.corevo.se';
  end if;
  return null;
end;
$$;

revoke all on function private.customer_portal_booking_origin(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.customer_portal_rebook_url(
  p_tenant uuid,
  p_customer uuid,
  p_booking uuid
) returns text
language sql
stable
security definer
set search_path = ''
as $$
  with context as (
    select
      b.tenant_id,
      l.id as location_id,
      case
        when sv.id is not null
          and (sv.location_id is null or sv.location_id = l.id)
          then sv.id
        else null
      end as service_id
    from public.bookings b
    join public.tenants t
      on t.id = b.tenant_id and t.status = 'active'
    left join public.locations l
      on l.id = b.location_id
      and l.tenant_id = b.tenant_id
      and l.active
    left join public.services sv
      on sv.id = b.service_id
      and sv.tenant_id = b.tenant_id
      and sv.active
    where b.id = p_booking
      and b.tenant_id = p_tenant
      and b.customer_id = p_customer
    limit 1
  )
  select private.customer_portal_booking_origin(context.tenant_id)
    || '/boka'
    || case
      when context.location_id is not null and context.service_id is not null then
        '?plats=' || context.location_id::text || '&tjanst=' || context.service_id::text
      when context.location_id is not null then
        '?plats=' || context.location_id::text
      when context.service_id is not null then
        '?tjanst=' || context.service_id::text
      else ''
    end
  from context
$$;

revoke all on function private.customer_portal_rebook_url(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

alter function public.customer_portal_session_snapshot(uuid, text, text, integer)
  set schema private;
alter function public.customer_portal_list_bookings(uuid, text, text, timestamptz, uuid, integer)
  set schema private;
alter function public.customer_portal_get_booking(uuid, text, uuid)
  set schema private;

revoke all on function private.customer_portal_session_snapshot(uuid, text, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.customer_portal_list_bookings(uuid, text, text, timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.customer_portal_get_booking(uuid, text, uuid)
  from public, anon, authenticated, service_role;

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
    v_snapshot := pg_catalog.jsonb_set(
      v_snapshot,
      '{bookingOrigin}',
      coalesce(pg_catalog.to_jsonb(v_origin), 'null'::jsonb),
      true
    );
  end if;

  return query select v_result.outcome, v_snapshot, v_result.recovery_tenant_slug;
end;
$$;

create or replace function public.customer_portal_list_bookings(
  p_session_public_id uuid,
  p_secret_digest text,
  p_scope text default 'upcoming',
  p_cursor_start timestamptz default null,
  p_cursor_id uuid default null,
  p_page_size integer default 20
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_payload jsonb;
  v_origin text;
  v_items jsonb;
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, statement_timestamp()
  );

  v_payload := private.customer_portal_list_bookings(
    p_session_public_id,
    p_secret_digest,
    p_scope,
    p_cursor_start,
    p_cursor_id,
    p_page_size
  );

  if v_payload ->> 'outcome' <> 'ok' or v_session.tenant_id is null then
    return v_payload;
  end if;

  v_origin := private.customer_portal_booking_origin(v_session.tenant_id);
  select coalesce(
    pg_catalog.jsonb_agg(
      case
        when pg_catalog.jsonb_typeof(item.value -> 'publicRebookUrl') = 'string' then
          pg_catalog.jsonb_set(
            item.value,
            '{publicRebookUrl}',
            coalesce(
              pg_catalog.to_jsonb(private.customer_portal_rebook_url(
                v_session.tenant_id,
                v_session.customer_id,
                (item.value ->> 'id')::uuid
              )),
              'null'::jsonb
            ),
            true
          )
        else item.value
      end
      order by item.ordinality
    ),
    '[]'::jsonb
  ) into v_items
  from pg_catalog.jsonb_array_elements(v_payload -> 'items') with ordinality as item(value, ordinality);

  return pg_catalog.jsonb_set(v_payload, '{items}', v_items, true)
    || pg_catalog.jsonb_build_object(
      'tenantSlug', v_session.tenant_slug,
      'bookingOrigin', v_origin
    );
end;
$$;

create or replace function public.customer_portal_get_booking(
  p_session_public_id uuid,
  p_secret_digest text,
  p_booking_public_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_payload jsonb;
  v_origin text;
  v_booking jsonb;
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, statement_timestamp()
  );

  v_payload := private.customer_portal_get_booking(
    p_session_public_id,
    p_secret_digest,
    p_booking_public_id
  );

  if v_payload ->> 'outcome' <> 'ok' or v_session.tenant_id is null then
    return v_payload;
  end if;

  v_origin := private.customer_portal_booking_origin(v_session.tenant_id);
  v_booking := v_payload -> 'booking';
  if pg_catalog.jsonb_typeof(v_booking -> 'publicRebookUrl') = 'string' then
    v_booking := pg_catalog.jsonb_set(
      v_booking,
      '{publicRebookUrl}',
      coalesce(
        pg_catalog.to_jsonb(private.customer_portal_rebook_url(
          v_session.tenant_id,
          v_session.customer_id,
          p_booking_public_id
        )),
        'null'::jsonb
      ),
      true
    );
  end if;

  return pg_catalog.jsonb_set(v_payload, '{booking}', v_booking, true)
    || pg_catalog.jsonb_build_object(
      'tenantSlug', v_session.tenant_slug,
      'bookingOrigin', v_origin
    );
end;
$$;

revoke all on function public.customer_portal_session_snapshot(uuid, text, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.customer_portal_list_bookings(uuid, text, text, timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.customer_portal_get_booking(uuid, text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.customer_portal_session_snapshot(uuid, text, text, integer)
  to service_role;
grant execute on function public.customer_portal_list_bookings(uuid, text, text, timestamptz, uuid, integer)
  to service_role;
grant execute on function public.customer_portal_get_booking(uuid, text, uuid)
  to service_role;
