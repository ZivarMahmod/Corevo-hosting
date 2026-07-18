-- 0102 — durable heartbeat for the platform-owned reminder scheduler.
-- The scheduler queues reminder domain events through the existing application
-- route. It never calls a transport, and GitHub may overlap during rollout because
-- 0088's claim lease + 0100's stable event identity own idempotence.

begin;

create table if not exists private.scheduler_heartbeats (
  scheduler_name text primary key,
  last_run_id uuid not null,
  last_status text not null
    check (last_status in ('started', 'succeeded', 'failed')),
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null,
  check (scheduler_name in ('cloudflare-reminders-primary')),
  check (last_error_code is null or last_error_code in ('route_failed', 'scheduler_failed'))
);

alter table private.scheduler_heartbeats enable row level security;
revoke all on table private.scheduler_heartbeats from public, anon, authenticated;

create or replace function public.record_scheduler_heartbeat(
  p_scheduler_name text,
  p_run_id uuid,
  p_phase text,
  p_error_code text,
  p_observed_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := coalesce(p_observed_at, pg_catalog.clock_timestamp());
begin
  if p_scheduler_name <> 'cloudflare-reminders-primary'
     or p_run_id is null
     or p_phase not in ('started', 'succeeded', 'failed')
     or (p_phase = 'failed' and p_error_code not in ('route_failed', 'scheduler_failed'))
     or (p_phase <> 'failed' and p_error_code is not null)
     or v_at > pg_catalog.clock_timestamp() + interval '5 minutes'
     or v_at < pg_catalog.clock_timestamp() - interval '1 day' then
    raise exception 'scheduler_heartbeat_invalid' using errcode = '22023';
  end if;

  insert into private.scheduler_heartbeats (
    scheduler_name, last_run_id, last_status,
    last_started_at, last_succeeded_at, last_failed_at,
    last_error_code, updated_at
  ) values (
    p_scheduler_name, p_run_id, p_phase,
    case when p_phase = 'started' then v_at end,
    case when p_phase = 'succeeded' then v_at end,
    case when p_phase = 'failed' then v_at end,
    case when p_phase = 'failed' then p_error_code end,
    v_at
  )
  on conflict (scheduler_name) do update
    set last_run_id = excluded.last_run_id,
        last_status = excluded.last_status,
        last_started_at = case
          when excluded.last_status = 'started' then excluded.updated_at
          else private.scheduler_heartbeats.last_started_at
        end,
        last_succeeded_at = case
          when excluded.last_status = 'succeeded' then excluded.updated_at
          else private.scheduler_heartbeats.last_succeeded_at
        end,
        last_failed_at = case
          when excluded.last_status = 'failed' then excluded.updated_at
          else private.scheduler_heartbeats.last_failed_at
        end,
        last_error_code = case
          when excluded.last_status = 'failed' then excluded.last_error_code
          when excluded.last_status = 'succeeded' then null
          else private.scheduler_heartbeats.last_error_code
        end,
        updated_at = excluded.updated_at;
  return true;
end;
$$;

create or replace function public.get_scheduler_health(
  p_scheduler_name text,
  p_now timestamptz,
  p_max_age_seconds integer default 2100
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.scheduler_heartbeats%rowtype;
  v_now timestamptz := coalesce(p_now, pg_catalog.clock_timestamp());
  v_age numeric;
  v_healthy boolean;
begin
  if p_scheduler_name <> 'cloudflare-reminders-primary'
     or p_max_age_seconds not between 300 and 7200 then
    raise exception 'scheduler_health_invalid' using errcode = '22023';
  end if;

  select h.* into v_row
    from private.scheduler_heartbeats h
   where h.scheduler_name = p_scheduler_name;
  if not found or v_row.last_succeeded_at is null then
    return pg_catalog.jsonb_build_object(
      'healthy', false, 'status', 'missing', 'age_seconds', null
    );
  end if;

  v_age := greatest(
    0,
    pg_catalog.date_part('epoch', v_now - v_row.last_succeeded_at)
  );
  v_healthy := v_age <= p_max_age_seconds
    and (v_row.last_failed_at is null or v_row.last_failed_at <= v_row.last_succeeded_at);
  return pg_catalog.jsonb_build_object(
    'healthy', v_healthy,
    'status', v_row.last_status,
    'age_seconds', pg_catalog.floor(v_age)::integer
  );
end;
$$;

revoke all on function public.record_scheduler_heartbeat(
  text, uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_scheduler_heartbeat(
  text, uuid, text, text, timestamptz
) to service_role;

revoke all on function public.get_scheduler_health(
  text, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.get_scheduler_health(
  text, timestamptz, integer
) to service_role;

commit;
