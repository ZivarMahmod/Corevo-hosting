-- Neutral, cookie-bound security inventory for Goal 75.
-- No raw public ids, digests, IP addresses or user-agent strings leave the RPC.

create or replace function public.customer_portal_security_snapshot(
  p_session_public_id uuid,
  p_secret_digest text
) returns table (outcome text, security jsonb, recovery_tenant_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_now timestamptz := statement_timestamp();
  v_security jsonb;
begin
  select * into v_session
  from private.customer_portal_resolve_session(
    p_session_public_id, p_secret_digest, v_now
  );

  if not found then
    return query select 'expired'::text, null::jsonb, null::text;
    return;
  end if;

  select pg_catalog.jsonb_build_object(
    'sessions',
    coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'label', s.device_label,
          'isCurrent', s.id = v_session.session_id,
          'createdAt', s.created_at,
          'lastSeenAt', s.last_seen_at
        )
        order by (s.id = v_session.session_id) desc, s.last_seen_at desc
      )
      from private.customer_portal_sessions s
      where s.tenant_id = v_session.tenant_id
        and s.customer_id = v_session.customer_id
        and s.revoked_at is null
        and s.idle_expires_at > v_now
        and s.absolute_expires_at > v_now
    ), '[]'::jsonb),
    'bookingTrusts',
    coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'label', t.device_label,
          'createdAt', t.created_at,
          'lastSeenAt', t.last_seen_at
        )
        order by t.last_seen_at desc
      )
      from private.customer_booking_trusts t
      where t.tenant_id = v_session.tenant_id
        and t.customer_id = v_session.customer_id
        and t.revoked_at is null
        and t.idle_expires_at > v_now
        and t.absolute_expires_at > v_now
    ), '[]'::jsonb)
  ) into v_security;

  return query select 'ok'::text, v_security, null::text;
end;
$$;

revoke all on function public.customer_portal_security_snapshot(uuid, text)
  from public, anon, authenticated;
grant execute on function public.customer_portal_security_snapshot(uuid, text) to service_role;
