-- 0076 — Plats-, schema- och behörighetsgrund för kundadmin.
--
-- Additiv grund före de atomiska bokningsoperationerna i 0077. Migrationen
-- gör platsadmin fail-closed, skiljer platsöppettider från personalens schema,
-- bevarar verkliga specialstarter och stänger kors-platskopplingar.

create extension if not exists btree_gist;

-- ── Explicit organisations-/platsscope på adminidentiteten. ────────────────
do $users_columns$
declare
  v_access_scope_was_missing boolean;
  v_primary_location_was_missing boolean;
begin
  select not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'users' and column_name = 'access_scope'
  ) into v_access_scope_was_missing;
  select not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'users' and column_name = 'primary_location_id'
  ) into v_primary_location_was_missing;

  alter table public.users
    add column if not exists access_scope text;
  alter table public.users
    add column if not exists primary_location_id uuid references public.locations(id) on delete set null;

  update public.users set access_scope = 'locations' where access_scope is null;
  alter table public.users alter column access_scope set default 'locations';
  alter table public.users alter column access_scope set not null;

  -- Endast första introduktionen översätter den gamla owner-semantiken. En
  -- återkörning får aldrig uppgradera en ny platsadmin till organisationsägare.
  if v_access_scope_was_missing then
    update public.users u
       set access_scope = 'organization'
      from public.roles r
     where r.id = u.role_id
       and r.tenant_id = u.tenant_id
       and r.level >= 6;
  end if;

  if v_primary_location_was_missing then
    update public.users u
       set primary_location_id = (
         select l.id
           from public.locations l
          where l.tenant_id = u.tenant_id and l.active = true
          order by l.is_primary desc, l.created_at, l.id
          limit 1
       )
     where u.access_scope = 'organization'
       and exists (
         select 1 from public.roles r
          where r.id = u.role_id and r.tenant_id = u.tenant_id and r.level >= 6
       );
  end if;
end
$users_columns$;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.users'::regclass
       and conname = 'users_access_scope_check'
  ) then
    alter table public.users
      add constraint users_access_scope_check
      check (access_scope in ('organization', 'locations'));
  end if;
end
$constraints$;

create index if not exists users_primary_location_idx
  on public.users (tenant_id, primary_location_id);

create table if not exists public.user_location_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, location_id)
);

create index if not exists user_location_access_tenant_idx
  on public.user_location_access (tenant_id);
create index if not exists user_location_access_location_idx
  on public.user_location_access (location_id, user_id);

-- Rollen förblir sann: både organisationsägare och platsadmin har samma befintliga
-- level 6-roll. Scope avgör räckvidden i explicita helpers/policies.
create or replace function private.role_level()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(
    case
      when u.status <> 'active' then 0
      when r.tenant_id is null then
        case when (select private.is_platform_admin()) then r.level else 0 end
      when r.tenant_id <> u.tenant_id then 0
      when r.level = 3 and not exists (
        select 1 from public.staff s
         where s.tenant_id = u.tenant_id
           and s.profile_id = u.id
           and s.active = true
      ) then 0
      else r.level
    end
  ), 0)
  from public.users u
  left join public.roles r on r.id = u.role_id
  where u.id = (select auth.uid())
$$;
revoke all on function private.role_level() from public;
grant execute on function private.role_level() to authenticated;

create or replace function private.has_organization_scope()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin()) or exists (
    select 1
      from public.users u
      join public.roles r on r.id = u.role_id
     where u.id = (select auth.uid())
       and u.status = 'active'
       and r.tenant_id = u.tenant_id
       and r.level >= 6
       and u.access_scope = 'organization'
  )
$$;
revoke all on function private.has_organization_scope() from public;
grant execute on function private.has_organization_scope() to authenticated;

create or replace function private.can_access_location(p_location uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin()) or exists (
    select 1
      from public.locations l
      join public.users u
        on u.id = (select auth.uid())
       and u.tenant_id = l.tenant_id
       and u.status = 'active'
      join public.roles r on r.id = u.role_id
     where l.id = p_location
       and l.active = true
       and r.tenant_id = u.tenant_id
       and (
         (r.level >= 6 and u.access_scope = 'organization')
         or (
           r.level >= 6
           and u.access_scope = 'locations'
           and exists (
             select 1 from public.user_location_access ula
              where ula.tenant_id = u.tenant_id
                and ula.user_id = u.id
                and ula.location_id = l.id
           )
         )
         or (
           r.level = 3
           and exists (
             select 1 from public.staff s
              where s.tenant_id = u.tenant_id
                and s.profile_id = u.id
                and s.location_id = l.id
                and s.active = true
           )
         )
       )
  )
$$;
revoke all on function private.can_access_location(uuid) from public;
grant execute on function private.can_access_location(uuid) to authenticated;

create or replace function private.has_any_location_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin()) or exists (
    select 1 from public.locations l
     where l.tenant_id = (select private.tenant_id())
       and l.active = true
       and (select private.can_access_location(l.id))
  )
$$;
revoke all on function private.has_any_location_access() from public;
grant execute on function private.has_any_location_access() to authenticated;

create or replace function private.is_location_admin(p_location uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin()) or exists (
    select 1
      from public.locations l
      join public.users u
        on u.id = (select auth.uid())
       and u.tenant_id = l.tenant_id
       and u.status = 'active'
      join public.roles r
        on r.id = u.role_id
       and r.tenant_id = u.tenant_id
       and r.level >= 6
     where l.id = p_location
       and l.active = true
       and (
         u.access_scope = 'organization'
         or (
           u.access_scope = 'locations'
           and exists (
             select 1 from public.user_location_access ula
              where ula.tenant_id = u.tenant_id
                and ula.user_id = u.id
                and ula.location_id = l.id
           )
         )
       )
  )
