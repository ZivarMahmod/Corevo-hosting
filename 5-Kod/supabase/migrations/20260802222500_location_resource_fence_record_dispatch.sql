-- A shared trigger must enter the table-specific branch before referencing
-- fields that do not exist on the other resource records.
create or replace function private.enforce_location_resource_fence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.locations l
    where l.id = new.location_id and l.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_location_resource' using errcode = 'P0002';
  end if;

  if coalesce((select auth.role()), '') = 'authenticated' then
    if not (
      (select private.is_location_admin(new.location_id))
      or (select private.can_access_tenant(new.tenant_id))
    ) then
      raise exception 'location_admin_required' using errcode = '42501';
    end if;
    if tg_table_name = 'location_opening_hours' then
      new.source := 'confirmed';
      new.confirmed_at := now();
      new.confirmed_by := (select auth.uid());
    elsif tg_table_name = 'location_closures' then
      new.created_by := (select auth.uid());
    end if;
  end if;

  if tg_table_name = 'location_opening_hours' then
    if new.confirmed_by is not null
       and not exists (
         select 1 from public.users u
         where u.id = new.confirmed_by and u.tenant_id = new.tenant_id
       )
       and not (
         coalesce((select auth.role()), '') = 'authenticated'
         and new.confirmed_by = (select auth.uid())
         and (select private.can_access_tenant(new.tenant_id))
       ) then
      raise exception 'invalid_opening_hours_confirmer' using errcode = 'P0002';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_location_resource_fence()
  from public, anon, authenticated, service_role;
