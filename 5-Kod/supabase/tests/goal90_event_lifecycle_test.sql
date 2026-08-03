-- Goal 90 runtime: idempotent intake, locked lifecycle, capacity, audit/outbox
-- and paid-cancellation fail-closed. All fixtures are rolled back.
begin;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

alter table public.tenants disable trigger trg_tenant_launch_readiness;
insert into public.tenants (id, slug, name, status) values
  ('90900000-0000-0000-0000-000000000001', 'goal90-event-a', 'Goal 90 Event A', 'active'),
  ('90900000-0000-0000-0000-000000000002', 'goal90-event-b', 'Goal 90 Event B', 'active');
alter table public.tenants enable trigger trg_tenant_launch_readiness;

insert into public.roles (id, tenant_id, name, level) values
  ('90900000-0000-0000-0000-000000000011', '90900000-0000-0000-0000-000000000001', 'salon_admin', 6),
  ('90900000-0000-0000-0000-000000000012', '90900000-0000-0000-0000-000000000001', 'staff', 3);

insert into auth.users (id, email) values
  ('90900000-0000-0000-0000-000000000021', 'goal90-event-owner@example.test'),
  ('90900000-0000-0000-0000-000000000022', 'goal90-event-staff@example.test'),
  ('90900000-0000-0000-0000-000000000023', 'goal90-event-platform@example.test');

insert into public.users (id, tenant_id, email, role_id, access_scope, status) values
  ('90900000-0000-0000-0000-000000000021', '90900000-0000-0000-0000-000000000001', 'goal90-event-owner@example.test', '90900000-0000-0000-0000-000000000011', 'organization', 'active'),
  ('90900000-0000-0000-0000-000000000022', '90900000-0000-0000-0000-000000000001', 'goal90-event-staff@example.test', '90900000-0000-0000-0000-000000000012', 'organization', 'active');

insert into public.users (id, tenant_id, email, role_id, access_scope, status)
select
  '90900000-0000-0000-0000-000000000023',
  null,
  'goal90-event-platform@example.test',
  r.id,
  'organization',
  'active'
from public.roles r
where r.tenant_id is null
  and r.name = 'super_admin';

do $$
begin
  if not exists (
    select 1
      from public.users
     where id = '90900000-0000-0000-0000-000000000023'
  ) then
    raise exception 'platform_event_fixture_missing';
  end if;
end
$$;

insert into public.tenant_modules (tenant_id, module_key, state, config) values
  ('90900000-0000-0000-0000-000000000001', 'kurser', 'off', '{"payment":"onsite"}'),
  ('90900000-0000-0000-0000-000000000002', 'kurser', 'off', '{"payment":"onsite"}');
update public.tenant_modules
   set state = 'live'
 where module_key = 'kurser'
   and tenant_id in (
     '90900000-0000-0000-0000-000000000001',
     '90900000-0000-0000-0000-000000000002'
   );

insert into public.tenant_events (
  id, tenant_id, title, starts_at, capacity, price_cents
) values
  ('90900000-0000-0000-0000-000000000101', '90900000-0000-0000-0000-000000000001', 'Idempotens', '2099-01-01 10:00:00+00', 3, 0),
  ('90900000-0000-0000-0000-000000000102', '90900000-0000-0000-0000-000000000001', 'Avboka och återställ', '2099-01-02 10:00:00+00', 2, 0),
  ('90900000-0000-0000-0000-000000000103', '90900000-0000-0000-0000-000000000001', 'Full vid återställning', '2099-01-03 10:00:00+00', 3, 0),
  ('90900000-0000-0000-0000-000000000104', '90900000-0000-0000-0000-000000000001', 'Ställ in tillfälle', '2099-01-04 10:00:00+00', 4, 0),
  ('90900000-0000-0000-0000-000000000105', '90900000-0000-0000-0000-000000000001', 'Betalt tillfälle', '2099-01-05 10:00:00+00', 2, 10000),
  ('90900000-0000-0000-0000-000000000106', '90900000-0000-0000-0000-000000000001', 'Slutstatus', '2099-01-06 10:00:00+00', 2, 0),
  ('90900000-0000-0000-0000-000000000107', '90900000-0000-0000-0000-000000000002', 'Annan tenant', '2099-01-07 10:00:00+00', 2, 0),
  ('90900000-0000-0000-0000-000000000108', '90900000-0000-0000-0000-000000000001', 'Kapacitetskant', '2099-01-08 10:00:00+00', 5, 0);