$$;
revoke all on function private.is_location_admin(uuid) from public;
grant execute on function private.is_location_admin(uuid) to authenticated;

create or replace function private.can_access_customer(p_customer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_platform_admin()) or exists (
    select 1
      from public.customers c
     where c.id = p_customer
       and c.tenant_id = (select private.tenant_id())
       and (
         c.auth_user_id = (select auth.uid())
         or (select private.has_organization_scope())
         or (
           (select private.role_level()) >= 3
           and exists (
             select 1 from public.bookings b
              where b.tenant_id = c.tenant_id
                and b.customer_id = c.id
                and (select private.can_access_location(b.location_id))
           )
         )
       )
  )
$$;
revoke all on function private.can_access_customer(uuid) from public;
grant execute on function private.can_access_customer(uuid) to authenticated;

create or replace function private.require_tenant_owner()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_tenant uuid := (select private.tenant_id());
begin
  if v_tenant is null or not (select private.has_organization_scope()) then
    raise exception 'owner_required' using errcode = '42501';
  end if;
  return v_tenant;
end;
$$;
revoke all on function private.require_tenant_owner() from public;

create or replace function private.require_location_admin(p_location uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_tenant uuid;
begin
  select l.tenant_id into v_tenant
    from public.locations l
   where l.id = p_location and l.active = true;
  if v_tenant is null
     or v_tenant is distinct from (select private.tenant_id())
     or not (select private.is_location_admin(p_location)) then
    raise exception 'location_admin_required' using errcode = '42501';
  end if;
  return v_tenant;
end;
$$;
revoke all on function private.require_location_admin(uuid) from public;

create or replace function private.guard_user_primary_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.primary_location_id is not null and not exists (
    select 1 from public.locations l
     where l.id = new.primary_location_id
       and l.tenant_id = new.tenant_id
       and l.active = true
  ) then
    raise exception 'invalid_primary_location' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_user_primary_location() from public;
drop trigger if exists trg_users_primary_location_fence on public.users;
create trigger trg_users_primary_location_fence
  before insert or update of tenant_id, primary_location_id on public.users
  for each row execute function private.guard_user_primary_location();

create or replace function private.guard_user_location_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    if (select auth.uid()) is null or new.user_id = (select auth.uid()) then
      raise exception 'location_access_self_grant_forbidden' using errcode = '42501';
    end if;
    if not (select private.has_organization_scope()) then
      raise exception 'owner_required' using errcode = '42501';
    end if;
    new.created_by := (select auth.uid());
  end if;

  if not exists (
    select 1
      from public.users u
      join public.roles r on r.id = u.role_id
     where u.id = new.user_id
       and u.tenant_id = new.tenant_id
       and u.status = 'active'
       and u.access_scope = 'locations'
       and r.tenant_id = u.tenant_id
       and r.level >= 6
  ) or not exists (
    select 1 from public.locations l
     where l.id = new.location_id
       and l.tenant_id = new.tenant_id
       and l.active = true
  ) then
    raise exception 'invalid_location_access_membership' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_user_location_access() from public;
drop trigger if exists trg_user_location_access_fence on public.user_location_access;
create trigger trg_user_location_access_fence
  before insert or update of tenant_id, user_id, location_id on public.user_location_access
  for each row execute function private.guard_user_location_access();

create or replace function public.set_my_primary_location(p_location uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or p_location is null
     or not (select private.can_access_location(p_location)) then
    raise exception 'invalid_or_forbidden_location' using errcode = '42501';
  end if;

  update public.users u
     set primary_location_id = p_location,
         updated_at = now()
   where u.id = (select auth.uid())
     and u.status = 'active';
  if not found then
    raise exception 'active_user_required' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.set_my_primary_location(uuid) from public, anon;
grant execute on function public.set_my_primary_location(uuid) to authenticated;

alter table public.user_location_access enable row level security;
drop policy if exists user_location_access_read on public.user_location_access;
create policy user_location_access_read on public.user_location_access
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or user_id = (select auth.uid())
    or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope()))
  );
drop policy if exists user_location_access_owner_insert on public.user_location_access;
create policy user_location_access_owner_insert on public.user_location_access
  for insert to authenticated
  with check (
    tenant_id = (select private.tenant_id())
    and (select private.has_organization_scope())
    and user_id <> (select auth.uid())
  );
drop policy if exists user_location_access_owner_delete on public.user_location_access;
create policy user_location_access_owner_delete on public.user_location_access
  for delete to authenticated
  using (
    tenant_id = (select private.tenant_id())
    and (select private.has_organization_scope())
    and user_id <> (select auth.uid())
  );
revoke all on table public.user_location_access from anon;
grant select, insert, delete on table public.user_location_access to authenticated;
grant select, insert, update, delete on table public.user_location_access to service_role;

-- ── Platsens öppettider, regler och tillfälliga stängningar. ───────────────
alter table public.locations
  add column if not exists slot_step_min int not null default 15,
  add column if not exists min_notice_min int not null default 0,
  add column if not exists max_advance_days int not null default 365;

do $constraints$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.locations'::regclass and conname='locations_slot_step_check') then
    alter table public.locations add constraint locations_slot_step_check check (slot_step_min between 1 and 240);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.locations'::regclass and conname='locations_min_notice_check') then
    alter table public.locations add constraint locations_min_notice_check check (min_notice_min between 0 and 525600);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.locations'::regclass and conname='locations_max_advance_check') then
    alter table public.locations add constraint locations_max_advance_check check (max_advance_days between 1 and 1095);
  end if;
end
$constraints$;

