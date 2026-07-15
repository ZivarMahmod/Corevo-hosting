-- ▸ FIL: 0069_booking_resource_fence.sql
-- ▸ (döp SQL-Editor-fliken till detta — Supabase kallar den annars "Untitled query")

-- 0069 — Atomisk resursvakt för bokningar.
--
-- RLS avgränsar vilken booking-rad en tenant får uppdatera, men vanliga FK:n
-- säkerställer inte att staff/service/location tillhör SAMMA tenant. En direkt
-- PostgREST-skrivning kunde därför peka en egen bokning mot en annan tenants
-- medarbetare. Action-lagret validerar också för ett bra UI-svar, men triggern är
-- sanningen som stänger direktanrop och race conditions.

create or replace function private.enforce_booking_resource_fence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.staff st
      join public.staff_services ss
        on ss.staff_id = st.id
       and ss.service_id = new.service_id
      join public.services svc
        on svc.id = new.service_id
     where st.id = new.staff_id
       and st.tenant_id = new.tenant_id
       and st.active = true
       and ss.tenant_id = new.tenant_id
       and svc.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_staff' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
      from public.locations l
     where l.id = new.location_id
       and l.tenant_id = new.tenant_id
       and l.active = true
  ) then
    raise exception 'invalid_location' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
      from public.working_hours wh
     where wh.tenant_id = new.tenant_id
       and wh.staff_id = new.staff_id
       and wh.location_id = new.location_id
  ) then
    raise exception 'invalid_staff_location' using errcode = 'P0002';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_booking_resource_fence() from public;

drop trigger if exists trg_booking_resource_fence on public.bookings;
create trigger trg_booking_resource_fence
  before insert or update of tenant_id, location_id, staff_id, service_id
  on public.bookings
  for each row execute function private.enforce_booking_resource_fence();

comment on function private.enforce_booking_resource_fence() is
  'Atomisk tenant-, tjänst- och platsvakt för bookings-resurser.';
