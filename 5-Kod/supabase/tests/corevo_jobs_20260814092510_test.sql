-- PGMQ V1: durable logged queue, private review ledger and service-only RPCs.

begin;

do $$
declare
  v_queue record;
begin
  select * into strict v_queue
    from pgmq.list_queues() q
   where q.queue_name = 'corevo_jobs';
  if v_queue.is_unlogged then
    raise exception 'corevo_jobs_must_be_logged';
  end if;
  if pg_catalog.to_regnamespace('pgmq_public') is not null then
    raise exception 'pgmq_public_must_not_be_exposed';
  end if;
end
$$;

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.enqueue_corevo_job(jsonb)',
    'public.read_corevo_jobs()',
    'public.archive_corevo_job(bigint)',
    'public.fail_corevo_job_for_review(bigint,text)'
  ] loop
    if pg_catalog.has_function_privilege('anon', v_signature, 'execute')
       or pg_catalog.has_function_privilege('authenticated', v_signature, 'execute') then
      raise exception 'corevo_job_rpc_exposed_%', v_signature;
    end if;
    if not pg_catalog.has_function_privilege('service_role', v_signature, 'execute') then
      raise exception 'corevo_job_service_grant_missing_%', v_signature;
    end if;
  end loop;

  if pg_catalog.has_table_privilege(
       'service_role', 'private.corevo_job_failed_review', 'select'
     ) or pg_catalog.has_table_privilege(
       'authenticated', 'pgmq.q_corevo_jobs', 'select'
     ) then
    raise exception 'corevo_job_table_exposed';
  end if;
end
$$;

do $$
declare
  v_id bigint;
  v_read record;
  v_visible integer;
begin
  v_id := public.enqueue_corevo_job(pg_catalog.jsonb_build_object(
    'v', 1,
    'type', 'stripe.billing.reconcile',
    'eventId', 'evt_queue_test',
    'objectId', 'in_queue_test'
  ));

  select * into strict v_read from public.read_corevo_jobs();
  if v_read.msg_id <> v_id or v_read.read_ct <> 1
     or v_read.message ->> 'eventId' <> 'evt_queue_test' then
    raise exception 'corevo_job_read_contract_failed';
  end if;

  select count(*) into v_visible from public.read_corevo_jobs();
  if v_visible <> 0 then
    raise exception 'corevo_job_visibility_failed';
  end if;

  if public.archive_corevo_job(v_id) is not true then
    raise exception 'corevo_job_archive_failed';
  end if;
end
$$;

do $$
begin
  begin
    perform public.enqueue_corevo_job('{"v":1,"type":"stripe.billing.reconcile","eventId":"evt","objectId":"in","tenantId":"forbidden"}'::jsonb);
    raise exception 'corevo_job_extra_payload_accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.enqueue_corevo_job(null);
    raise exception 'corevo_job_null_payload_accepted';
  exception when invalid_parameter_value then null;
  end;
end
$$;

do $$
declare
  v_id bigint;
  v_read record;
begin
  select sent.msg_id into strict v_id
    from pgmq.send(
      'corevo_jobs',
      '{"v":2,"type":"future.job","eventId":"evt_future","objectId":"obj_future"}'::jsonb,
      0
    ) as sent(msg_id);
  select * into strict v_read from public.read_corevo_jobs();
  if v_read.msg_id <> v_id then
    raise exception 'corevo_job_unknown_read_failed';
  end if;
  perform public.fail_corevo_job_for_review(v_id, 'unknown_version');

  if exists (select 1 from pgmq.q_corevo_jobs where msg_id = v_id)
     or not exists (select 1 from pgmq.a_corevo_jobs where msg_id = v_id)
     or not exists (
       select 1 from private.corevo_job_failed_review
        where msg_id = v_id and reason = 'unknown_version'
     ) then
    raise exception 'corevo_job_failed_review_not_atomic';
  end if;
end
$$;

rollback;
