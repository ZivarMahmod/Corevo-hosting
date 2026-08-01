-- Goal 92 offert: DB-owned FSM/CAS/audit and truthful durable reply delivery.
-- Every fixture and mutation is rolled back.
begin;

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

do $$
begin
  if to_regprocedure(
       'public.update_offert_request(uuid,uuid,bigint,text,text,integer)'
     ) is null
     or to_regprocedure(
       'public.delete_offert_request(uuid,uuid,bigint)'
     ) is null
     or to_regprocedure(
       'public.enqueue_offert_reply(uuid,uuid,bigint,text)'
     ) is null
     or to_regprocedure(
       'public.finalize_offert_reply(uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.offert_reply_delivery_target(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'private.offert_transition_allowed(text,text)'
     ) is null then
    raise exception 'goal92_offert_fsm_missing';
  end if;

  if has_table_privilege('authenticated', 'public.offert_requests', 'update')
     or has_table_privilege('authenticated', 'public.offert_requests', 'delete')
     or not has_table_privilege('authenticated', 'public.offert_requests', 'select')
     or not has_table_privilege('service_role', 'public.offert_requests', 'insert')
     or has_table_privilege('anon', 'public.offert_requests', 'insert') then
    raise exception 'goal92_offert_grants_invalid';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.update_offert_request(uuid,uuid,bigint,text,text,integer)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.delete_offert_request(uuid,uuid,bigint)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.enqueue_offert_reply(uuid,uuid,bigint,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.finalize_offert_reply(uuid,uuid,uuid)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.finalize_offert_reply(uuid,uuid,uuid)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.offert_reply_delivery_target(uuid,uuid)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.offert_reply_delivery_target(uuid,uuid)',
       'execute'
     ) then
    raise exception 'goal92_offert_rpc_grants_invalid';
  end if;
end
$$;

-- Prove every status pair against the canonical transition matrix.
do $$
declare
  v_from text;
  v_to text;
  v_expected boolean;
  v_statuses constant text[] := array[
    'new', 'reviewing', 'quoted', 'accepted', 'declined', 'closed'
  ]::text[];
begin
  foreach v_from in array v_statuses loop
    foreach v_to in array v_statuses loop
      v_expected := v_from = v_to or
        (v_from = 'new' and v_to in ('reviewing', 'quoted', 'declined', 'closed')) or
        (v_from = 'reviewing' and v_to in ('quoted', 'declined', 'closed')) or
        (v_from = 'quoted' and v_to in ('accepted', 'declined', 'closed')) or
        (v_from in ('accepted', 'declined') and v_to = 'closed');
      if private.offert_transition_allowed(v_from, v_to) is distinct from v_expected then
        raise exception 'offert_transition_matrix_invalid:%:%', v_from, v_to;
      end if;
    end loop;
  end loop;
end
$$;

alter table public.tenants disable trigger trg_tenant_launch_readiness;
insert into public.tenants (id, slug, name, status) values
  ('92220000-0000-0000-0000-000000000001', 'goal92-offert-a', 'Goal 92 Offert A', 'active'),
  ('92220000-0000-0000-0000-000000000002', 'goal92-offert-b', 'Goal 92 Offert B', 'active');
alter table public.tenants enable trigger trg_tenant_launch_readiness;

insert into public.roles (id, tenant_id, name, level) values
  ('92220000-0000-0000-0000-000000000011', '92220000-0000-0000-0000-000000000001', 'owner', 6),
  ('92220000-0000-0000-0000-000000000012', '92220000-0000-0000-0000-000000000001', 'staff', 3),
  ('92220000-0000-0000-0000-000000000013', '92220000-0000-0000-0000-000000000002', 'owner', 6);

insert into auth.users (id, email) values
  ('92220000-0000-0000-0000-000000000021', 'goal92-offert-owner-a@example.test'),
  ('92220000-0000-0000-0000-000000000022', 'goal92-offert-staff-a@example.test'),
  ('92220000-0000-0000-0000-000000000023', 'goal92-offert-owner-b@example.test');

insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
  (
    '92220000-0000-0000-0000-000000000021',
    '92220000-0000-0000-0000-000000000001',
    'goal92-offert-owner-a@example.test',
    '92220000-0000-0000-0000-000000000011',
    'organization',
    'active'
  ),
  (
    '92220000-0000-0000-0000-000000000022',
    '92220000-0000-0000-0000-000000000001',
    'goal92-offert-staff-a@example.test',
    '92220000-0000-0000-0000-000000000012',
    'organization',
    'active'
  ),
  (
    '92220000-0000-0000-0000-000000000023',
    '92220000-0000-0000-0000-000000000002',
    'goal92-offert-owner-b@example.test',
    '92220000-0000-0000-0000-000000000013',
    'organization',
    'active'
  );

