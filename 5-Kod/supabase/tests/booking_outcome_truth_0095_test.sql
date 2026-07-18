-- 0095 runtime: sluttidsvakt, idempotens och completion-effekter.
-- Körs mot ett färskt migrerat testschema och rullas alltid tillbaka.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.tenants (id, slug, name) values
  ('95000000-0000-0000-0000-000000000001', 'outcome-0095', 'Outcome 0095');
insert into public.roles (id, tenant_id, name, level) values (
  '95000000-0000-0000-0000-000000000091',
  '95000000-0000-0000-0000-000000000001', 'outcome_owner', 6
);
insert into auth.users (id, email) values (
  '95000000-0000-0000-0000-000000000092', 'outcome-owner@example.test'
);
insert into public.users (
  id, tenant_id, email, role_id, status, access_scope
) values (
  '95000000-0000-0000-0000-000000000092',
  '95000000-0000-0000-0000-000000000001',
  'outcome-owner@example.test',
  '95000000-0000-0000-0000-000000000091',
  'active', 'organization'
);
insert into public.locations (id, tenant_id, name, is_primary, timezone) values
  ('95000000-0000-0000-0000-000000000011',
   '95000000-0000-0000-0000-000000000001', 'Primary', true, 'UTC');
insert into public.services (
  id, tenant_id, location_id, name, duration_min, price_cents, active
) values (
  '95000000-0000-0000-0000-000000000021',
  '95000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000011', 'Test', 30, 10000, true
);
insert into public.staff (id, tenant_id, location_id, title, active) values (
  '95000000-0000-0000-0000-000000000031',
  '95000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000011', 'Staff', false
);
insert into public.staff_services (tenant_id, staff_id, service_id) values (
  '95000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000031',
  '95000000-0000-0000-0000-000000000021'
);
insert into public.working_hours (
  tenant_id, location_id, staff_id, weekday, start_time, end_time
)
select '95000000-0000-0000-0000-000000000001',
       '95000000-0000-0000-0000-000000000011',
       '95000000-0000-0000-0000-000000000031',
       day, '00:00', '23:59'
  from generate_series(0, 6) day;
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at
)
select '95000000-0000-0000-0000-000000000001',
       '95000000-0000-0000-0000-000000000011',
       day, '00:00', '23:59', 'confirmed', now()
  from generate_series(0, 6) day;
update public.staff set active = true
 where id = '95000000-0000-0000-0000-000000000031';

insert into public.customers (id, tenant_id, full_name) values (
  '95000000-0000-0000-0000-000000000041',
  '95000000-0000-0000-0000-000000000001', 'Testkund'
);

-- Seed a historical database snapshot. These pending rows were valid future
-- bookings when created, but cannot be inserted through today's availability
-- fence after their start time has passed. Outcome assertions below run with
-- every production trigger enabled again.
set local session_replication_role = replica;
insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents
) values
  (
    '95000000-0000-0000-0000-000000000051',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000041',
    date_trunc('day', current_timestamp) - interval '1 day' + interval '10 hours',
    date_trunc('day', current_timestamp) - interval '1 day' + interval '10 hours 30 minutes',
    'pending', 10000
  ),
  (
    '95000000-0000-0000-0000-000000000052',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000041',
    date_trunc('day', current_timestamp) + interval '1 day 10 hours',
    date_trunc('day', current_timestamp) + interval '1 day 10 hours 30 minutes',
    'confirmed', 10000
  );

-- Två övergivna checkout-pendings (en historisk, en framtida) och en historisk
-- pending utan betalning. Svepet ska ta exakt de två första i samma statement.
insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents
) values
  (
    '95000000-0000-0000-0000-000000000056',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000041',
    current_timestamp - interval '3 days', current_timestamp - interval '3 days' + interval '30 minutes',
    'pending', 10000
  ),
  (
    '95000000-0000-0000-0000-000000000057',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000041',
    current_timestamp + interval '3 days', current_timestamp + interval '3 days 30 minutes',
    'pending', 10000
  ),
  (
    '95000000-0000-0000-0000-000000000058',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000041',
    current_timestamp - interval '4 days', current_timestamp - interval '4 days' + interval '30 minutes',
    'pending', 10000
  ),
  (
    '95000000-0000-0000-0000-000000000059',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000041',
    current_timestamp - interval '5 days', current_timestamp - interval '5 days' + interval '30 minutes',
    'pending', 10000
  );
set local session_replication_role = origin;

