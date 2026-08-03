-- Let an existing customer reach its ON CONFLICT update while keeping each
-- verified contact unique across different customer identities.
create or replace function private.customer_portal_guard_customer_contact_uniqueness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel text;
  v_raw text;
  v_normalized text;
  v_now timestamptz := statement_timestamp();
  v_contact_changed boolean;
begin
  v_contact_changed := false;
  if tg_op = 'UPDATE' then
    v_contact_changed := new.tenant_id is distinct from old.tenant_id
      or new.phone is distinct from old.phone
      or new.email is distinct from old.email
      or new.status is distinct from old.status;
  end if;

  if v_contact_changed then
    update private.customer_portal_verified_contacts verified
    set revoked_at = coalesce(verified.revoked_at, v_now)
    where verified.tenant_id = old.tenant_id
      and verified.customer_id = old.id
      and verified.revoked_at is null
      and (
        new.tenant_id is distinct from old.tenant_id
        or new.status is distinct from old.status
        or (verified.channel = 'sms' and new.phone is distinct from old.phone)
        or (verified.channel = 'email' and new.email is distinct from old.email)
      );
    update private.customer_portal_sessions session_row
    set revoked_at = coalesce(session_row.revoked_at, v_now)
    where session_row.tenant_id = old.tenant_id
      and session_row.customer_id = old.id
      and session_row.revoked_at is null;
    update private.customer_booking_trusts trust_row
    set revoked_at = coalesce(trust_row.revoked_at, v_now)
    where trust_row.tenant_id = old.tenant_id
      and trust_row.customer_id = old.id
      and trust_row.revoked_at is null;
    update private.customer_portal_links link_row
    set revoked_at = coalesce(link_row.revoked_at, v_now)
    where link_row.tenant_id = old.tenant_id
      and link_row.customer_id = old.id
      and link_row.revoked_at is null
      and link_row.consumed_at is null;
    update private.customer_portal_challenges challenge_row
    set revoked_at = coalesce(challenge_row.revoked_at, v_now)
    where challenge_row.tenant_id = old.tenant_id
      and challenge_row.customer_id = old.id
      and challenge_row.revoked_at is null
      and challenge_row.consumed_at is null;
  end if;

  if new.status <> 'active' then return new; end if;

  for v_channel, v_raw in
    select candidate.channel, candidate.raw_value
    from (values ('sms'::text, new.phone), ('email'::text, new.email)) candidate(channel, raw_value)
  loop
    if v_raw is null or (
      tg_op = 'UPDATE'
      and new.tenant_id is not distinct from old.tenant_id
      and new.status is not distinct from old.status
      and (
        (v_channel = 'sms' and new.phone is not distinct from old.phone)
        or (v_channel = 'email' and new.email is not distinct from old.email)
      )
    ) then continue; end if;

    select normalized.normalized into v_normalized
    from private.customer_portal_normalize_recovery_lookup(v_raw) normalized
    where normalized.channel = v_channel;
    if not found then continue; end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      new.tenant_id::text || ':' || v_channel || ':' || v_normalized, 0
    ));
    if exists (
      select 1
      from public.customers existing
      cross join lateral private.customer_portal_normalize_recovery_lookup(
        case when v_channel = 'sms' then existing.phone else existing.email end
      ) normalized
      where existing.tenant_id = new.tenant_id
        and existing.id <> new.id
        and existing.status = 'active'
        and normalized.channel = v_channel
        and normalized.normalized = v_normalized
        and not (
          tg_op = 'INSERT'
          and (
            (new.contact_hash is not null and existing.contact_hash = new.contact_hash)
            or (new.auth_user_id is not null and existing.auth_user_id = new.auth_user_id)
          )
        )
    ) then
      raise unique_violation using message = 'customer_contact_conflict';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.customer_portal_guard_customer_contact_uniqueness()
  from public, anon, authenticated, service_role;