alter table public.staff disable trigger trg_staff_activation_readiness;
insert into public.staff (id, tenant_id, profile_id, active) values (
  '92220000-0000-0000-0000-000000000031',
  '92220000-0000-0000-0000-000000000001',
  '92220000-0000-0000-0000-000000000022',
  true
);
alter table public.staff enable trigger trg_staff_activation_readiness;

alter table public.tenant_modules disable trigger trg_tenant_modules_state_guard;
insert into public.tenant_modules (tenant_id, module_key, state, config) values
  ('92220000-0000-0000-0000-000000000001', 'offert', 'live', '{}'::jsonb),
  ('92220000-0000-0000-0000-000000000002', 'offert', 'live', '{}'::jsonb)
on conflict (tenant_id, module_key) do update
set state = excluded.state, config = excluded.config;
alter table public.tenant_modules enable trigger trg_tenant_modules_state_guard;

insert into public.offert_requests (
  id, tenant_id, customer_name, customer_email, subject, status, payment_status
) values
  (
    '92220000-0000-0000-0000-000000000101',
    '92220000-0000-0000-0000-000000000001',
    'FSM', 'fsm@example.test', 'FSM', 'new', 'unpaid'
  ),
  (
    '92220000-0000-0000-0000-000000000102',
    '92220000-0000-0000-0000-000000000002',
    'Cross tenant', 'cross@example.test', 'Cross tenant', 'new', 'unpaid'
  ),
  (
    '92220000-0000-0000-0000-000000000103',
    '92220000-0000-0000-0000-000000000001',
    'Reply sent', 'sent@example.test', 'Reply sent', 'new', 'unpaid'
  ),
  (
    '92220000-0000-0000-0000-000000000104',
    '92220000-0000-0000-0000-000000000001',
    'Reply failed', 'failed@example.test', 'Reply failed', 'new', 'unpaid'
  ),
  (
    '92220000-0000-0000-0000-000000000105',
    '92220000-0000-0000-0000-000000000001',
    'Delete', 'delete@example.test', 'Delete', 'declined', 'unpaid'
  ),
  (
    '92220000-0000-0000-0000-000000000106',
    '92220000-0000-0000-0000-000000000001',
    'Protected', 'protected@example.test', 'Protected', 'accepted', 'unpaid'
  ),
  (
    '92220000-0000-0000-0000-000000000107',
    '92220000-0000-0000-0000-000000000001',
    'Simulated', 'simulated@example.test', 'Simulated', 'new', 'unpaid'
  ),
  (
    '92220000-0000-0000-0000-000000000108',
    '92220000-0000-0000-0000-000000000001',
    'Retry', 'retry@example.test', 'Retry', 'new', 'unpaid'
  );

-- Owner A: legal chain, idempotent no-op, stale CAS and exactly one audit/change.
select pg_catalog.set_config(
  'request.jwt.claim.sub', '92220000-0000-0000-0000-000000000021', true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"92220000-0000-0000-0000-000000000021","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_result record;
begin
  select * into v_result from public.update_offert_request(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000101',
    0, 'reviewing', 'Läser', 10000
  );
  if v_result.outcome <> 'changed'
     or v_result.offert_status <> 'reviewing'
     or v_result.version <> 1 then
    raise exception 'offert_first_transition_failed';
  end if;

  select * into v_result from public.update_offert_request(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000101',
    1, 'reviewing', 'Läser', 10000
  );
  if v_result.outcome <> 'unchanged' or v_result.version <> 1 then
    raise exception 'offert_idempotent_update_failed';
  end if;

  select * into v_result from public.update_offert_request(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000101',
    0, 'quoted', 'Stale', 20000
  );
  if v_result.outcome <> 'stale' or v_result.version <> 1 then
    raise exception 'offert_stale_cas_failed';
  end if;

  select * into v_result from public.update_offert_request(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000101',
    1, 'declined', 'Avböjd', 20000
  );
  select * into v_result from public.update_offert_request(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000101',
    2, 'closed', 'Stängd', 20000
  );
  if v_result.outcome <> 'changed'
     or v_result.offert_status <> 'closed'
     or v_result.version <> 3 then
    raise exception 'offert_legal_chain_failed';
  end if;

  begin
    perform public.update_offert_request(
      '92220000-0000-0000-0000-000000000001',
      '92220000-0000-0000-0000-000000000101',
      3, 'new', 'Ogiltig', 20000
    );
    raise exception 'offert_illegal_transition_succeeded';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'offert_status_transition_invalid' then raise; end if;
  end;

end
$$;

-- Direct writes cannot bypass the RPC-owned FSM/audit.
do $$
begin
  begin
    update public.offert_requests
       set status = 'new'
     where id = '92220000-0000-0000-0000-000000000101';
    raise exception 'offert_direct_update_succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.offert_requests
     where id = '92220000-0000-0000-0000-000000000105';
    raise exception 'offert_direct_delete_succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Tenant and role fences.
do $$
begin
  begin
    perform public.update_offert_request(
      '92220000-0000-0000-0000-000000000002',
      '92220000-0000-0000-0000-000000000102',
      0, 'reviewing', null, null
    );
    raise exception 'offert_cross_tenant_update_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'offert_access_denied' then raise; end if;
  end;
end
$$;

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);
do $$
begin
  if (
    select count(*) from public.audit_log
     where entity = 'offert_requests'
       and entity_id = '92220000-0000-0000-0000-000000000101'
  ) <> 3 then
    raise exception 'offert_audit_cardinality_invalid';
  end if;
