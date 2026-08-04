#!/usr/bin/env bash
set -euo pipefail

db_container="${1:?database container required}"
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tenant_id='14000000-0000-4000-8000-000000000001'

psql() {
  docker exec -i "$db_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
}

cleanup() {
  psql <<SQL || true
delete from public.tenants where id = '$tenant_id';
alter table public.tenants enable trigger trg_tenant_launch_readiness;
SQL
}

trap cleanup EXIT
cleanup

# Recreate the pre-1400 schema surface in the disposable database, seed its
# legacy setting, then run the real migration. This replaces the deleted
# source-text contract with an executable historical-data proof.
psql <<SQL
alter table public.tenants disable trigger trg_tenant_launch_readiness;

insert into public.tenants (id, slug, name)
values ('$tenant_id', 'portal-mode-1400-upgrade', 'Portal mode 1400 upgrade');

insert into public.tenant_settings (tenant_id, settings)
values (
  '$tenant_id',
  jsonb_build_object(
    'customer_accounts_enabled', true,
    'preserved', jsonb_build_object('value', 'keep')
  )
)
on conflict (tenant_id) do update
set settings = excluded.settings;

alter table private.customer_portal_links
  drop constraint if exists customer_portal_links_booking_binding_check;
alter table private.customer_portal_links
  drop column if exists booking_id;

drop trigger if exists customer_portal_links_mode_guard
  on private.customer_portal_links;
drop trigger if exists customer_portal_sessions_mode_guard
  on private.customer_portal_sessions;
drop trigger if exists customer_booking_trusts_mode_guard
  on private.customer_booking_trusts;
drop trigger if exists customer_portal_challenges_mode_guard
  on private.customer_portal_challenges;
drop trigger if exists customer_portal_verified_contacts_mode_guard
  on private.customer_portal_verified_contacts;
drop trigger if exists customer_portal_contact_change_flows_mode_guard
  on private.customer_portal_contact_change_flows;

drop function if exists public.customer_portal_exchange_link(
  uuid, text, uuid, text, integer, uuid, text
);
create or replace function public.customer_portal_exchange_link(
  uuid, text, uuid, text, integer
) returns void
language plpgsql
as \$\$
begin
end
\$\$;
SQL

psql < "$test_dir/../migrations/20260804140000_customer_portal_mode_delivery.sql"

psql <<SQL
do \$\$
declare
  v_settings jsonb;
begin
  select settings into v_settings
    from public.tenant_settings
   where tenant_id = '$tenant_id';

  if v_settings #>> '{customer_portal,mode}' <> 'legacy_account'
     or v_settings #> '{customer_portal,mode_changed_at}' is null
     or v_settings ? 'customer_accounts_enabled'
     or v_settings #>> '{preserved,value}' <> 'keep' then
    raise exception 'legacy_customer_portal_mode_upgrade_invalid_%', v_settings;
  end if;
end
\$\$;
SQL