insert into public.payments (
  id, tenant_id, booking_id, amount_cents, status, created_at
) values
  (
    '95000000-0000-0000-0000-000000000071',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000056', 10000, 'pending',
    current_timestamp - interval '2 hours'
  ),
  (
    '95000000-0000-0000-0000-000000000072',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000057', 10000, 'pending',
    current_timestamp - interval '2 hours'
  );

-- BEFORE INSERT-vakten gäller både service_role och authenticated-claim. Ingen
-- skrivväg får skapa ett framtida terminalt utfall direkt.
do $$ begin
  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id, customer_id,
    start_ts, end_ts, status, price_cents
  ) values (
    '95000000-0000-0000-0000-000000000060',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000041',
    current_timestamp + interval '1 day', current_timestamp + interval '1 day 30 minutes',
    'completed', 10000
  );
  raise exception 'service_future_outcome_insert_succeeded';
exception when raise_exception then
  if sqlerrm = 'service_future_outcome_insert_succeeded'
     or sqlerrm not like '%booking_not_ended_for_completed%' then raise; end if;
end $$;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$ begin
  insert into public.bookings (
    id, tenant_id, location_id, staff_id, service_id, customer_id,
    start_ts, end_ts, status, price_cents
  ) values (
    '95000000-0000-0000-0000-000000000061',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000041',
    current_timestamp + interval '1 day', current_timestamp + interval '1 day 30 minutes',
    'no_show', 10000
  );
  raise exception 'authenticated_future_outcome_insert_succeeded';
exception when insufficient_privilege then
  if sqlerrm not like '%historical_booking_insert_forbidden%' then raise; end if;
end $$;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- service_role får inte själv kalla en historisk pending för cancelled. Endast det
-- fencade expiry-svepet får den exakta interna övergången, och en gammal rad får
-- inte längre rulla tillbaka en samtidig framtida expiry.
do $$ begin
  update public.bookings
     set status = 'cancelled', cancelled_at = current_timestamp, cancelled_by = 'system'
   where id = '95000000-0000-0000-0000-000000000056';
  raise exception 'direct_service_expiry_succeeded';
exception when raise_exception then
  if sqlerrm = 'direct_service_expiry_succeeded'
     or sqlerrm not like '%past_booking_requires_outcome%' then raise; end if;
end $$;

select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
do $$ declare v_n int; begin
  select public.expire_abandoned_pending_bookings(30) into v_n;
  if v_n <> 2 then raise exception 'expiry_mixed_count_%', v_n; end if;
  if exists (
    select 1 from public.bookings
     where id in (
       '95000000-0000-0000-0000-000000000056',
       '95000000-0000-0000-0000-000000000057'
     ) and (status <> 'cancelled' or cancelled_by <> 'system')
  ) then raise exception 'expiry_mixed_rows_not_cancelled'; end if;
  if (select status from public.bookings
       where id = '95000000-0000-0000-0000-000000000058') <> 'pending' then
    raise exception 'expiry_touched_noncheckout_pending';
  end if;
end $$;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Även service_role nekas före end_ts.
do $$ begin
  update public.bookings set status = 'completed'
   where id = '95000000-0000-0000-0000-000000000052';
  raise exception 'future_completion_succeeded';
exception when raise_exception then
  if sqlerrm = 'future_completion_succeeded'
     or sqlerrm not like '%booking_not_ended_for_completed%' then raise; end if;
end $$;

-- En passerad aktiv bokning är en utfallskö, inte längre avboknings-/ombokningsbar.
do $$ begin
  update public.bookings
     set status = 'cancelled', cancelled_at = current_timestamp, cancelled_by = 'business'
   where id = '95000000-0000-0000-0000-000000000051';
  raise exception 'past_active_cancel_succeeded';
exception when raise_exception then
  if sqlerrm = 'past_active_cancel_succeeded'
     or sqlerrm not like '%past_booking_requires_outcome%' then raise; end if;
end $$;

do $$ begin
  update public.bookings
     set start_ts = start_ts + interval '3 days', end_ts = end_ts + interval '3 days'
   where id = '95000000-0000-0000-0000-000000000051';
  raise exception 'past_active_rebook_succeeded';
exception when raise_exception then
  if sqlerrm = 'past_active_rebook_succeeded'
     or sqlerrm not like '%past_booking_schedule_read_only%' then raise; end if;
end $$;