end
$$;

select pg_catalog.set_config(
  'request.jwt.claim.sub', '92220000-0000-0000-0000-000000000022', true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"92220000-0000-0000-0000-000000000022","role":"authenticated"}',
  true
);
set local role authenticated;
do $$
begin
  begin
    perform public.update_offert_request(
      '92220000-0000-0000-0000-000000000001',
      '92220000-0000-0000-0000-000000000103',
      0, 'reviewing', null, null
    );
    raise exception 'offert_staff_update_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'offert_access_denied' then raise; end if;
  end;
end
$$;

-- Module state is enforced inside the same RPC boundary.
reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);
alter table public.tenant_modules disable trigger trg_tenant_modules_state_guard;
update public.tenant_modules
   set state = 'paused'
 where tenant_id = '92220000-0000-0000-0000-000000000001'
   and module_key = 'offert';
alter table public.tenant_modules enable trigger trg_tenant_modules_state_guard;

select pg_catalog.set_config(
  'request.jwt.claim.sub', '92220000-0000-0000-0000-000000000021', true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"92220000-0000-0000-0000-000000000021","role":"authenticated"}',
  true
);
set local role authenticated;
do $$
begin
  begin
    perform public.update_offert_request(
      '92220000-0000-0000-0000-000000000001',
      '92220000-0000-0000-0000-000000000103',
      0, 'reviewing', null, null
    );
    raise exception 'offert_paused_module_update_succeeded';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'offert_module_read_only' then raise; end if;
  end;
end
$$;

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);
alter table public.tenant_modules disable trigger trg_tenant_modules_state_guard;
update public.tenant_modules
   set state = 'live'
 where tenant_id = '92220000-0000-0000-0000-000000000001'
   and module_key = 'offert';
alter table public.tenant_modules enable trigger trg_tenant_modules_state_guard;

-- Owner queues replies. Same version+message reuses one row; different message is stale.
reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub', '92220000-0000-0000-0000-000000000021', true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"92220000-0000-0000-0000-000000000021","role":"authenticated"}',
  true
);
set local role authenticated;

create temporary table goal92_offert_outboxes (
  kind text primary key,
  outbox_id uuid not null,
  lease_token uuid not null
) on commit drop;
grant select on goal92_offert_outboxes to service_role;

do $$
declare
  v_first record;
  v_retry record;
  v_count bigint;
