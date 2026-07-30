-- Goal 90 review corrections: capacity edges, restored state and legacy alt text.
begin;

create or replace function private.guard_goal90_event_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_taken integer;
begin
  if tg_op = 'DELETE' then
    if current_user not in ('postgres', 'supabase_admin')
       and (
         exists (
           select 1
             from public.event_registrations r
            where r.event_id = old.id
         )
         or exists (
           select 1
             from public.shop_order_items i
            where i.event_id = old.id
         )
       ) then
      raise exception 'event_has_registration_history' using errcode = '23503';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'open'
       or new.cancelled_at is not null
       or new.cancelled_by is not null
       or new.cancellation_reason is not null
       or new.lifecycle_version <> 0 then
      raise exception 'event_lifecycle_is_machine_owned' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.capacity is distinct from old.capacity
     or new.reserved_qty is distinct from old.reserved_qty then
    select coalesce(sum(r.party_size), 0)::integer
      into v_taken
      from public.event_registrations r
     where r.tenant_id = old.tenant_id
       and r.event_id = old.id
       and r.status = 'confirmed';
    if new.capacity is null
       or new.capacity < v_taken + coalesce(new.reserved_qty, 0) then
      raise exception 'event_capacity_below_occupancy'
        using errcode = '23514',
              detail = (v_taken + coalesce(new.reserved_qty, 0))::text;
    end if;
  end if;

  if current_user not in ('postgres', 'supabase_admin')
     and (
       new.status is distinct from old.status
       or new.cancelled_at is distinct from old.cancelled_at
       or new.cancelled_by is distinct from old.cancelled_by
       or new.cancellation_reason is distinct from old.cancellation_reason
       or new.lifecycle_version is distinct from old.lifecycle_version
     ) then
    raise exception 'event_lifecycle_is_machine_owned' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_goal90_event_lifecycle()
  from public, anon, authenticated, service_role;

create or replace function private.clear_goal90_restored_registration_cancellation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'cancelled' and new.status = 'confirmed' then
    new.cancelled_at := null;
    new.cancelled_by := null;
    new.cancellation_reason := null;
  end if;
  return new;
end;
$$;

revoke all on function private.clear_goal90_restored_registration_cancellation()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_goal90_registration_restore_clear
  on public.event_registrations;
create trigger trg_goal90_registration_restore_clear
  before update of status on public.event_registrations
  for each row
  execute function private.clear_goal90_restored_registration_cancellation();

-- The first gallery migration preferred a present-but-blank caption over the
-- reusable asset alt. Repair only those legacy rows it marked decorative.
update public.gallery_items g
   set alt_override = left(btrim(m.alt), 500),
       decorative = false
  from public.media_assets m
 where g.asset_id = m.id
   and g.tenant_id = m.tenant_id
   and g.decorative
   and g.alt_override is null
   and nullif(btrim(coalesce(g.caption, '')), '') is null
   and nullif(btrim(coalesce(m.alt, '')), '') is not null;

commit;