-- Cancelled kan bara återställas innan ORIGINALSTARTEN. En pågående avbokad tid
-- förblir historik; en framtida får återställas. no_show-korrigering lever kvar.
insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents, cancelled_at, cancelled_by
) values
  (
    '95000000-0000-0000-0000-000000000053',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000041',
    current_timestamp - interval '15 minutes', current_timestamp + interval '15 minutes',
    'cancelled', 10000, current_timestamp - interval '20 minutes', 'business'
  ),
  (
    '95000000-0000-0000-0000-000000000054',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000041',
    current_timestamp + interval '2 days', current_timestamp + interval '2 days 30 minutes',
    'cancelled', 10000, current_timestamp, 'business'
  ),
  (
    '95000000-0000-0000-0000-000000000055',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000041',
    current_timestamp - interval '2 hours', current_timestamp - interval '90 minutes',
    'no_show', 10000, null, null
  );

do $$ begin
  update public.bookings
     set status = 'confirmed', cancelled_at = null, cancelled_by = null
   where id = '95000000-0000-0000-0000-000000000053';
  raise exception 'started_cancelled_restore_succeeded';
exception when raise_exception then
  if sqlerrm = 'started_cancelled_restore_succeeded'
     or (
       sqlerrm not like '%cancelled_booking_already_started%'
       and sqlerrm not like '%booking_inside_min_notice%'
     ) then raise; end if;
end $$;

do $$ begin
  update public.bookings
     set status = 'pending', cancelled_at = null, cancelled_by = null
   where id = '95000000-0000-0000-0000-000000000053';
  raise exception 'started_cancelled_pending_restore_succeeded';
exception when raise_exception then
  if sqlerrm = 'started_cancelled_pending_restore_succeeded'
     or (
       sqlerrm not like '%cancelled_booking_already_started%'
       and sqlerrm not like '%booking_inside_min_notice%'
     ) then raise; end if;
end $$;

update public.bookings
   set status = 'confirmed', cancelled_at = null, cancelled_by = null
 where id = '95000000-0000-0000-0000-000000000054';

update public.bookings set status = 'completed'
 where id = '95000000-0000-0000-0000-000000000055';

do $$ begin
  update public.bookings set status = 'confirmed'
   where id = '95000000-0000-0000-0000-000000000055';
  raise exception 'completed_reopened_to_confirmed';
exception when raise_exception then
  if sqlerrm = 'completed_reopened_to_confirmed'
     or (
       sqlerrm not like '%invalid_booking_status_transition%'
       and sqlerrm not like '%booking_inside_min_notice%'
     ) then raise; end if;
end $$;

do $$ begin
  update public.bookings set end_ts = end_ts + interval '1 minute'
   where id = '95000000-0000-0000-0000-000000000055';
  raise exception 'terminal_schedule_change_succeeded';
exception when insufficient_privilege then
  if sqlerrm not like '%terminal_booking_schedule_read_only%' then raise; end if;
end $$;

-- Sluttiden är ett snapshot: samma UPDATE får inte korta en framtida bokning och
-- använda den nya tiden för att tillverka ett genomfört besök.
do $$ begin
  update public.bookings
     set end_ts = date_trunc('day', current_timestamp) - interval '1 day' + interval '11 hours',
         status = 'completed'
   where id = '95000000-0000-0000-0000-000000000052';
  raise exception 'shortened_future_completion_succeeded';
exception when raise_exception then
  if sqlerrm = 'shortened_future_completion_succeeded'
     or sqlerrm not like '%booking_not_ended_for_completed%' then raise; end if;
end $$;

do $$ begin
  update public.bookings set status = 'no_show'
   where id = '95000000-0000-0000-0000-000000000052';
  raise exception 'future_no_show_succeeded';
exception when raise_exception then
  if sqlerrm = 'future_no_show_succeeded'
     or sqlerrm not like '%booking_not_ended_for_no_show%' then raise; end if;
end $$;

-- Ett okänt ledgerfel måste rulla tillbaka statusen. När felet försvinner kan samma
-- transition retryas, och unik-idempotensen ger exakt en ledger/historik-rad.
create or replace function public.test_0095_fail_loyalty()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'loyalty_injected_failure' using errcode = 'P0001';
end;
$$;
create trigger test_0095_fail_loyalty
before insert on public.loyalty_ledger
for each row execute function public.test_0095_fail_loyalty();

do $$ begin
  update public.bookings set status = 'completed'
   where id = '95000000-0000-0000-0000-000000000051';
  raise exception 'completion_survived_ledger_failure';
exception when raise_exception then
  if sqlerrm = 'completion_survived_ledger_failure'
     or sqlerrm not like '%loyalty_injected_failure%' then raise; end if;
