-- 0054: DB-side aggregates (goal-56 A1/A2/A5).
-- PostgREST aggregate functions are disabled on the project (PGRST123), so the
-- unbounded row-reads in platform surfaces move into three SQL functions instead.
-- SECURITY INVOKER (default): RLS applies — platform_admin reads cross-tenant via
-- its bypass, salon_admin stays fenced to private.tenant_id().

create or replace function public.platform_booking_stats()
returns table (tenant_id uuid, total bigint, completed bigint, last_at timestamptz)
language sql stable
as $$
  select b.tenant_id,
         count(*),
         count(*) filter (where b.status = 'completed'),
         max(b.created_at)
  from public.bookings b
  group by b.tenant_id
$$;

create or replace function public.service_booking_counts(p_tenant uuid)
returns table (service_id uuid, cnt bigint)
language sql stable
as $$
  select b.service_id, count(*)
  from public.bookings b
  where b.tenant_id = p_tenant and b.service_id is not null
  group by b.service_id
$$;

create or replace function public.tenant_storage_usage(p_tenant uuid)
returns bigint
language sql stable
as $$
  select coalesce(sum(m.size_bytes), 0)::bigint
  from public.media_assets m
  where m.tenant_id = p_tenant
$$;

grant execute on function public.platform_booking_stats() to authenticated;
grant execute on function public.service_booking_counts(uuid) to authenticated;
grant execute on function public.tenant_storage_usage(uuid) to authenticated;
