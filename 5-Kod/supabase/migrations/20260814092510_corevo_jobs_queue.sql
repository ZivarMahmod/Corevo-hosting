-- Durable generic jobs. Queue access stays behind four service-role-only RPCs;
-- pgmq_public is deliberately not created or exposed.

begin;

create extension if not exists pgmq;

do $$
begin
  if not exists (
    select 1 from pgmq.list_queues() q where q.queue_name = 'corevo_jobs'
  ) then
    perform pgmq.create('corevo_jobs');
  end if;
end
$$;

revoke all on table pgmq.q_corevo_jobs, pgmq.a_corevo_jobs
  from public, anon, authenticated, service_role;

create table private.corevo_job_failed_review (
  msg_id bigint primary key,
  read_ct bigint not null check (read_ct > 0),
  payload jsonb not null,
  reason text not null check (
    reason in ('invalid_payload', 'unknown_version', 'unknown_type', 'max_attempts')
  ),
  failed_at timestamptz not null default pg_catalog.clock_timestamp()
);

alter table private.corevo_job_failed_review enable row level security;
revoke all on table private.corevo_job_failed_review from public, anon, authenticated, service_role;

create or replace function public.enqueue_corevo_job(p_job jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg_id bigint;
begin
  if p_job is null
     or pg_catalog.jsonb_typeof(p_job) <> 'object'
     or pg_catalog.jsonb_typeof(p_job -> 'v') <> 'number'
     or p_job ->> 'v' <> '1'
     or p_job ->> 'type' <> 'stripe.billing.reconcile'
     or pg_catalog.jsonb_typeof(p_job -> 'eventId') <> 'string'
     or pg_catalog.length(pg_catalog.btrim(p_job ->> 'eventId')) not between 1 and 255
     or pg_catalog.jsonb_typeof(p_job -> 'objectId') <> 'string'
     or pg_catalog.length(pg_catalog.btrim(p_job ->> 'objectId')) not between 1 and 255
     or p_job - array['v', 'type', 'eventId', 'objectId']::text[] <> '{}'::jsonb then
    raise exception 'corevo_job_invalid' using errcode = '22023';
  end if;

  select sent.msg_id into strict v_msg_id
    from pgmq.send('corevo_jobs', p_job, 0) as sent(msg_id);
  return v_msg_id;
end;
$$;

create or replace function public.read_corevo_jobs()
returns table (
  msg_id bigint,
  read_ct bigint,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language sql
security definer
set search_path = ''
as $$
  select job.msg_id, job.read_ct, job.enqueued_at, job.vt, job.message
    from pgmq.read('corevo_jobs', 120, 10) job;
$$;

create or replace function public.archive_corevo_job(p_msg_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_msg_id is null or p_msg_id <= 0 then
    raise exception 'corevo_job_id_invalid' using errcode = '22023';
  end if;
  return pgmq.archive('corevo_jobs', p_msg_id);
end;
$$;

create or replace function public.fail_corevo_job_for_review(
  p_msg_id bigint,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archived boolean;
  v_inserted integer;
begin
  if p_msg_id is null or p_msg_id <= 0
     or p_reason not in ('invalid_payload', 'unknown_version', 'unknown_type', 'max_attempts') then
    raise exception 'corevo_job_review_invalid' using errcode = '22023';
  end if;

  insert into private.corevo_job_failed_review (msg_id, read_ct, payload, reason)
  select job.msg_id, job.read_ct, job.message, p_reason
    from pgmq.q_corevo_jobs job
   where job.msg_id = p_msg_id
  on conflict (msg_id) do update
    set read_ct = excluded.read_ct,
        payload = excluded.payload,
        reason = excluded.reason,
        failed_at = pg_catalog.clock_timestamp();

  get diagnostics v_inserted = row_count;
  if v_inserted <> 1 then
    raise exception 'corevo_job_not_found' using errcode = 'P0002';
  end if;

  select pgmq.archive('corevo_jobs', p_msg_id) into v_archived;
  if v_archived is not true then
    raise exception 'corevo_job_archive_failed' using errcode = '55000';
  end if;
  return true;
end;
$$;

revoke all on function public.enqueue_corevo_job(jsonb) from public, anon, authenticated;
revoke all on function public.read_corevo_jobs() from public, anon, authenticated;
revoke all on function public.archive_corevo_job(bigint) from public, anon, authenticated;
revoke all on function public.fail_corevo_job_for_review(bigint, text)
  from public, anon, authenticated;

grant execute on function public.enqueue_corevo_job(jsonb) to service_role;
grant execute on function public.read_corevo_jobs() to service_role;
grant execute on function public.archive_corevo_job(bigint) to service_role;
grant execute on function public.fail_corevo_job_for_review(bigint, text) to service_role;

commit;