end $$;

do $$ begin
  if (select status from public.bookings
       where id = '95000000-0000-0000-0000-000000000051') <> 'pending' then
    raise exception 'completion_not_rolled_back';
  end if;
  if exists (select 1 from public.loyalty_ledger
              where booking_id = '95000000-0000-0000-0000-000000000051') then
    raise exception 'failed_completion_left_ledger';
  end if;
  if exists (select 1 from public.notifications_outbox
              where booking_id = '95000000-0000-0000-0000-000000000051'
                and event_type = 'booking_completed') then
    raise exception 'failed_completion_left_outbox';
  end if;
end $$;

drop trigger test_0095_fail_loyalty on public.loyalty_ledger;
drop function public.test_0095_fail_loyalty();

update public.bookings set status = 'completed'
 where id = '95000000-0000-0000-0000-000000000051';
update public.bookings set status = 'completed'
 where id = '95000000-0000-0000-0000-000000000051';

do $$ begin
  if (select count(*) from public.loyalty_ledger
       where booking_id = '95000000-0000-0000-0000-000000000051'
         and reason = 'earn_completed') <> 1 then
    raise exception 'loyalty_not_exactly_once';
  end if;
  if (select count(*) from public.booking_status_history
       where booking_id = '95000000-0000-0000-0000-000000000051'
         and to_status = 'completed') <> 1 then
    raise exception 'completed_transition_not_exactly_once';
  end if;
end $$;

-- Outboxfel måste rulla tillbaka status + ledger. Efter att felet tas bort ska
-- retry lyckas, och samma status/re-completion får aldrig skapa ett andra event.
create or replace function public.test_0095_fail_outbox()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.event_type = 'booking_completed' then
    raise exception 'outbox_injected_failure' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger test_0095_fail_outbox
before insert on public.notifications_outbox
for each row execute function public.test_0095_fail_outbox();

do $$ begin
  update public.bookings set status = 'completed'
   where id = '95000000-0000-0000-0000-000000000059';
  raise exception 'completion_survived_outbox_failure';
exception when raise_exception then
  if sqlerrm = 'completion_survived_outbox_failure'
     or sqlerrm not like '%outbox_injected_failure%' then raise; end if;
end $$;
do $$ begin
  if (select status from public.bookings
       where id = '95000000-0000-0000-0000-000000000059') <> 'pending' then
    raise exception 'outbox_failure_did_not_rollback_status';
  end if;
  if exists (select 1 from public.loyalty_ledger
              where booking_id = '95000000-0000-0000-0000-000000000059') then
    raise exception 'outbox_failure_left_loyalty';
  end if;
end $$;

drop trigger test_0095_fail_outbox on public.notifications_outbox;
drop function public.test_0095_fail_outbox();
update public.bookings set status = 'completed'
 where id = '95000000-0000-0000-0000-000000000059';
update public.bookings set status = 'completed'
 where id = '95000000-0000-0000-0000-000000000059';

do $$ begin
  if (select count(*) from public.notifications_outbox
       where booking_id = '95000000-0000-0000-0000-000000000059'
         and event_type = 'booking_completed') <> 1 then
    raise exception 'completion_outbox_not_exactly_once';
  end if;
  if not exists (
    select 1 from public.notifications_outbox
     where booking_id = '95000000-0000-0000-0000-000000000059'
       and tenant_id = '95000000-0000-0000-0000-000000000001'
       and customer_id = '95000000-0000-0000-0000-000000000041'
       and chosen_channel is null
       and consent_state is null
       and status = 'routing'
  ) then raise exception 'completion_outbox_identity_wrong'; end if;
end $$;

-- Routing är durable men claim_notification_outbox får aldrig göra den
-- levererbar innan U4 har satt både samtycke och kanal.
select * from public.claim_notification_outbox(
  '95000000-0000-0000-0000-000000000091', current_timestamp, 120, 50
);
do $$ begin
  if exists (
    select 1 from public.notifications_outbox
     where event_type = 'booking_completed'
       and (status <> 'routing' or chosen_channel is not null or attempt_count <> 0)
  ) then raise exception 'routing_event_became_deliverable'; end if;
end $$;

-- completed får bara rättas direkt till no_show. Reversal är append-only, saldot
-- går aldrig under noll, och varje direkt re-completion återlägger exakt avdraget.
update public.bookings set status = 'no_show'
 where id = '95000000-0000-0000-0000-000000000051';