create table if not exists public.location_opening_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  source text not null check (source in ('confirmed', 'staff_union', 'default')),
  confirmed_at timestamptz,
  confirmed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check (end_time > start_time),
  check ((source = 'confirmed') = (confirmed_at is not null)),
  unique (location_id, weekday, start_time, end_time),
  exclude using gist (
    location_id with =,
    weekday with =,
    tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time, '[)') with &&
  )
);

create index if not exists location_opening_hours_tenant_location_idx
  on public.location_opening_hours (tenant_id, location_id, weekday);

create table if not exists public.location_closures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  reason text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check (end_ts > start_ts),
  exclude using gist (
    location_id with =,
    tstzrange(start_ts, end_ts, '[)') with &&
  )
);

create index if not exists location_closures_tenant_location_idx
  on public.location_closures (tenant_id, location_id, start_ts);

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
    if not (select private.is_location_admin(new.location_id)) then
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
       ) then
      raise exception 'invalid_opening_hours_confirmer' using errcode = 'P0002';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_location_resource_fence() from public;
drop trigger if exists trg_location_opening_hours_fence on public.location_opening_hours;
create trigger trg_location_opening_hours_fence
  before insert or update of tenant_id, location_id, confirmed_by on public.location_opening_hours
  for each row execute function private.enforce_location_resource_fence();
drop trigger if exists trg_location_closures_fence on public.location_closures;
create trigger trg_location_closures_fence
  before insert or update of tenant_id, location_id on public.location_closures
  for each row execute function private.enforce_location_resource_fence();

-- Befintliga pass slås ihop till verkliga intervallöar. Luckan mellan 09–12 och
-- 14–18 förblir stängd; endast överlappande/angränsande segment förenas.
insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source
)
with ordered as (
  select wh.tenant_id, wh.location_id, wh.weekday, wh.start_time, wh.end_time,
         max(wh.end_time) over (
           partition by wh.tenant_id, wh.location_id, wh.weekday
           order by wh.start_time, wh.end_time
           rows between unbounded preceding and 1 preceding
         ) as previous_max_end
    from public.working_hours wh
   where wh.location_id is not null
     and not exists (
       select 1 from public.location_opening_hours existing
        where existing.location_id = wh.location_id
          and existing.weekday = wh.weekday
     )
), marked as (
  select ordered.*,
         case when previous_max_end is null or start_time > previous_max_end then 1 else 0 end as starts_island
    from ordered
), islanded as (
  select marked.*,
         sum(starts_island) over (
           partition by tenant_id, location_id, weekday
           order by start_time, end_time
         ) as island_id
    from marked
)
select tenant_id, location_id, weekday,
       min(start_time), max(end_time), 'staff_union'
  from islanded
 group by tenant_id, location_id, weekday, island_id
on conflict (location_id, weekday, start_time, end_time) do nothing;

insert into public.location_opening_hours (
  tenant_id, location_id, weekday, start_time, end_time, source
)
select l.tenant_id, l.id, d.weekday, time '09:00', time '17:00', 'default'
  from public.locations l
 cross join generate_series(1, 5) as d(weekday)
 where not exists (
   select 1 from public.location_opening_hours loh where loh.location_id = l.id
 )
on conflict (location_id, weekday, start_time, end_time) do nothing;

alter table public.location_opening_hours enable row level security;
alter table public.location_closures enable row level security;

drop policy if exists location_opening_hours_read on public.location_opening_hours;
create policy location_opening_hours_read on public.location_opening_hours
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (select private.can_access_location(location_id))
        or (select private.role_level()) = 2
      )
    )
  );
drop policy if exists location_opening_hours_write on public.location_opening_hours;
create policy location_opening_hours_write on public.location_opening_hours
  for all to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.is_location_admin(location_id))))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.is_location_admin(location_id))));

drop policy if exists location_closures_read on public.location_closures;
create policy location_closures_read on public.location_closures
  for select to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.can_access_location(location_id))));
drop policy if exists location_closures_write on public.location_closures;
create policy location_closures_write on public.location_closures
  for all to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.is_location_admin(location_id))))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.is_location_admin(location_id))));

revoke all on table public.location_opening_hours, public.location_closures from anon;
grant select, insert, update, delete on table public.location_opening_hours, public.location_closures to authenticated;
grant select, insert, update, delete on table public.location_opening_hours, public.location_closures to service_role;

create or replace function public.save_location_booking_settings(
  p_location uuid,
  p_hours jsonb,
  p_slot_step_min int,
  p_min_notice_min int,
  p_max_advance_days int
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.require_location_admin(p_location));
begin
  if jsonb_typeof(p_hours) <> 'array'
     or jsonb_array_length(p_hours) > 28
     or p_slot_step_min not between 1 and 240
     or p_min_notice_min not between 0 and 525600
     or p_max_advance_days not between 1 and 1095 then
    raise exception 'invalid_location_booking_settings' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_hours)
        as h(weekday int, start_time time, end_time time)
     where h.weekday not between 0 and 6
        or h.start_time is null
        or h.end_time is null
        or h.end_time <= h.start_time
  ) then
    raise exception 'invalid_location_opening_hours' using errcode = '22023';
  end if;

  update public.locations l
     set slot_step_min = p_slot_step_min,
         min_notice_min = p_min_notice_min,
         max_advance_days = p_max_advance_days,
         updated_at = now()
   where l.id = p_location and l.tenant_id = v_tenant;

  delete from public.location_opening_hours loh
   where loh.tenant_id = v_tenant and loh.location_id = p_location;

  insert into public.location_opening_hours (
    tenant_id, location_id, weekday, start_time, end_time,
    source, confirmed_at, confirmed_by
  )
  select v_tenant, p_location, h.weekday, h.start_time, h.end_time,
         'confirmed', now(), (select auth.uid())
    from jsonb_to_recordset(p_hours)
      as h(weekday int, start_time time, end_time time);