update public.tenant_events
   set reserved_qty = 3
 where id = '90900000-0000-0000-0000-000000000108';

-- Samma update får sänka både kapacitet och reservation när NEW-värdena ryms.
update public.tenant_events
   set capacity = 2,
       reserved_qty = 1
 where id = '90900000-0000-0000-0000-000000000108';

do $$
begin
  begin
    update public.tenant_events
       set reserved_qty = 3
     where id = '90900000-0000-0000-0000-000000000108';
    raise exception 'reserved_capacity_guard_missing';
  exception when check_violation then
    if sqlerrm <> 'event_capacity_below_occupancy' then raise; end if;
  end;
end
$$;

insert into public.event_registrations (
  id, tenant_id, event_id, name, email, party_size
) values
  ('90900000-0000-0000-0000-000000000202', '90900000-0000-0000-0000-000000000001', '90900000-0000-0000-0000-000000000102', 'Återställ', 'restore@example.test', 1),
  ('90900000-0000-0000-0000-000000000203', '90900000-0000-0000-0000-000000000001', '90900000-0000-0000-0000-000000000103', 'Får inte plats', 'full@example.test', 1),
  ('90900000-0000-0000-0000-000000000204', '90900000-0000-0000-0000-000000000001', '90900000-0000-0000-0000-000000000103', 'Fyller event', 'filler@example.test', 2),
  ('90900000-0000-0000-0000-000000000205', '90900000-0000-0000-0000-000000000001', '90900000-0000-0000-0000-000000000104', 'Inställd ett', 'cancel-one@example.test', 1),
  ('90900000-0000-0000-0000-000000000206', '90900000-0000-0000-0000-000000000001', '90900000-0000-0000-0000-000000000104', 'Inställd två', 'cancel-two@example.test', 2);

insert into public.shop_orders (
  id, tenant_id, customer_name, customer_email, subtotal_cents, total_cents, payment_status
) values (
  '90900000-0000-0000-0000-000000000401',
  '90900000-0000-0000-0000-000000000001',
  'Betald deltagare',
  'paid@example.test',
  10000,
  10000,
  'paid'
);
insert into public.shop_order_items (
  id, tenant_id, order_id, product_name, unit_price_cents, quantity, item_type, event_id
) values (
  '90900000-0000-0000-0000-000000000402',
  '90900000-0000-0000-0000-000000000001',
  '90900000-0000-0000-0000-000000000401',
  'Betald kursplats',
  10000,
  1,
  'event',
  '90900000-0000-0000-0000-000000000105'
);
insert into public.event_registrations (
  id, tenant_id, event_id, name, email, party_size, order_item_id
) values (
  '90900000-0000-0000-0000-000000000207',
  '90900000-0000-0000-0000-000000000001',
  '90900000-0000-0000-0000-000000000105',
  'Betald deltagare',
  'paid@example.test',
  1,
  '90900000-0000-0000-0000-000000000402'
);

do $$
begin
  begin
    insert into public.event_registrations (
      tenant_id, event_id, name, party_size
    ) values (
      '90900000-0000-0000-0000-000000000002',
      '90900000-0000-0000-0000-000000000101',
      'Fel tenant',
      1
    );
    raise exception 'cross_tenant_registration_succeeded';
  exception when foreign_key_violation then null;
  end;

  if to_regprocedure(
       'public.create_onsite_event_registration(uuid,uuid,text,text,text,integer,text)'
     ) is not null
     or to_regprocedure(
       'public.create_onsite_event_registration(uuid,uuid,text,text,text,integer,text,uuid)'
     ) is null
     or has_function_privilege(
       'anon',
       'public.create_onsite_event_registration(uuid,uuid,text,text,text,integer,text,uuid)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.create_onsite_event_registration(uuid,uuid,text,text,text,integer,text,uuid)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.create_onsite_event_registration(uuid,uuid,text,text,text,integer,text,uuid)',
       'execute'
     )
     or to_regclass('public.event_registrations_event_tenant_idx') is null then
    raise exception 'onsite_rpc_grants_or_signature_invalid';
  end if;