do $$ begin
  if (select coalesce(sum(points_delta), 0) from public.loyalty_ledger
       where booking_id = '95000000-0000-0000-0000-000000000051') <> 0 then
    raise exception 'full_reversal_not_zero';
  end if;
  if not exists (
    select 1 from public.notifications_outbox
     where booking_id = '95000000-0000-0000-0000-000000000051'
       and event_type = 'booking_completed'
       and status = 'skipped'
       and skip_reason = 'booking_outcome_changed'
       and lease_token is null
       and lease_expires_at is null
  ) then raise exception 'no_show_did_not_skip_unsent_completion'; end if;
end $$;
update public.bookings set status = 'completed'
 where id = '95000000-0000-0000-0000-000000000051';
do $$ begin
  if (select count(*) from public.loyalty_ledger
       where booking_id = '95000000-0000-0000-0000-000000000051'
         and reason = 'adjustment'
         and note = 'booking_completed_reearn') <> 1 then
    raise exception 'reearn_not_exactly_once';
  end if;
  if (select count(*) from public.notifications_outbox
       where booking_id = '95000000-0000-0000-0000-000000000051'
         and event_type = 'booking_completed') <> 1 then
    raise exception 'recompletion_duplicated_outbox';
  end if;
  if not exists (
    select 1 from public.notifications_outbox
     where booking_id = '95000000-0000-0000-0000-000000000051'
       and status = 'routing'
       and chosen_channel is null
       and consent_state is null
       and skip_reason is null
  ) then raise exception 'recompletion_did_not_reopen_routing'; end if;
end $$;

-- Simulera att nästan hela saldot redan lösts in. Nästa reversal får bara ta
-- tillgängliga poäng; re-completion återlägger exakt samma del, aldrig mer.
insert into public.loyalty_ledger (
  tenant_id, customer_id, booking_id, points_delta, reason, note
)
select
  '95000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000041', null,
  -(sum(ll.points_delta)::int - 10), 'redeem', 'test_spent_before_correction'
from public.loyalty_ledger ll
where ll.customer_id = '95000000-0000-0000-0000-000000000041';

update public.bookings set status = 'no_show'
 where id = '95000000-0000-0000-0000-000000000051';
do $$ begin
  if (select coalesce(sum(points_delta), 0) from public.loyalty_ledger
       where customer_id = '95000000-0000-0000-0000-000000000041') <> 0 then
    raise exception 'capped_reversal_not_zero';
  end if;
end $$;
update public.bookings set status = 'completed'
 where id = '95000000-0000-0000-0000-000000000051';
do $$ begin
  if (select coalesce(sum(points_delta), 0) from public.loyalty_ledger
       where customer_id = '95000000-0000-0000-0000-000000000041') <> 10 then
    raise exception 'capped_reearn_wrong';
  end if;
  if (select count(*) from public.notifications_outbox
       where booking_id = '95000000-0000-0000-0000-000000000051'
         and event_type = 'booking_completed') <> 1 then
    raise exception 'second_recompletion_duplicated_outbox';
  end if;
end $$;

-- En redan påbörjad/skickad rad är historiskt facit. no_show får inte skriva om
-- den, och re-completion får aldrig skapa en ny routing-/leveransrad bredvid.
update public.notifications_outbox
   set chosen_channel = 'email',
       consent_state = '{"source":"test_routed"}'::jsonb,
       status = 'sent',
       sent_at = current_timestamp
 where booking_id = '95000000-0000-0000-0000-000000000051'
   and event_type = 'booking_completed';
update public.bookings set status = 'no_show'
 where id = '95000000-0000-0000-0000-000000000051';
update public.bookings set status = 'completed'
 where id = '95000000-0000-0000-0000-000000000051';
do $$ begin
  if (select count(*) from public.notifications_outbox
       where booking_id = '95000000-0000-0000-0000-000000000051'
         and event_type = 'booking_completed') <> 1
     or not exists (
       select 1 from public.notifications_outbox
        where booking_id = '95000000-0000-0000-0000-000000000051'
          and event_type = 'booking_completed'
          and status = 'sent'
          and chosen_channel = 'email'
     ) then
    raise exception 'sent_completion_was_duplicated';
  end if;
end $$;