end;
$$;
revoke execute on function public.save_location_booking_settings(uuid,jsonb,int,int,int) from public, anon;
grant execute on function public.save_location_booking_settings(uuid,jsonb,int,int,int) to authenticated;

-- ── Strukturerad frånvaro och platsfencade kundanteckningar. ───────────────
alter table public.time_off add column if not exists kind text;
update public.time_off
   set kind = case
     when lower(coalesce(reason, '')) ~ '(lunch|rast|break)' then 'break'
     when lower(coalesce(reason, '')) ~ '(sjuk|sick)' then 'sick'
     when lower(coalesce(reason, '')) ~ '(ledig|semester|leave|vacation)' then 'leave'
     else 'other'
   end
 where kind is null;
alter table public.time_off alter column kind set default 'other';
alter table public.time_off alter column kind set not null;
do $constraints$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.time_off'::regclass and conname='time_off_kind_check') then
    alter table public.time_off add constraint time_off_kind_check check (kind in ('break', 'leave', 'sick', 'other'));
  end if;
end
$constraints$;

alter table public.customer_notes add column if not exists location_id uuid references public.locations(id);

-- Endast entydiga legacy-noter platsmärks. En kund med bokningar på flera
-- platser behåller NULL och är därmed ägar-only tills en människa placerar noten.
with single_location as (
  select b.tenant_id, b.customer_id,
         (array_agg(distinct b.location_id))[1] as location_id
    from public.bookings b
   where b.customer_id is not null and b.location_id is not null
   group by b.tenant_id, b.customer_id
  having count(distinct b.location_id) = 1
)
update public.customer_notes cn
   set location_id = sl.location_id
  from single_location sl
 where cn.tenant_id = sl.tenant_id
   and cn.customer_id = sl.customer_id
   and cn.location_id is null;
create index if not exists customer_notes_location_idx
  on public.customer_notes (tenant_id, location_id, customer_id);

create or replace function private.enforce_customer_note_location_fence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.locations l
     where l.id = new.location_id and l.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_customer_note_location' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.customers c
     where c.id = new.customer_id and c.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_customer_note_resource' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_customer_note_location_fence() from public;
drop trigger if exists trg_customer_notes_location_fence on public.customer_notes;
create trigger trg_customer_notes_location_fence
  before insert or update of tenant_id, customer_id, location_id on public.customer_notes
  for each row execute function private.enforce_customer_note_location_fence();

drop policy if exists customer_notes_rls on public.customer_notes;
drop policy if exists customer_notes_location_read on public.customer_notes;
create policy customer_notes_location_read on public.customer_notes
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 3
      and (
        (select private.has_organization_scope())
        or (select private.can_access_location(location_id))
      )
    )
  );
drop policy if exists customer_notes_location_write on public.customer_notes;
create policy customer_notes_location_write on public.customer_notes
  for all to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 3
      and (
        (select private.has_organization_scope())
        or (select private.can_access_location(location_id))
      )
    )
  )
  with check (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 3
      and (
        (select private.has_organization_scope())
        or (select private.can_access_location(location_id))
      )
    )
  );

-- Kunder är organisationsidentiteter, men platsadmin/personal ser dem endast
-- genom en bokning på en åtkomlig plats. Ny kund för platsadmin skapas atomiskt
-- med första bokningen i 0077; fristående direktinsert är därför fail-closed.
drop policy if exists customers_role_read on public.customers;
drop policy if exists customers_staff_write on public.customers;
drop policy if exists customers_location_read on public.customers;
drop policy if exists customers_location_write on public.customers;
create policy customers_location_read on public.customers
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        auth_user_id = (select auth.uid())
        or (select private.has_organization_scope())
        or ((select private.role_level()) >= 3 and (select private.can_access_customer(id)))
      )
    )
  );
create policy customers_location_write on public.customers
  for all to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 3
      and (
        (select private.has_organization_scope())
        or (select private.can_access_customer(id))
      )
    )
  )
  with check (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 3
      and (
        (select private.has_organization_scope())
        or (select private.can_access_customer(id))
      )
    )
  );

drop policy if exists bookings_role_read on public.bookings;
drop policy if exists bookings_staff_insert on public.bookings;
drop policy if exists bookings_location_read on public.bookings;
drop policy if exists bookings_location_insert on public.bookings;
create policy bookings_location_read on public.bookings
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        customer_profile_id = (select auth.uid())
        or exists (
          select 1 from public.customers c
           where c.id = bookings.customer_id
             and c.tenant_id = bookings.tenant_id
             and c.auth_user_id = (select auth.uid())
        )
        or (select private.has_organization_scope())
        or (
          (select private.role_level()) >= 3
          and (select private.can_access_location(location_id))
        )
      )
    )
  );
create policy bookings_location_insert on public.bookings
  for insert to authenticated
  with check (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 3
      and (select private.can_access_location(location_id))
    )
  );

-- Frånvaro läses och administreras bara inom användarens plats; personalens
-- befintliga egenradsväg behålls.
drop policy if exists time_off_staff_read on public.time_off;
drop policy if exists time_off_admin_write on public.time_off;
drop policy if exists time_off_location_read on public.time_off;
drop policy if exists time_off_location_admin_write on public.time_off;
create policy time_off_location_read on public.time_off
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 3
      and (
        (select private.has_organization_scope())
        or (location_id is not null and (select private.can_access_location(location_id)))
      )
    )
  );
