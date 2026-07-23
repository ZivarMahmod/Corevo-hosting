#!/usr/bin/env bash
set -euo pipefail

db_container="${1:?database container required}"
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

docker exec -i "$db_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$test_dir/customer_portal_contact_change_0124_concurrency_fixture.sql"

docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/barrier" <<'SQL' &
begin;
select pg_advisory_xact_lock(hashtextextended(
  'c1240000-0000-4000-8000-000000000001:sms:+46700000099',0
));
select pg_sleep(5);
commit;
SQL
barrier_pid=$!
sleep 0.25

docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/finalize-a" <<'SQL' &
begin;
set local request.jwt.claim.role = 'service_role';
set local application_name = 'contact-change-race-a';
select outcome from public.customer_portal_finalize_contact_change(
  'c1240000-0000-4000-8000-000000000021',repeat('a',64),
  'c1240000-0000-4000-8000-000000000031',repeat('3',64),repeat('6',64),
  repeat('1',64),'+46700000101','c1240000-0000-4000-8000-000000000041',repeat('c',64),1
);
commit;
SQL
finalize_a_pid=$!

docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres > "$tmp_dir/finalize-b" <<'SQL' &
begin;
set local request.jwt.claim.role = 'service_role';
set local application_name = 'contact-change-race-b';
select outcome from public.customer_portal_finalize_contact_change(
  'c1240000-0000-4000-8000-000000000022',repeat('b',64),
  'c1240000-0000-4000-8000-000000000032',repeat('7',64),repeat('b',64),
  repeat('2',64),'+46700000102','c1240000-0000-4000-8000-000000000042',repeat('d',64),1
);
commit;
SQL
finalize_b_pid=$!

waiting=0
for _ in $(seq 1 40); do
  waiting="$(docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
select count(distinct a.pid) from pg_stat_activity a
join pg_locks l on l.pid = a.pid
where a.application_name in ('contact-change-race-a','contact-change-race-b')
  and l.locktype = 'advisory' and not l.granted;
SQL
)"
  [ "$waiting" = "2" ] && break
  sleep 0.1
done
[ "$waiting" = "2" ]

wait "$barrier_pid"
wait "$finalize_a_pid"
wait "$finalize_b_pid"

completed="$(grep -h -c '^completed$' "$tmp_dir/finalize-a" "$tmp_dir/finalize-b" | awk -F: '{n+=$NF} END{print n+0}')"
conflict="$(grep -h -c '^conflict$' "$tmp_dir/finalize-a" "$tmp_dir/finalize-b" | awk -F: '{n+=$NF} END{print n+0}')"
[ "$completed" = "1" ]
[ "$conflict" = "1" ]

docker exec -i "$db_container" psql -qAtX -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
do $$
begin
  if (select count(*) from public.customers
      where tenant_id='c1240000-0000-4000-8000-000000000001'
        and phone='+46700000099' and status='active') <> 1
     or (select count(*) from private.customer_portal_verified_contacts
         where tenant_id='c1240000-0000-4000-8000-000000000001'
           and channel='sms' and contact_digest=repeat('9',64) and revoked_at is null) <> 1
     or (select count(*) from private.customer_portal_contact_change_flows
         where tenant_id='c1240000-0000-4000-8000-000000000001' and completed_at is not null) <> 1
     or (select count(*) from private.customer_portal_audit
         where tenant_id='c1240000-0000-4000-8000-000000000001'
           and event_type='contact_changed') <> 1 then
    raise exception 'contact_change_real_concurrency_invalid';
  end if;
end $$;
SQL
