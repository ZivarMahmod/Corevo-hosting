-- goal-72 etapp 1b: håll driftläsningen bounded till aktiv kö + senaste dygnets
-- fel och matcha schedulerns kanoniska hälsodefinition från migration 0102.

create index if not exists notifications_outbox_drift_active_global_idx
  on public.notifications_outbox (status, updated_at, available_at, lease_expires_at)
  where status in ('routing', 'queued', 'attempting', 'delivery_started', 'failed');

create index if not exists notifications_outbox_drift_active_tenant_idx
  on public.notifications_outbox (tenant_id, status, updated_at, available_at, lease_expires_at)
  where status in ('routing', 'queued', 'attempting', 'delivery_started', 'failed');

create or replace function public.platform_drift_health(
  p_tenant uuid default null
)
returns table (
  tenant_id uuid,
  routing_count bigint,
  queued_count bigint,
  attempting_count bigint,
  delivery_started_count bigint,
  stalled_count bigint,
  failed_24h_count bigint,
  oldest_ready_at timestamptz,
  scheduler_name text,
  scheduler_last_status text,
  scheduler_last_started_at timestamptz,
  scheduler_last_succeeded_at timestamptz,
  scheduler_last_failed_at timestamptz,
  scheduler_last_error_code text,
  scheduler_updated_at timestamptz,
  scheduler_age_seconds integer,
  scheduler_healthy boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_platform_admin()) then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;

  if p_tenant is not null and not exists (
    select 1 from public.tenants t
    where t.id = p_tenant and t.status <> 'deleted'
  ) then
    raise exception 'platform_drift_tenant_invalid' using errcode = '22023';
  end if;

  return query
  with queue as (
    select
      count(*) filter (where o.status = 'routing')::bigint as routing_count,
      count(*) filter (where o.status = 'queued')::bigint as queued_count,
      count(*) filter (where o.status = 'attempting')::bigint as attempting_count,
      count(*) filter (where o.status = 'delivery_started')::bigint as delivery_started_count,
      count(*) filter (
        where (o.status = 'routing' and o.updated_at <= now() - interval '15 minutes')
           or (o.status = 'attempting' and (o.lease_expires_at is null or o.lease_expires_at <= now()))
           or (o.status = 'delivery_started' and o.updated_at <= now() - interval '15 minutes')
      )::bigint as stalled_count,
      count(*) filter (where o.status = 'failed')::bigint as failed_24h_count,
      min(o.available_at) filter (
        where o.status = 'queued' and o.available_at <= now()
      ) as oldest_ready_at
    from public.notifications_outbox o
    where (p_tenant is null or o.tenant_id = p_tenant)
      and (
        o.status in ('routing', 'queued', 'attempting', 'delivery_started')
        or (o.status = 'failed' and o.updated_at > now() - interval '24 hours')
      )
  ), heartbeat as (
    select h.*
    from private.scheduler_heartbeats h
    where h.scheduler_name = 'cloudflare-reminders-primary'
    limit 1
  )
  select
    p_tenant,
    q.routing_count,
    q.queued_count,
    q.attempting_count,
    q.delivery_started_count,
    q.stalled_count,
    q.failed_24h_count,
    q.oldest_ready_at,
    h.scheduler_name,
    h.last_status,
    h.last_started_at,
    h.last_succeeded_at,
    h.last_failed_at,
    h.last_error_code,
    h.updated_at,
    case when h.last_succeeded_at is null then null else
      greatest(0, floor(extract(epoch from (now() - h.last_succeeded_at))))::integer
    end,
    coalesce(
      h.last_succeeded_at >= now() - interval '35 minutes'
      and (h.last_failed_at is null or h.last_failed_at <= h.last_succeeded_at),
      false
    )
  from queue q
  left join heartbeat h on true;
end;
$$;

revoke all on function public.platform_drift_health(uuid) from public, anon;
grant execute on function public.platform_drift_health(uuid) to authenticated, service_role;
