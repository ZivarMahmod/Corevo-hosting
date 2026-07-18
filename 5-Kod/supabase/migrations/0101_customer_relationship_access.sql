-- 0101 — Relationens PII-gräns följer tenant, roll, plats och driftfönster.
-- Ersätter samma publika RPC-signatur; inga tabeller eller kundidentiteter ändras.

create or replace function public.get_customer_contact(
  p_customer uuid,
  p_before_h int default 720,
  p_after_h int default 24
) returns table (
  display_name text,
  full_name text,
  email text,
  phone text,
  pii_visible boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- Behåll RPC-signaturen för bakåtkompatibilitet, men låt aldrig en
  -- Data API-anropare vidga den centrala driftpolicyn med egna argument.
  v_before_h constant int := 720;
  v_after_h constant int := 24;
  v_tenant uuid := (select private.tenant_id());
  v_uid uuid := (select auth.uid());
  v_level int := (select private.role_level());
  v_platform boolean := (select private.is_platform_admin());
  v_org_scope boolean := (select private.has_organization_scope());
  v_row public.customers%rowtype;
  v_customer_self boolean := false;
  v_staff_allowed boolean := false;
  v_in_window boolean := false;
begin
  if v_uid is null or (v_tenant is null and not v_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row
    from public.customers c
   where c.id = p_customer;
  if v_row.id is null then return; end if;

  v_customer_self :=
    v_row.tenant_id = v_tenant
    and coalesce(v_row.auth_user_id = v_uid, false);
  v_staff_allowed :=
    v_row.tenant_id = v_tenant
    and v_level >= 3
    and (v_org_scope or (select private.can_access_customer(p_customer)));

  if not coalesce(v_platform or v_customer_self or v_staff_allowed, false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_customer_self then
    v_in_window := true;
  else
    select exists (
      select 1
        from public.bookings b
       where b.tenant_id = v_row.tenant_id
         and b.customer_id = p_customer
         and b.status in ('pending', 'confirmed', 'completed')
         and b.start_ts between (now() - make_interval(hours => v_before_h))
                            and (now() + make_interval(hours => v_after_h))
         and (
           v_platform
           or v_org_scope
           or (v_level >= 3 and (select private.can_access_location(b.location_id)))
         )
    ) into v_in_window;
  end if;

  display_name := case
    when v_row.name_hidden then
      nullif(left(btrim(coalesce(v_row.full_name, '')), 1), '')
    else coalesce(nullif(btrim(v_row.display_name), ''), nullif(btrim(v_row.full_name), ''))
  end;
  pii_visible := v_in_window;
  full_name := case when v_in_window and not v_row.name_hidden then v_row.full_name else null end;
  email := case when v_in_window then v_row.email else null end;
  phone := case when v_in_window then v_row.phone else null end;
  return next;
end;
$$;

revoke all on function public.get_customer_contact(uuid, int, int)
  from public, anon, authenticated, service_role;
grant execute on function public.get_customer_contact(uuid, int, int)
  to authenticated;