create policy time_off_location_admin_write on public.time_off
  for all to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and location_id is not null
      and (select private.is_location_admin(location_id))
    )
  )
  with check (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and location_id is not null
      and (select private.is_location_admin(location_id))
    )
  );

-- ── Hårt platsstaket för personal–tjänst-kopplingar. ───────────────────────
create or replace function private.enforce_service_location_fence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.locations l
     where l.id = new.location_id and l.tenant_id = new.tenant_id
  ) then
    raise exception 'invalid_service_location' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_service_location_fence() from public;
drop trigger if exists trg_services_location_fence on public.services;
create trigger trg_services_location_fence
  before insert or update of tenant_id, location_id on public.services
  for each row execute function private.enforce_service_location_fence();

create or replace function private.enforce_staff_service_fence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.staff s
      join public.services svc
        on svc.id = new.service_id
       and svc.tenant_id = new.tenant_id
     where s.id = new.staff_id
       and s.tenant_id = new.tenant_id
       and (svc.location_id is null or svc.location_id = s.location_id)
  ) then
    raise exception 'invalid_staff_service_resource' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_staff_service_fence() from public;

create or replace function private.guard_staff_service_location_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'staff' and exists (
    select 1
      from public.staff_services ss
      join public.services svc on svc.id = ss.service_id and svc.tenant_id = new.tenant_id
     where ss.staff_id = new.id
       and ss.tenant_id = new.tenant_id
       and svc.location_id is not null
       and svc.location_id is distinct from new.location_id
  ) then
    raise exception 'staff_location_has_incompatible_services' using errcode = 'P0002';
  elsif tg_table_name = 'services' and new.location_id is not null and exists (
    select 1
      from public.staff_services ss
      join public.staff s on s.id = ss.staff_id and s.tenant_id = new.tenant_id
     where ss.service_id = new.id
       and ss.tenant_id = new.tenant_id
       and s.location_id is distinct from new.location_id
  ) then
    raise exception 'service_location_has_incompatible_staff' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_staff_service_location_change() from public;
drop trigger if exists trg_staff_service_location_change on public.staff;
create trigger trg_staff_service_location_change
  before update of tenant_id, location_id on public.staff
  for each row execute function private.guard_staff_service_location_change();
drop trigger if exists trg_service_staff_location_change on public.services;
create trigger trg_service_staff_location_change
  before update of tenant_id, location_id on public.services
  for each row execute function private.guard_staff_service_location_change();