begin
  begin
    perform public.update_offert_request(
      '92220000-0000-0000-0000-000000000001',
      '92220000-0000-0000-0000-000000000103',
      0, 'quoted', null, null
    );
    raise exception 'offert_direct_quote_without_delivery_succeeded';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'offert_quote_delivery_required' then raise; end if;
  end;

  select * into v_first from public.enqueue_offert_reply(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000103',
    0,
    'Tack för din förfrågan. Här är offerten.'
  );
  if v_first.outcome <> 'queued'
     or v_first.version <> 1
     or v_first.delivery_state <> 'pending'
     or v_first.outbox_id is null then
    raise exception 'offert_reply_enqueue_failed';
  end if;
  insert into goal92_offert_outboxes values
    ('sent', v_first.outbox_id, '92220000-0000-0000-0000-000000000201');

  select * into v_retry from public.enqueue_offert_reply(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000103',
    0,
    'Tack för din förfrågan. Här är offerten.'
  );
  if v_retry.outcome <> 'existing'
     or v_retry.outbox_id <> v_first.outbox_id
     or v_retry.version <> 1 then
    raise exception 'offert_reply_retry_not_idempotent';
  end if;

  select count(*) into v_count
    from public.notifications_outbox o
   where o.tenant_id = '92220000-0000-0000-0000-000000000001'
     and o.event_type = 'offert_reply'
     and o.payload = pg_catalog.jsonb_build_object(
       'offert_request_id', '92220000-0000-0000-0000-000000000103'::uuid
     )
     and not (o.payload ? 'customer_email');
  if v_count <> 1 then
    raise exception 'offert_reply_outbox_payload_or_cardinality_invalid';
  end if;

  select * into v_retry from public.enqueue_offert_reply(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000103',
    0,
    'Ett annat svar'
  );
  if v_retry.outcome <> 'stale' or v_retry.version <> 1 then
    raise exception 'offert_reply_different_message_not_stale';
  end if;

  if not exists (
    select 1 from public.offert_requests q
     where q.id = '92220000-0000-0000-0000-000000000103'
       and q.status = 'new'
       and q.reply_message is null
       and q.replied_at is null
       and q.reply_delivery_state = 'pending'
       and q.reply_pending_message = 'Tack för din förfrågan. Här är offerten.'
  ) then
    raise exception 'offert_reply_marked_sent_before_delivery';
  end if;
end
$$;

-- Prepare failed/simulated/retry outboxes while still authenticated.
do $$
declare
  v_result record;
begin
  select * into v_result from public.enqueue_offert_reply(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000104',
    0, 'Detta ska misslyckas.'
  );
  insert into goal92_offert_outboxes values
    ('failed', v_result.outbox_id, '92220000-0000-0000-0000-000000000202');

  select * into v_result from public.enqueue_offert_reply(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000107',
    0, 'Detta simuleras.'
  );
  insert into goal92_offert_outboxes values
    ('simulated', v_result.outbox_id, '92220000-0000-0000-0000-000000000203');

  select * into v_result from public.enqueue_offert_reply(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000108',
    0, 'Detta ska försöka igen.'
  );
  insert into goal92_offert_outboxes values
    ('retry', v_result.outbox_id, '92220000-0000-0000-0000-000000000204');
end
$$;

-- The service worker claims/acks the exact linked rows, then DB-finalize decides truth.
reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"service_role"}', true
);
set local role service_role;

do $$
declare
  v_outbox uuid;
  v_lease uuid;
  v_result record;
begin
  select outbox_id, lease_token into v_outbox, v_lease
    from goal92_offert_outboxes where kind = 'sent';
  if not exists (
    select 1 from public.claim_notification_outbox_by_id(
      v_outbox, v_lease, pg_catalog.statement_timestamp(), 120
    )
  ) or not public.begin_notification_delivery(v_outbox, v_lease) then
    raise exception 'offert_sent_outbox_ack_failed';
  end if;
  if not exists (
    select 1
      from public.offert_reply_delivery_target(v_outbox, v_lease) t
     where t.outcome = 'target'
       and t.tenant_id = '92220000-0000-0000-0000-000000000001'
       and t.customer_email = 'sent@example.test'
       and t.reply_message = 'Tack för din förfrågan. Här är offerten.'
  ) then
    raise exception 'offert_delivery_target_not_exact';
  end if;
  if not public.ack_notification_outbox(
    v_outbox, v_lease, 'sent', 'email:goal92', null, null, 1, null
  ) then
    raise exception 'offert_sent_outbox_ack_failed';
  end if;

  select * into v_result from public.finalize_offert_reply(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000103',
    v_outbox
  );
  if v_result.outcome <> 'sent'
     or v_result.offert_status <> 'quoted'
     or v_result.version <> 2
     or v_result.delivery_state <> 'sent' then
    raise exception 'offert_sent_finalize_failed';
  end if;
  if not exists (
    select 1 from public.offert_requests q
     where q.id = '92220000-0000-0000-0000-000000000103'
       and q.status = 'quoted'
       and q.reply_message = 'Tack för din förfrågan. Här är offerten.'
       and q.replied_at is not null
       and q.reply_delivery_state = 'sent'
  ) then
    raise exception 'offert_sent_domain_state_invalid';
  end if;

  select * into v_result from public.finalize_offert_reply(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000103',
    v_outbox
  );
  if v_result.outcome <> 'already_sent' or v_result.version <> 2 then
    raise exception 'offert_finalize_retry_not_idempotent';
  end if;
  if (
    select count(*) from public.audit_log
     where entity = 'offert_requests'
       and entity_id = '92220000-0000-0000-0000-000000000103'
  ) <> 2 then
    raise exception 'offert_reply_audit_cardinality_invalid';
  end if;