end
$$;

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
declare
  v_first jsonb;
  v_retry jsonb;
begin
  v_first := public.create_onsite_event_registration(
    '90900000-0000-0000-0000-000000000001',
    '90900000-0000-0000-0000-000000000101',
    'Idempotent deltagare',
    'idempotent@example.test',
    null,
    2,
    null,
    '90900000-0000-0000-0000-000000000301'
  );
  v_retry := public.create_onsite_event_registration(
    '90900000-0000-0000-0000-000000000001',
    '90900000-0000-0000-0000-000000000101',
    'Idempotent deltagare',
    'idempotent@example.test',
    null,
    2,
    null,
    '90900000-0000-0000-0000-000000000301'
  );

  if (v_first ->> 'already_registered')::boolean
     or not (v_retry ->> 'already_registered')::boolean
     or v_first ->> 'registration_id' <> v_retry ->> 'registration_id' then
    raise exception 'onsite_retry_not_idempotent';
  end if;

  begin
    perform public.create_onsite_event_registration(
      '90900000-0000-0000-0000-000000000001',
      '90900000-0000-0000-0000-000000000101',
      'Ändrad deltagare',
      'idempotent@example.test',
      null,
      2,
      null,
      '90900000-0000-0000-0000-000000000301'
    );
    raise exception 'idempotency_payload_conflict_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'idempotency_conflict' then raise; end if;
  end;

  begin
    perform public.create_onsite_event_registration(
      '90900000-0000-0000-0000-000000000001',
      '90900000-0000-0000-0000-000000000101',
      'Överbokning',
      'overbook@example.test',
      null,
      2,
      null,
      '90900000-0000-0000-0000-000000000302'
    );
    raise exception 'onsite_overbooking_succeeded';
  exception when exclusion_violation then
    if sqlerrm <> 'event_capacity_exceeded' then raise; end if;
  end;
end
$$;

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

