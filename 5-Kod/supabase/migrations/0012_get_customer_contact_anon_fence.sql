-- ============================================================================
-- 0012 — APPLICERAD 2026-06-02 mot clylvowtowbtotrahuad (Zivar-godkänd, additiv).
-- Härdar get_customer_contact mot anon/identitetslös åtkomst (PII-läcka i 0011).
--
-- BUGGEN: get_customer_contact (0011) är anon-grantbar via PostgREST (Supabase
-- default-grant till anon överlever en PUBLIC-revoke), och anon-nyckeln ligger i
-- storefront-bundlen. Med anon-anrop blir v_tenant/v_uid NULL → access-fence-
-- uttrycket blir SQL-NULL → plpgsql behandlar `IF NULL` som false → ingen raise →
-- funktionen faller igenom och returnerar kundens namn/e-post/telefon.
--
-- FIX: (1) create or replace med en NULL-identitet-guard FÖRST (raise forbidden),
-- (2) revoke execute från anon på get_customer_contact OCH seed_explicit_slots_
-- from_hours (defense-in-depth). Samma signatur → ingen types-regen.
-- ============================================================================

create or replace function public.get_customer_contact(
  p_customer    uuid,
  p_before_h    int default 720,
  p_after_h     int default 24
) returns table (display_name text, full_name text, email text, phone text, pii_visible boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant  uuid := (select private.tenant_id());
  v_level   int  := (select private.role_level());
  v_uid     uuid := (select auth.uid());
  v_row     public.customers%rowtype;
  v_in_win  boolean;
begin
  -- HÄRDNING (0012): avvisa anon / identitetslösa anropare först. En NULL-identitet
  -- gör fence-uttrycket nedan NULL (som IF behandlar som false) → annars faller det
  -- igenom och läcker PII via den anon-exponerade RPC:n.
  if v_uid is null or (v_tenant is null and not (select private.is_platform_admin())) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.customers c where c.id = p_customer;
  if v_row.id is null then return; end if;

  if not (
    (select private.is_platform_admin())
    or (v_row.tenant_id = v_tenant
        and (v_level >= 3 or v_row.auth_user_id = v_uid))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.bookings b
     where b.customer_id = p_customer
       and b.status in ('pending','confirmed','completed')
       and b.start_ts between (now() - make_interval(hours => p_before_h))
                          and (now() + make_interval(hours => p_after_h))
  ) into v_in_win;

  v_in_win := v_in_win or (v_row.auth_user_id = v_uid);

  display_name := coalesce(v_row.display_name,
                    case when v_row.name_hidden then left(coalesce(v_row.full_name,''),1) else v_row.full_name end);
  pii_visible  := v_in_win;
  full_name    := case when v_in_win and not v_row.name_hidden then v_row.full_name else null end;
  email        := case when v_in_win then v_row.email else null end;
  phone        := case when v_in_win then v_row.phone else null end;
  return next;
end;
$$;
revoke all     on function public.get_customer_contact(uuid, int, int) from public;
revoke execute on function public.get_customer_contact(uuid, int, int) from anon;
grant  execute on function public.get_customer_contact(uuid, int, int) to authenticated;

-- Defense-in-depth: seed_explicit_slots_from_hours har en intern tenant-fence men
-- är anon-grantbar — revoke så den inte ens kan anropas av anon.
revoke execute on function public.seed_explicit_slots_from_hours(uuid, int) from anon;
