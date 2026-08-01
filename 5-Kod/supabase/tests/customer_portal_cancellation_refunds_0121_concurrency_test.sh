#!/usr/bin/env bash
set -euo pipefail

db_container="${1:?database container required}"
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

docker exec -i "$db_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$test_dir/customer_portal_cancellation_refunds_0121_concurrency_fixture.sql"

docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/claim-a" <<'SQL' &
begin;
set local request.jwt.claim.role = 'service_role';
select id from public.claim_payment_refund_jobs(
  'c1210000-0000-4000-8000-000000000201',statement_timestamp(),120,1
);
select pg_sleep(3);
commit;
SQL
claim_a_pid=$!
sleep 0.5
docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/claim-b" <<'SQL'
begin;
set local request.jwt.claim.role = 'service_role';
select id from public.claim_payment_refund_jobs(
  'c1210000-0000-4000-8000-000000000202',statement_timestamp(),120,1
);
commit;
SQL
wait "$claim_a_pid"
grep -q 'c1210000-0000-4000-8000-000000000101' "$tmp_dir/claim-a"
grep -q 'c1210000-0000-4000-8000-000000000102' "$tmp_dir/claim-b"

# Force the webhook to hold the payment row while it later asks for the job
# row. The worker must wait on payment BEFORE locking job; the former
# job→payment order deadlocked this exact two-session interleaving.
docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
set request.jwt.claim.role = 'service_role';
do $$
begin
  if not public.begin_payment_refund_delivery(
    'c1210000-0000-4000-8000-000000000101','c1210000-0000-4000-8000-000000000201'
  ) then raise exception 'refund_completion_begin_invalid'; end if;
end $$;
create or replace function private.test_refund_completion_delay()
returns trigger language plpgsql set search_path = '' as $$
begin
  if pg_catalog.current_setting('corevo.test_refund_delay', true) = 'on'
     and old.status = 'succeeded' and new.status = 'refunded' then
    perform pg_catalog.pg_advisory_xact_lock(121, 121);
  end if;
  return new;
end;
$$;
create trigger trg_test_refund_completion_delay
  before update of status on public.payments
  for each row execute function private.test_refund_completion_delay();
SQL

# Hold the trigger barrier before starting the webhook. The activity poll below
# proves the webhook owns payment and is waiting inside the trigger before the
# worker starts; this is not timing-dependent sleep-only coverage.
docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/refund-barrier" 2>&1 <<'SQL' &
begin;
select pg_advisory_xact_lock(121, 121);
select pg_sleep(5);
commit;
SQL
refund_barrier_pid=$!
sleep 0.25
docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/refund-webhook" 2>&1 <<'SQL' &
begin;
set local request.jwt.claim.role = 'service_role';
set local application_name = 'refund-webhook-concurrency';
set local corevo.test_refund_delay = 'on';
select public.record_payment_refund_webhook(
  'c1210000-0000-4000-8000-000000000001','pi_concurrency_job_1',
  'ch_concurrency_webhook','acct_concurrency_0121'
);
commit;
SQL
refund_webhook_pid=$!
webhook_waiting=0
for _ in $(seq 1 40); do
  webhook_waiting="$(docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
select count(*) from pg_stat_activity a
join pg_locks l on l.pid = a.pid
where a.application_name = 'refund-webhook-concurrency'
  and l.locktype = 'advisory' and not l.granted;
SQL
)"
  [ "$webhook_waiting" = "1" ] && break
  sleep 0.1
done
[ "$webhook_waiting" = "1" ]
set +e
docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/refund-complete" 2>&1 <<'SQL'
set request.jwt.claim.role = 'service_role';
select public.complete_payment_refund_job(
  'c1210000-0000-4000-8000-000000000101','c1210000-0000-4000-8000-000000000201',
  'ch_concurrency_worker'
);
SQL
refund_complete_status=$?
wait "$refund_webhook_pid"
refund_webhook_status=$?
wait "$refund_barrier_pid"
refund_barrier_status=$?
set -e
[ "$refund_complete_status" -eq 0 ]
[ "$refund_webhook_status" -eq 0 ]
[ "$refund_barrier_status" -eq 0 ]
grep -q '^t$' "$tmp_dir/refund-complete"
grep -Eq '"outcome"[[:space:]]*:[[:space:]]*"recorded"' "$tmp_dir/refund-webhook"

docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
do $$
begin
  if (select status from public.payments where id='c1210000-0000-4000-8000-000000000081') <> 'refunded'
     or (select status from private.payment_refund_jobs where id='c1210000-0000-4000-8000-000000000101') <> 'completed'
     or (select provider_ref from private.payment_refund_jobs where id='c1210000-0000-4000-8000-000000000101') <> 'ch_concurrency_webhook' then
    raise exception 'refund_completion_webhook_concurrency_invalid';
  end if;
end $$;
drop trigger trg_test_refund_completion_delay on public.payments;
drop function private.test_refund_completion_delay();
SQL

for session in a b; do
  docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/cancel-$session" <<'SQL' &
set request.jwt.claim.role = 'service_role';
select outcome from public.customer_portal_cancel_booking(
  'c1210000-0000-4000-8000-000000000111',repeat('z',64),
  'c1210000-0000-4000-8000-000000000073',24,repeat('i',32)
);
SQL
  if [ "$session" = a ]; then cancel_a_pid=$!; else cancel_b_pid=$!; fi
done
wait "$cancel_a_pid"
wait "$cancel_b_pid"
grep -q '^cancelled$' "$tmp_dir/cancel-a"
grep -q '^cancelled$' "$tmp_dir/cancel-b"

docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/rebook-a" <<'SQL' &
begin;
set local request.jwt.claim.role = 'service_role';
select pg_advisory_xact_lock(hashtextextended(
  'c1210000-0000-4000-8000-000000000001:booking-payment:c1210000-0000-4000-8000-000000000091',0
));
select pg_sleep(3);
select public.finalize_customer_booking_rebook(
  'c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000091',
  'c1210000-0000-4000-8000-000000000092','c1210000-0000-4000-8000-000000000021',
  'c1210000-0000-4000-8000-000000000031'
);
commit;
SQL
rebook_a_pid=$!
sleep 0.5
set +e
docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/rebook-b" 2>&1 <<'SQL'
begin;
set local request.jwt.claim.role = 'service_role';
select public.finalize_customer_booking_rebook(
  'c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000091',
  'c1210000-0000-4000-8000-000000000093','c1210000-0000-4000-8000-000000000021',
  'c1210000-0000-4000-8000-000000000031'
);
commit;
SQL
rebook_b_status=$?
wait "$rebook_a_pid"
rebook_a_status=$?
set -e
[ "$rebook_a_status" -eq 0 ]
[ "$rebook_b_status" -ne 0 ]
grep -Eq '"outcome"[[:space:]]*:[[:space:]]*"finalized"' "$tmp_dir/rebook-a"
grep -q 'rebook_already_finalized' "$tmp_dir/rebook-b"

docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/rebook-compensate" <<'SQL'
set request.jwt.claim.role = 'service_role';
select public.compensate_customer_booking_rebook(
  'c1210000-0000-4000-8000-000000000001','c1210000-0000-4000-8000-000000000091',
  'c1210000-0000-4000-8000-000000000093','c1210000-0000-4000-8000-000000000021',
  'c1210000-0000-4000-8000-000000000031'
);
SQL
grep -Eq '"outcome"[[:space:]]*:[[:space:]]*"compensated_loser"' "$tmp_dir/rebook-compensate"

docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
do $$
begin
  if (select status from public.bookings where id='c1210000-0000-4000-8000-000000000091') <> 'cancelled'
     or (select status from public.bookings where id='c1210000-0000-4000-8000-000000000092') <> 'confirmed'
     or (select status from public.bookings where id='c1210000-0000-4000-8000-000000000093') <> 'cancelled'
     or (select booking_id from public.payments where id='c1210000-0000-4000-8000-000000000094')
          <> 'c1210000-0000-4000-8000-000000000092'
     or (select count(*) from private.customer_booking_rebooks
         where old_booking_id='c1210000-0000-4000-8000-000000000091') <> 1
     or exists (select 1 from private.payment_refund_jobs
                where payment_id='c1210000-0000-4000-8000-000000000094') then
    raise exception 'refund_rebook_concurrency_invalid';
  end if;
  if (select status from public.bookings where id='c1210000-0000-4000-8000-000000000073') <> 'cancelled'
     or (select count(*) from private.customer_portal_audit
         where tenant_id='c1210000-0000-4000-8000-000000000001'
           and entity_public_id='c1210000-0000-4000-8000-000000000073'
           and event_type='booking_cancelled' and idempotency_key=repeat('i',32)) <> 1
     or (select count(*) from public.notifications_outbox
         where tenant_id='c1210000-0000-4000-8000-000000000001'
           and event_key='booking:c1210000-0000-4000-8000-000000000073:cancelled') <> 1 then
    raise exception 'refund_cancel_concurrency_invalid';
  end if;
end $$;
SQL