end
$$;

do $$
declare
  v_outbox uuid;
  v_lease uuid;
  v_result record;
begin
  select outbox_id, lease_token into v_outbox, v_lease
    from goal92_offert_outboxes where kind = 'failed';
  perform public.claim_notification_outbox_by_id(
    v_outbox, v_lease, pg_catalog.statement_timestamp(), 120
  );
  perform public.begin_notification_delivery(v_outbox, v_lease);
  perform public.ack_notification_outbox(
    v_outbox, v_lease, 'failed', null, null, 'payload_invalid', null, null
  );
  select * into v_result from public.finalize_offert_reply(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000104',
    v_outbox
  );
  if v_result.outcome <> 'failed'
     or v_result.offert_status <> 'new'
     or v_result.delivery_state <> 'failed'
     or v_result.error_code <> 'payload_invalid' then
    raise exception 'offert_failed_finalize_invalid';
  end if;
  if not exists (
    select 1 from public.offert_requests q
     where q.id = '92220000-0000-0000-0000-000000000104'
       and q.status = 'new'
       and q.reply_message is null
       and q.replied_at is null
       and q.reply_pending_message = 'Detta ska misslyckas.'
  ) then
    raise exception 'offert_failed_reply_lied_or_lost_text';
  end if;
end
$$;

do $$
declare
  v_outbox uuid;
  v_lease uuid;
  v_result record;
begin
  select outbox_id, lease_token into v_outbox, v_lease
    from goal92_offert_outboxes where kind = 'simulated';
  perform public.claim_notification_outbox_by_id(
    v_outbox, v_lease, pg_catalog.statement_timestamp(), 120
  );
  perform public.begin_notification_delivery(v_outbox, v_lease);
  perform public.ack_notification_outbox(
    v_outbox, v_lease, 'simulated', null, null, null, 1, null
  );
  select * into v_result from public.finalize_offert_reply(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000107',
    v_outbox
  );
  if v_result.outcome <> 'failed'
     or v_result.offert_status <> 'new'
     or v_result.error_code <> 'simulated_not_delivered' then
    raise exception 'offert_simulated_presented_as_sent';
  end if;
end
$$;

do $$
declare
  v_outbox uuid;
  v_lease uuid;
  v_result record;
begin
  select outbox_id, lease_token into v_outbox, v_lease
    from goal92_offert_outboxes where kind = 'retry';
  perform public.claim_notification_outbox_by_id(
    v_outbox, v_lease, pg_catalog.statement_timestamp(), 120
  );
  perform public.begin_notification_delivery(v_outbox, v_lease);
  if public.retry_notification_outbox(
       v_outbox, v_lease, 'provider_unavailable',
       pg_catalog.statement_timestamp() + interval '1 minute'
     ) <> 'queued' then
    raise exception 'offert_retry_outbox_failed';
  end if;
  select * into v_result from public.finalize_offert_reply(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000108',
    v_outbox
  );
  if v_result.outcome <> 'pending'
     or v_result.offert_status <> 'new'
     or v_result.delivery_state <> 'pending' then
    raise exception 'offert_retry_presented_as_terminal';
  end if;
end
$$;

-- Delete is also CAS/RPC-owned and refuses accepted/paid business history.
reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub', '92220000-0000-0000-0000-000000000021', true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"92220000-0000-0000-0000-000000000021","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_result record;
begin
  select * into v_result from public.delete_offert_request(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000105',
    0
  );
  if v_result.outcome <> 'deleted'
     or v_result.version <> 1
     or exists (
       select 1 from public.offert_requests
        where id = '92220000-0000-0000-0000-000000000105'
     ) then
    raise exception 'offert_delete_rpc_invalid';
  end if;

  select * into v_result from public.delete_offert_request(
    '92220000-0000-0000-0000-000000000001',
    '92220000-0000-0000-0000-000000000106',
    0
  );
  if v_result.outcome <> 'protected'
     or not exists (
       select 1 from public.offert_requests
        where id = '92220000-0000-0000-0000-000000000106'
     ) then
    raise exception 'offert_delete_protection_invalid';
  end if;
end
$$;

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

do $$
begin
  if (
    select count(*) from public.audit_log
     where entity = 'offert_requests'
       and entity_id = '92220000-0000-0000-0000-000000000105'
  ) <> 1 then
    raise exception 'offert_delete_audit_cardinality_invalid';
  end if;
end
$$;

select 'goal92_offert_fsm_ok' as result;
rollback;