-- ── Ny personal är publik först när platsens öppettider är bekräftade. ─────
create or replace function public.create_staff_with_defaults(
  p_title text,
  p_location uuid default null,
  p_profile uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_location uuid;
  v_staff uuid;
  v_confirmed boolean;
begin
  if nullif(btrim(p_title), '') is null then
    raise exception 'staff_title_required' using errcode = '22023';
  end if;

  select l.id into v_location
    from public.locations l
    left join public.users u on u.id = (select auth.uid())
   where l.tenant_id = v_tenant
     and l.active = true
     and l.id = coalesce(p_location, u.primary_location_id)
   limit 1;
  if v_location is null then
    raise exception 'invalid_or_missing_location' using errcode = 'P0002';
  end if;
  perform private.require_location_admin(v_location);

  if p_profile is not null and not exists (
    select 1 from public.users u
     where u.id = p_profile and u.tenant_id = v_tenant
  ) then
    raise exception 'invalid_staff_profile' using errcode = 'P0002';
  end if;

  select exists (
    select 1
      from public.location_opening_hours loh
     where loh.tenant_id = v_tenant
       and loh.location_id = v_location
       and loh.confirmed_at is not null
  ) into v_confirmed;

  insert into public.staff (tenant_id, location_id, profile_id, title, active)
  values (v_tenant, v_location, p_profile, btrim(p_title), v_confirmed)
  returning id into v_staff;

  insert into public.staff_services (tenant_id, staff_id, service_id)
  select v_tenant, v_staff, svc.id
    from public.services svc
   where svc.tenant_id = v_tenant
     and svc.active = true
     and (svc.location_id is null or svc.location_id = v_location);

  if v_confirmed then
    insert into public.working_hours (
      tenant_id, staff_id, location_id, weekday, start_time, end_time
    )
    select v_tenant, v_staff, v_location,
           loh.weekday, loh.start_time, loh.end_time
      from public.location_opening_hours loh
     where loh.tenant_id = v_tenant
       and loh.location_id = v_location
       and loh.confirmed_at is not null;
  else
    insert into public.working_hours (
      tenant_id, staff_id, location_id, weekday, start_time, end_time
    )
    select v_tenant, v_staff, v_location, d.weekday, time '09:00', time '17:00'
      from generate_series(1, 5) as d(weekday);
  end if;

  return v_staff;
end;
$$;
revoke execute on function public.create_staff_with_defaults(text,uuid,uuid) from public, anon;
grant execute on function public.create_staff_with_defaults(text,uuid,uuid) to authenticated;

comment on function public.create_staff_with_defaults(text,uuid,uuid) is
  'Skapar platsfencad personal; publik först efter bekräftade platsöppettider.';

create or replace function public.set_staff_active(
  p_staff uuid,
  p_active boolean
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := (select private.tenant_id());
  v_location uuid;
  v_profile uuid;
  v_account_rows int := 0;
begin
  select s.location_id, s.profile_id
    into v_location, v_profile
    from public.staff s
   where s.id = p_staff and s.tenant_id = v_tenant;
  if v_location is null then
    raise exception 'invalid_staff' using errcode = 'P0002';
  end if;
  perform private.require_location_admin(v_location);

  if p_active then
    if not exists (
      select 1 from public.location_opening_hours loh
       where loh.tenant_id = v_tenant
         and loh.location_id = v_location
         and loh.confirmed_at is not null
    ) then
      raise exception 'staff_activation_requires_confirmed_opening_hours' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.working_hours wh
       where wh.tenant_id = v_tenant
         and wh.staff_id = p_staff
         and wh.location_id = v_location
    ) then
      raise exception 'staff_activation_requires_working_hours' using errcode = 'P0001';
    end if;
    if not exists (
      select 1
        from public.staff_services ss
        join public.services svc
          on svc.id = ss.service_id
         and svc.tenant_id = ss.tenant_id
         and svc.active = true
       where ss.tenant_id = v_tenant
         and ss.staff_id = p_staff
         and (svc.location_id is null or svc.location_id = v_location)
    ) then
      raise exception 'staff_activation_requires_matching_service' using errcode = 'P0001';
    end if;
  end if;

  update public.staff s
     set active = p_active
   where s.id = p_staff and s.tenant_id = v_tenant;

  if v_profile is not null then
    if p_active then
      update public.users u set status = 'active'
        from public.roles r
       where u.id = v_profile
         and u.tenant_id = v_tenant
         and u.status = 'inactive'
         and r.id = u.role_id
         and r.tenant_id = v_tenant
         and r.level = 3;
    else
      update public.users u set status = 'inactive'
        from public.roles r
       where u.id = v_profile
         and u.tenant_id = v_tenant
         and r.id = u.role_id
         and r.tenant_id = v_tenant
         and r.level = 3
         and not exists (
           select 1 from public.staff other_staff
            where other_staff.tenant_id = v_tenant
              and other_staff.profile_id = v_profile
              and other_staff.active = true
         );
    end if;
    get diagnostics v_account_rows = row_count;
  end if;
  return v_account_rows > 0;
end;
$$;
revoke execute on function public.set_staff_active(uuid,boolean) from public, anon;
grant execute on function public.set_staff_active(uuid,boolean) to authenticated;

-- ── Konvertera endast exakt verifierade genererade slotraster. ─────────────
create table if not exists private.working_hour_slots_0076_snapshot (
  slot_id uuid primary key,
  tenant_id uuid not null,
  staff_id uuid not null,
  location_id uuid,
  weekday int not null,
  start_time time not null,
  active boolean not null,
  created_at timestamptz not null,
  updated_at timestamptz,
  classification text not null,
  snapshot_at timestamptz not null default now()
);
revoke all on table private.working_hour_slots_0076_snapshot from public, anon, authenticated;

with actual_groups as (
  select s.tenant_id, s.staff_id, s.location_id, s.weekday,
         array_agg(s.start_time order by s.start_time) as actual_times
    from public.working_hour_slots s
   where s.active
   group by s.tenant_id, s.staff_id, s.location_id, s.weekday
), expected_groups as (
  select g.tenant_id, g.staff_id, g.location_id, g.weekday,
         array_agg(gs::time order by gs::time) as expected_times
    from actual_groups g
    join public.staff st
      on st.id = g.staff_id and st.tenant_id = g.tenant_id
    join public.working_hours wh
      on wh.tenant_id = g.tenant_id
     and wh.staff_id = g.staff_id
     and wh.location_id is not distinct from g.location_id
     and wh.weekday = g.weekday
   cross join lateral generate_series(
     date '2000-01-01' + wh.start_time,
     date '2000-01-01' + wh.end_time - make_interval(mins => coalesce(st.slot_step_min, 15)),
     make_interval(mins => coalesce(st.slot_step_min, 15))
   ) gs
   group by g.tenant_id, g.staff_id, g.location_id, g.weekday
), eligible as (
  select a.tenant_id, a.staff_id, a.location_id, a.weekday
    from actual_groups a
    join expected_groups e
      on e.tenant_id = a.tenant_id
     and e.staff_id = a.staff_id
     and e.location_id is not distinct from a.location_id
     and e.weekday = a.weekday
   where a.actual_times = e.expected_times
)
insert into private.working_hour_slots_0076_snapshot (
  slot_id, tenant_id, staff_id, location_id, weekday, start_time,
  active, created_at, updated_at, classification
)
select s.id, s.tenant_id, s.staff_id, s.location_id, s.weekday, s.start_time,
       s.active, s.created_at, s.updated_at, 'full_resolved_grid'
  from public.working_hour_slots s
  join eligible e
    on e.tenant_id = s.tenant_id
   and e.staff_id = s.staff_id
   and e.location_id is not distinct from s.location_id
   and e.weekday = s.weekday
on conflict (slot_id) do nothing;

delete from public.working_hour_slots s
 using private.working_hour_slots_0076_snapshot snap
 where snap.slot_id = s.id
   and snap.classification = 'full_resolved_grid';

-- ── Befintliga konfigurationstabeller får platsmedveten RLS. ───────────────
drop policy if exists tenant_config_read on public.locations;
drop policy if exists tenant_config_write on public.locations;
drop policy if exists locations_scoped_read on public.locations;
drop policy if exists locations_organization_write on public.locations;
create policy locations_scoped_read on public.locations
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (select private.has_organization_scope())
        or (select private.can_access_location(id))
        or (select private.role_level()) = 2
      )
    )
  );
create policy locations_organization_write on public.locations
  for all to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));

drop policy if exists tenant_config_read on public.staff;
drop policy if exists tenant_config_write on public.staff;
drop policy if exists staff_scoped_read on public.staff;
drop policy if exists staff_scoped_write on public.staff;
create policy staff_scoped_read on public.staff
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (select private.has_organization_scope())
        or (location_id is not null and (select private.can_access_location(location_id)))
        or (select private.role_level()) = 2
      )
    )
  );
