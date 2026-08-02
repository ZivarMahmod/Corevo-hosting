begin;

create function pg_temp.seed_legacy_booking_module()
returns trigger
language plpgsql
as $$
begin
  insert into public.tenant_modules (tenant_id, module_key, state)
  values (new.id, 'booking', 'off');
  update public.tenant_modules set state = 'draft'
   where tenant_id = new.id and module_key = 'booking';
  update public.tenant_modules set state = 'live'
   where tenant_id = new.id and module_key = 'booking';
  return new;
end;
$$;

create trigger seed_legacy_booking_module
after insert on public.tenants
for each row execute function pg_temp.seed_legacy_booking_module();