select set_config('request.jwt.claim.sub', '90900000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90900000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"90900000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
begin
  begin
    update public.tenant_events
       set status = 'cancelled'
     where id = '90900000-0000-0000-0000-000000000102';
    raise exception 'direct_event_status_write_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'event_lifecycle_is_machine_owned' then raise; end if;
  end;

  begin
    update public.event_registrations
       set status = 'cancelled'
     where id = '90900000-0000-0000-0000-000000000202';
    raise exception 'direct_registration_status_write_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'event_registration_lifecycle_is_machine_owned' then raise; end if;
  end;

  perform *
  from public.set_event_registration_status(
    '90900000-0000-0000-0000-000000000001',
    '90900000-0000-0000-0000-000000000202',
    'cancelled',
    'Kunden avbokade'
  );
  perform *
  from public.set_event_registration_status(
    '90900000-0000-0000-0000-000000000001',
    '90900000-0000-0000-0000-000000000202',
    'cancelled',
    'Kunden avbokade'
  );
  perform *
  from public.set_event_registration_status(
    '90900000-0000-0000-0000-000000000001',
    '90900000-0000-0000-0000-000000000202',
    'confirmed',
    'Återanmäld'
  );

  perform *
  from public.set_event_registration_status(
    '90900000-0000-0000-0000-000000000001',
    '90900000-0000-0000-0000-000000000203',
    'cancelled',
    'Kunden avbokade'
  );
  update public.tenant_events
     set capacity = 2
   where id = '90900000-0000-0000-0000-000000000103';
  begin
    perform *
    from public.set_event_registration_status(
      '90900000-0000-0000-0000-000000000001',
      '90900000-0000-0000-0000-000000000203',
      'confirmed',
      'Försök återanmäla'
    );
    raise exception 'full_event_restore_succeeded';
  exception when exclusion_violation then
    if sqlerrm <> 'event_capacity_exceeded' then raise; end if;
  end;

  perform *
  from public.set_tenant_event_status(
    '90900000-0000-0000-0000-000000000001',
    '90900000-0000-0000-0000-000000000104',
    'cancelled',
    'Ledaren är sjuk'
  );

  begin
    perform *
    from public.set_event_registration_status(
      '90900000-0000-0000-0000-000000000001',
      '90900000-0000-0000-0000-000000000207',
      'cancelled',
      'Betald avbokning'
    );
    raise exception 'paid_registration_cancel_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'registration_paid_refund_required' then raise; end if;
  end;

  begin
    perform *
    from public.set_tenant_event_status(
      '90900000-0000-0000-0000-000000000001',
      '90900000-0000-0000-0000-000000000105',
      'cancelled',
      'Betalt tillfälle'
    );
    raise exception 'paid_event_cancel_succeeded';
  exception when sqlstate '55000' then
    if sqlerrm <> 'event_paid_refund_required' then raise; end if;
  end;

  perform *
  from public.set_tenant_event_status(
    '90900000-0000-0000-0000-000000000001',
    '90900000-0000-0000-0000-000000000106',
    'done',
    null
  );
  begin
    perform *
    from public.set_tenant_event_status(
      '90900000-0000-0000-0000-000000000001',
      '90900000-0000-0000-0000-000000000106',
      'open',
      null
    );
    raise exception 'terminal_event_reopened';
  exception when sqlstate '55000' then
    if sqlerrm <> 'event_status_transition_invalid' then raise; end if;
  end;

  begin
    perform *
    from public.set_tenant_event_status(
      '90900000-0000-0000-0000-000000000002',
      '90900000-0000-0000-0000-000000000107',
      'done',
      null
    );
    raise exception 'cross_tenant_event_status_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'event_status_access_denied' then raise; end if;
  end;

  begin
    delete from public.tenant_events
     where id = '90900000-0000-0000-0000-000000000104';
    raise exception 'event_history_delete_succeeded';
  exception when foreign_key_violation then
    if sqlerrm <> 'event_has_registration_history' then raise; end if;
  end;
end
$$;

reset role;

do $$
begin
  if (
    select count(*)
      from public.event_registrations
     where tenant_id = '90900000-0000-0000-0000-000000000001'
       and idempotency_key = '90900000-0000-0000-0000-000000000301'
  ) <> 1 then
    raise exception 'onsite_idempotency_row_count_invalid';
  end if;

  if not exists (
    select 1
      from public.event_registrations
     where id = '90900000-0000-0000-0000-000000000202'
       and status = 'confirmed'
       and lifecycle_version = 2
       and cancelled_at is null
       and cancelled_by is null
       and cancellation_reason is null
  ) then
    raise exception 'registration_cancel_restore_state_invalid';
  end if;

  if (
    select count(*)
      from public.audit_log
     where entity_id = '90900000-0000-0000-0000-000000000202'
       and action = 'event_registration.status_changed'
  ) <> 2
     or not exists (
       select 1
         from public.audit_log
        where entity_id = '90900000-0000-0000-0000-000000000202'
          and action = 'event_registration.status_changed'
          and meta ->> 'to_status' = 'cancelled'
          and meta ->> 'reason' = 'Kunden avbokade'
     )
     or (
       select count(*)
         from public.notifications_outbox
        where payload ->> 'registration_id' = '90900000-0000-0000-0000-000000000202'
     ) <> 2 then
    raise exception 'idempotent_registration_audit_or_outbox_invalid';
  end if;

  if exists (
    select 1
      from public.event_registrations
     where id in (
       '90900000-0000-0000-0000-000000000205',
       '90900000-0000-0000-0000-000000000206'
     )
       and (
         status <> 'cancelled'
         or lifecycle_version <> 1
         or cancellation_reason <> 'Ledaren är sjuk'
       )
  ) then
    raise exception 'event_cascade_cancellation_invalid';
  end if;

  if not exists (
    select 1
      from public.tenant_events
     where id = '90900000-0000-0000-0000-000000000104'
       and status = 'cancelled'
       and lifecycle_version = 1
       and cancellation_reason = 'Ledaren är sjuk'
  ) then
    raise exception 'event_cancellation_state_invalid';
  end if;

  if (
    select count(*)
      from public.audit_log
     where entity_id = '90900000-0000-0000-0000-000000000104'
       and action = 'tenant_event.status_changed'
  ) <> 1
     or (
       select count(*)
         from public.notifications_outbox
        where payload ->> 'event_id' = '90900000-0000-0000-0000-000000000104'
     ) <> 2 then
    raise exception 'event_cancel_audit_or_outbox_invalid';
  end if;

  if exists (
    select 1
      from public.notifications_outbox
     where tenant_id = '90900000-0000-0000-0000-000000000001'
       and event_type like 'event_registration_%'
       and (
         status <> 'routing'
         or chosen_channel is not null
         or payload ?| array['name', 'email', 'phone']
       )
  ) then
    raise exception 'event_outbox_contract_invalid';
  end if;

  if not exists (
    select 1
      from public.event_registrations
     where id = '90900000-0000-0000-0000-000000000203'
       and status = 'cancelled'
       and lifecycle_version = 1
  ) then
    raise exception 'failed_restore_changed_registration';
  end if;

  if not exists (
    select 1
      from public.event_registrations
     where id = '90900000-0000-0000-0000-000000000207'
       and status = 'confirmed'
       and lifecycle_version = 0
  ) or not exists (
    select 1
      from public.tenant_events
     where id = '90900000-0000-0000-0000-000000000105'
       and status = 'open'
       and lifecycle_version = 0
  ) then
    raise exception 'paid_cancellation_was_not_fail_closed';
  end if;
end
$$;

-- Event och deltagarhistorik är tenantgemensam. Ett nivå-6-konto med enbart
-- platsomfattning ska därför nekas även genom SECURITY DEFINER-RPC:erna.
update public.users
   set access_scope = 'locations'
 where id = '90900000-0000-0000-0000-000000000021';

select set_config('request.jwt.claim.sub', '90900000-0000-0000-0000-000000000021', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90900000-0000-0000-0000-000000000021","role":"authenticated","app_metadata":{"tenant_id":"90900000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform *
    from public.set_tenant_event_status(
      '90900000-0000-0000-0000-000000000001',
      '90900000-0000-0000-0000-000000000101',
      'done',
      null
    );
    raise exception 'location_scoped_event_status_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'event_status_access_denied' then raise; end if;
  end;

  begin
    perform *
    from public.set_event_registration_status(
      '90900000-0000-0000-0000-000000000001',
      '90900000-0000-0000-0000-000000000202',
      'cancelled',
      'Ska nekas'
    );
    raise exception 'location_scoped_registration_status_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'event_registration_status_access_denied' then raise; end if;
  end;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '90900000-0000-0000-0000-000000000023', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90900000-0000-0000-0000-000000000023","role":"authenticated","app_metadata":{"platform_admin":true}}',
  true
);
set local role authenticated;

select *
from public.set_tenant_event_status(
  '90900000-0000-0000-0000-000000000001',
  '90900000-0000-0000-0000-000000000101',
  'done',
  null
);
select *
from public.set_event_registration_status(
  '90900000-0000-0000-0000-000000000001',
  '90900000-0000-0000-0000-000000000202',
  'cancelled',
  'Plattformsgranskning'
);

reset role;
do $$
begin
  if (
    select count(*)
      from public.audit_log
     where actor_profile_id = '90900000-0000-0000-0000-000000000023'
       and (
         (
           entity_id = '90900000-0000-0000-0000-000000000101'
           and action = 'tenant_event.status_changed'
         )
         or (
           entity_id = '90900000-0000-0000-0000-000000000202'
           and action = 'event_registration.status_changed'
         )
       )
  ) <> 2 then
    raise exception 'platform_event_transitions_not_audited';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', '90900000-0000-0000-0000-000000000022', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"90900000-0000-0000-0000-000000000022","role":"authenticated","app_metadata":{"tenant_id":"90900000-0000-0000-0000-000000000001","platform_admin":false}}',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform *
    from public.set_tenant_event_status(
      '90900000-0000-0000-0000-000000000001',
      '90900000-0000-0000-0000-000000000101',
      'done',
      null
    );
    raise exception 'staff_event_status_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'event_status_access_denied' then raise; end if;
  end;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
begin
  begin
    delete from public.event_registrations
     where id = '90900000-0000-0000-0000-000000000202';
    raise exception 'registration_history_delete_succeeded';
  exception when foreign_key_violation then
    if sqlerrm <> 'event_registration_history_is_immutable' then raise; end if;
  end;
end
$$;

reset role;
rollback;