create policy staff_scoped_write on public.staff
  for all to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and location_id is not null and (select private.is_location_admin(location_id))))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and location_id is not null and (select private.is_location_admin(location_id))));

drop policy if exists tenant_config_read on public.services;
drop policy if exists tenant_config_write on public.services;
drop policy if exists services_scoped_read on public.services;
drop policy if exists services_scoped_write on public.services;
create policy services_scoped_read on public.services
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (select private.has_organization_scope())
        or (location_id is null and (select private.has_any_location_access()))
        or (select private.can_access_location(location_id))
        or (select private.role_level()) = 2
      )
    )
  );
create policy services_scoped_write on public.services
  for all to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (location_id is null and (select private.has_organization_scope()))
        or (location_id is not null and (select private.is_location_admin(location_id)))
      )
    )
  )
  with check (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (location_id is null and (select private.has_organization_scope()))
        or (location_id is not null and (select private.is_location_admin(location_id)))
      )
    )
  );

drop policy if exists tenant_config_read on public.staff_services;
drop policy if exists tenant_config_write on public.staff_services;
drop policy if exists staff_services_scoped_read on public.staff_services;
drop policy if exists staff_services_scoped_write on public.staff_services;
create policy staff_services_scoped_read on public.staff_services
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (select private.has_organization_scope())
        or exists (
          select 1 from public.staff s
           where s.id = staff_services.staff_id
             and s.tenant_id = staff_services.tenant_id
             and s.location_id is not null
             and (select private.can_access_location(s.location_id))
        )
        or (select private.role_level()) = 2
      )
    )
  );
create policy staff_services_scoped_write on public.staff_services
  for all to authenticated
  using (
    (select private.is_platform_admin())
    or exists (
      select 1 from public.staff s
       where s.id = staff_services.staff_id
         and s.tenant_id = (select private.tenant_id())
         and s.location_id is not null
         and (select private.is_location_admin(s.location_id))
    )
  )
  with check (
    (select private.is_platform_admin())
    or exists (
      select 1 from public.staff s
       where s.id = staff_services.staff_id
         and s.tenant_id = (select private.tenant_id())
         and s.location_id is not null
         and (select private.is_location_admin(s.location_id))
    )
  );

drop policy if exists tenant_config_read on public.working_hours;
drop policy if exists tenant_config_write on public.working_hours;
drop policy if exists working_hours_scoped_read on public.working_hours;
drop policy if exists working_hours_scoped_write on public.working_hours;
create policy working_hours_scoped_read on public.working_hours
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (select private.has_organization_scope())
        or (location_id is not null and (select private.can_access_location(location_id)))
        or (select private.role_level()) = 2
      )
    )
  );
create policy working_hours_scoped_write on public.working_hours
  for all to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and location_id is not null and (select private.is_location_admin(location_id))))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and location_id is not null and (select private.is_location_admin(location_id))));

drop policy if exists tenant_config_read on public.working_hour_slots;
drop policy if exists tenant_config_write on public.working_hour_slots;
drop policy if exists working_hour_slots_scoped_read on public.working_hour_slots;
drop policy if exists working_hour_slots_scoped_write on public.working_hour_slots;
create policy working_hour_slots_scoped_read on public.working_hour_slots
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (select private.has_organization_scope())
        or (location_id is not null and (select private.can_access_location(location_id)))
        or (select private.role_level()) = 2
      )
    )
  );
create policy working_hour_slots_scoped_write on public.working_hour_slots
  for all to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and location_id is not null and (select private.is_location_admin(location_id))))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and location_id is not null and (select private.is_location_admin(location_id))));

-- ── Inventera gamla level-6-vakter: level 6 är en roll, inte owner-scope. ───
-- Tabeller utan platsdimension förblir organisationsägarytor tills domänen har
-- en uttrycklig platsmodell. Därmed är betalning, konto, moduler och globalt
-- innehåll fail-closed för platsadmin trots samma grundroll.
drop policy if exists roles_scoped_read on public.roles;
create policy roles_scoped_read on public.roles
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or id = (select u.role_id from public.users u where u.id = (select auth.uid()))
    or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope()))
  );

drop policy if exists users_role_read on public.users;
create policy users_role_read on public.users
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (id = (select auth.uid()) or (select private.has_organization_scope()))
    )
  );
drop policy if exists users_admin_insert on public.users;
create policy users_admin_insert on public.users
  for insert to authenticated
  with check (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.has_organization_scope())
      and exists (
        select 1 from public.roles r
         where r.id = role_id
           and r.tenant_id = users.tenant_id
           and r.level <= (select private.role_level())
      )
    )
  );

drop policy if exists tenants_admin_update on public.tenants;
create policy tenants_admin_update on public.tenants
  for update to authenticated
  using ((select private.is_platform_admin()) or (id = (select private.tenant_id()) and (select private.has_organization_scope())))
  with check ((select private.is_platform_admin()) or (id = (select private.tenant_id()) and (select private.has_organization_scope())));

drop policy if exists tenant_settings_admin_insert on public.tenant_settings;
create policy tenant_settings_admin_insert on public.tenant_settings
  for insert to authenticated
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));
drop policy if exists tenant_settings_admin_update on public.tenant_settings;
create policy tenant_settings_admin_update on public.tenant_settings
  for update to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));

drop policy if exists tenant_modules_write on public.tenant_modules;
create policy tenant_modules_write on public.tenant_modules
  for update to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));