-- Isolerad kund låser +50 -> -50 -> config 0 -> +50. Setting 0 stoppar bara en
-- ny första earn, aldrig återställning av det redan historiskt intjänade beloppet.
insert into public.customers (id, tenant_id, full_name) values (
  '95000000-0000-0000-0000-000000000042',
  '95000000-0000-0000-0000-000000000001', 'Configkund'
);
set local session_replication_role = replica;
insert into public.bookings (
  id, tenant_id, location_id, staff_id, service_id, customer_id,
  start_ts, end_ts, status, price_cents
) values
  (
    '95000000-0000-0000-0000-000000000062',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000042',
    current_timestamp - interval '10 days', current_timestamp - interval '10 days' + interval '30 minutes',
    'confirmed', 10000
  ),
  (
    '95000000-0000-0000-0000-000000000063',
    '95000000-0000-0000-0000-000000000001',
    '95000000-0000-0000-0000-000000000011',
    '95000000-0000-0000-0000-000000000031',
    '95000000-0000-0000-0000-000000000021',
    '95000000-0000-0000-0000-000000000042',
    current_timestamp - interval '9 days', current_timestamp - interval '9 days' + interval '30 minutes',
    'confirmed', 10000
  );
set local session_replication_role = origin;

update public.bookings set status = 'completed'
 where id = '95000000-0000-0000-0000-000000000062';
update public.bookings set status = 'no_show'
 where id = '95000000-0000-0000-0000-000000000062';
do $$ begin
  if (select coalesce(sum(points_delta), 0) from public.loyalty_ledger
       where booking_id = '95000000-0000-0000-0000-000000000062') <> 0 then
    raise exception 'config_zero_fixture_not_fully_reversed';
  end if;
  perform set_config('request.jwt.claim.sub', '95000000-0000-0000-0000-000000000092', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"95000000-0000-0000-0000-000000000092","role":"authenticated","app_metadata":{"tenant_id":"95000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
  if (select lifetime from public.customer_loyalty_totals(
        '95000000-0000-0000-0000-000000000001',
        '95000000-0000-0000-0000-000000000042'
      )) <> 0 then
    raise exception 'no_show_contributed_to_lifetime';
  end if;
end $$;

insert into public.tenant_settings (tenant_id, settings)
values (
  '95000000-0000-0000-0000-000000000001',
  '{"loyalty":{"points_per_visit":0}}'::jsonb
)
on conflict (tenant_id) do update
set settings = jsonb_set(
  coalesce(public.tenant_settings.settings, '{}'::jsonb),
  '{loyalty}',
  coalesce(public.tenant_settings.settings -> 'loyalty', '{}'::jsonb)
    || '{"points_per_visit":0}'::jsonb,
  true
);

update public.bookings set status = 'completed'
 where id = '95000000-0000-0000-0000-000000000062';
do $$ begin
  if (select coalesce(sum(points_delta), 0) from public.loyalty_ledger
       where booking_id = '95000000-0000-0000-0000-000000000062') <> 50 then
    raise exception 'config_zero_did_not_restore_original_earn';
  end if;
end $$;

update public.bookings set status = 'completed'
 where id = '95000000-0000-0000-0000-000000000063';
do $$ begin
  if exists (
    select 1 from public.loyalty_ledger
     where booking_id = '95000000-0000-0000-0000-000000000063'
       and reason = 'earn_completed'
  ) then raise exception 'config_zero_created_new_earn'; end if;
  perform set_config('request.jwt.claim.sub', '95000000-0000-0000-0000-000000000092', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"95000000-0000-0000-0000-000000000092","role":"authenticated","app_metadata":{"tenant_id":"95000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
  if (select lifetime from public.customer_loyalty_totals(
        '95000000-0000-0000-0000-000000000001',
        '95000000-0000-0000-0000-000000000042'
      )) <> 50 then
    raise exception 'completed_original_earn_lifetime_wrong';
  end if;
end $$;

insert into public.loyalty_ledger (
  tenant_id, customer_id, booking_id, points_delta, reason, note
) values (
  '95000000-0000-0000-0000-000000000001',
  '95000000-0000-0000-0000-000000000042',
  null, 7, 'adjustment', 'test_manual_lifetime_earn'
);
do $$ begin
  perform set_config('request.jwt.claim.sub', '95000000-0000-0000-0000-000000000092', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"95000000-0000-0000-0000-000000000092","role":"authenticated","app_metadata":{"tenant_id":"95000000-0000-0000-0000-000000000001","platform_admin":false}}', true);
  if (select lifetime from public.customer_loyalty_totals(
        '95000000-0000-0000-0000-000000000001',
        '95000000-0000-0000-0000-000000000042'
      )) <> 57 then
    raise exception 'manual_adjustment_lifetime_wrong';
  end if;
end $$;

rollback;
