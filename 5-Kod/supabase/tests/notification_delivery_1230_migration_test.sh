#!/usr/bin/env bash
set -euo pipefail

db_container="${1:?database container required}"
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tenant_id='12300000-0000-4000-8000-000000000001'
fallback_id='12300000-0000-4000-8000-000000000002'
exhausted_id='12300000-0000-4000-8000-000000000003'
started_id='12300000-0000-4000-8000-000000000004'

psql() {
  docker exec -i "$db_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
}

cleanup() {
  psql <<SQL || true
delete from public.notifications_outbox where tenant_id = '$tenant_id';
delete from public.tenants where id = '$tenant_id';
alter table public.tenants enable trigger trg_tenant_launch_readiness;
SQL
}

trap cleanup EXIT
cleanup

# The fixture is deliberately historical: the migration must make a previously
# exhausted push row deliverable through its recorded e-mail fallback.
psql <<SQL
alter table public.tenants disable trigger trg_tenant_launch_readiness;

insert into public.tenants (id, slug, name)
values ('$tenant_id', 'notification-1230-upgrade', 'Notification 1230 upgrade');

insert into public.notifications_outbox (
  id, tenant_id, event_type, event_key, category, chosen_channel,
  fallback_channel, status, attempt_count, max_attempts, last_error,
  lease_token, lease_expires_at, available_at
) values
(
  '$fallback_id', '$tenant_id', 'migration_upgrade', 'push-fallback-1230',
  'transactional', 'push', 'email', 'attempting', 3, 3, 'push_timeout',
  '12300000-0000-4000-8000-000000000101', statement_timestamp() - interval '5 minutes',
  statement_timestamp() - interval '10 minutes'
),
(
  '$exhausted_id', '$tenant_id', 'migration_upgrade', 'email-lease-1230',
  'transactional', 'email', null, 'attempting', 3, 3, null,
  '12300000-0000-4000-8000-000000000102', statement_timestamp() - interval '5 minutes',
  statement_timestamp() - interval '10 minutes'
),
(
  '$started_id', '$tenant_id', 'migration_upgrade', 'push-started-1230',
  'transactional', 'push', 'email', 'delivery_started', 1, 3, null,
  '12300000-0000-4000-8000-000000000103', null,
  statement_timestamp() - interval '10 minutes'
);
SQL

# Run the actual migration against the disposable historical records. The main
# CI migration pass already proves fresh 0001-latest; this proves the data-upgrade path.
psql < "$test_dir/../migrations/20260804123000_schedule_booking_notification_delivery.sql"

psql <<SQL
set request.jwt.claim.role = 'service_role';

do \$\$
declare
  v_claimed uuid;
  v_status text;
  v_attempts integer;
  v_fallback text;
  v_error text;
  v_lease uuid;
  v_started_status text;
begin
  select status, attempt_count, fallback_channel, last_error, lease_token
    into v_status, v_attempts, v_fallback, v_error, v_lease
    from public.notifications_outbox
   where id = '$fallback_id';
  if v_status <> 'queued' or v_attempts <> 0 or v_fallback is not null
     or v_error is not null or v_lease is not null then
    raise exception 'push_fallback_upgrade_invalid_%_%_%_%_%',
      v_status, v_attempts, v_fallback, v_error, v_lease;
  end if;

  -- Make the migrated row the first due row without changing its migration result.
  update public.notifications_outbox
     set available_at = '2000-01-01T00:00:00Z'
   where id = '$fallback_id';

  select id into v_claimed
    from public.claim_notification_outbox(
      '12300000-0000-4000-8000-000000000201', '2030-01-01T00:00:00Z', 120, 1
    );
  if v_claimed <> '$fallback_id'::uuid then
    raise exception 'push_fallback_not_claimable_%', v_claimed;
  end if;

  select status, last_error into v_status, v_error
    from public.notifications_outbox
   where id = '$exhausted_id';
  if v_status <> 'failed' or v_error <> 'lease_expired_after_max_attempts' then
    raise exception 'expired_email_max_attempt_not_terminal_%_%', v_status, v_error;
  end if;

  select status into v_started_status
    from public.notifications_outbox
   where id = '$started_id';
  if v_started_status <> 'delivery_started' then
    raise exception 'delivery_started_push_was_not_preserved_%', v_started_status;
  end if;
end
\$\$;
SQL

# delivery_started is deliberately at-most-once. It requires manual cutover
# reconciliation, and the exact production audit must block while it remains.
audit_result="$(docker exec -i "$db_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -tA -F '|' < "$test_dir/../../scripts/sql/audit-production-migration-effects.sql")"
grep -Fqx '20260804123000|push transport retired|f|no active push preference, subscription, active or uncertain push row, or exhausted nonterminal fallback' <<< "$audit_result"

psql <<SQL
update public.notifications_outbox
   set status = 'skipped', skip_reason = 'cutover_reconciled', lease_token = null
 where id = '$started_id';
SQL

audit_result="$(docker exec -i "$db_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -tA -F '|' < "$test_dir/../../scripts/sql/audit-production-migration-effects.sql")"
grep -Fqx '20260804123000|push transport retired|t|no active push preference, subscription, active or uncertain push row, or exhausted nonterminal fallback' <<< "$audit_result"