-- Slot-holds saknar egen location_id, men personalen de tillhör har det.
-- Platsadmin får därför bara läsa holds för personal på tilldelade platser.
-- 0014 är medvetet uppskjuten i vissa äldre miljöer; samma migration ska därför
-- fungera både med och utan tabellen.
do $slot_holds_policy$
begin
  if to_regclass('public.slot_holds') is not null then
    execute 'drop policy if exists slot_holds_admin_read on public.slot_holds';
    execute 'drop policy if exists slot_holds_scoped_read on public.slot_holds';
    execute $policy$
      create policy slot_holds_scoped_read on public.slot_holds
        for select to authenticated
        using (
          (select private.is_platform_admin())
          or (
            tenant_id = (select private.tenant_id())
            and (
              (select private.has_organization_scope())
              or (
                (select private.role_level()) >= 3
                and exists (
                  select 1 from public.staff s
                   where s.id = slot_holds.staff_id
                     and s.tenant_id = slot_holds.tenant_id
                     and s.location_id is not null
                     and (select private.can_access_location(s.location_id))
                )
              )
            )
          )
        )
    $policy$;
  end if;
end;
$slot_holds_policy$;

do $organization_policy_inventory$
declare
  t text;
begin
  foreach t in array array[
    'blog_posts', 'content_slots', 'media_assets',
    'offert_requests', 'shop_product_variants', 'shop_products', 'tenant_events'
  ] loop
    execute format('drop policy if exists admin_private_data_read on public.%I', t);
    execute format('drop policy if exists admin_private_data_write on public.%I', t);
    execute format(
      'create policy admin_private_data_read on public.%I for select to authenticated '
      || 'using ((select private.is_platform_admin()) or '
      || '(tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())))',
      t
    );
    execute format(
      'create policy admin_private_data_write on public.%I for all to authenticated '
      || 'using ((select private.is_platform_admin()) or '
      || '(tenant_id = (select private.tenant_id()) and (select private.has_organization_scope()))) '
      || 'with check ((select private.is_platform_admin()) or '
      || '(tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())))',
      t
    );
  end loop;

  foreach t in array array[
    'event_registrations', 'gift_cards', 'payment_disputes',
    'shop_order_items', 'shop_orders'
  ] loop
    execute format('drop policy if exists admin_private_data_read on public.%I', t);
    execute format(
      'create policy admin_private_data_read on public.%I for select to authenticated '
      || 'using ((select private.is_platform_admin()) or '
      || '(tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())))',
      t
    );
  end loop;
end
$organization_policy_inventory$;

drop policy if exists contact_messages_admin_read on public.contact_messages;
create policy contact_messages_admin_read on public.contact_messages
  for select to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));
drop policy if exists contact_messages_admin_write on public.contact_messages;
create policy contact_messages_admin_write on public.contact_messages
  for update to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));

drop policy if exists gallery_items_admin_read on public.gallery_items;
create policy gallery_items_admin_read on public.gallery_items
  for select to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));
drop policy if exists gallery_items_admin_write on public.gallery_items;
create policy gallery_items_admin_write on public.gallery_items
  for all to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));

drop policy if exists loyalty_plans_admin_read on public.loyalty_plans;
create policy loyalty_plans_admin_read on public.loyalty_plans
  for select to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));
drop policy if exists loyalty_plans_admin_write on public.loyalty_plans;
create policy loyalty_plans_admin_write on public.loyalty_plans
  for all to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));

drop policy if exists shop_shipping_options_admin_read on public.shop_shipping_options;
create policy shop_shipping_options_admin_read on public.shop_shipping_options
  for select to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));
drop policy if exists shop_shipping_options_admin_write on public.shop_shipping_options;
create policy shop_shipping_options_admin_write on public.shop_shipping_options
  for all to authenticated
  using ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())))
  with check ((select private.is_platform_admin()) or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope())));

drop policy if exists loyalty_members_scoped_read on public.loyalty_members;
create policy loyalty_members_scoped_read on public.loyalty_members
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope()))
    or exists (
      select 1 from public.customers c
       where c.id = loyalty_members.customer_id
         and c.tenant_id = loyalty_members.tenant_id
         and c.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists event_registrations_owner_update on public.event_registrations;
create policy event_registrations_owner_update on public.event_registrations
  for update to authenticated
  using (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope()))
  with check (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope()));
drop policy if exists gift_cards_owner_insert on public.gift_cards;
create policy gift_cards_owner_insert on public.gift_cards
  for insert to authenticated
  with check (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope()));
drop policy if exists gift_cards_owner_update on public.gift_cards;
create policy gift_cards_owner_update on public.gift_cards
  for update to authenticated
  using (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope()))
  with check (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope()));
drop policy if exists shop_orders_owner_update on public.shop_orders;
create policy shop_orders_owner_update on public.shop_orders
  for update to authenticated
  using (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope()))
  with check (tenant_id = (select private.tenant_id()) and (select private.has_organization_scope()));

create or replace function public.set_primary_location(p_location uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_tenant uuid := (select private.require_tenant_owner());
begin
  if not exists (
    select 1 from public.locations l
     where l.id = p_location and l.tenant_id = v_tenant and l.active
  ) then
    raise exception 'invalid_location' using errcode = 'P0002';
  end if;
  update public.locations set is_primary = false, updated_at = now()
   where tenant_id = v_tenant and is_primary and id <> p_location;
  update public.locations set is_primary = true, updated_at = now()
   where id = p_location and tenant_id = v_tenant;
end;
$$;
revoke all on function public.set_primary_location(uuid) from public, anon;
grant execute on function public.set_primary_location(uuid) to authenticated;

comment on table public.user_location_access is
  'Explicit fail-closed medlemskap för platsbegränsad admin. Noll rader ger noll platsåtkomst.';
comment on table public.location_opening_hours is
  'Platsens öppettider med provenance och uttrycklig bekräftelse.';
comment on table public.location_closures is
  'Tillfälliga stängningar för en hel plats.';
