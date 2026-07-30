-- Keep manual gift-card value commands fail-closed even when an authenticated
-- tenant admin calls the RPC directly instead of going through the web app.
begin;

create table private.gift_card_value_releases (
  tenant_id   uuid primary key references public.tenants(id) on delete cascade,
  reviewed_at timestamptz not null default pg_catalog.now()
);
revoke all on table private.gift_card_value_releases
  from public, anon, authenticated, service_role;

create or replace function private.require_gift_card_value_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.entry_type in ('issue', 'redeem', 'adjustment')
     and not exists (
       select 1
         from private.gift_card_value_releases r
        where r.tenant_id = new.tenant_id
     )
  then
    raise exception 'gift_card_value_not_released' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.require_gift_card_value_release()
  from public, anon, authenticated, service_role;

create trigger trg_gift_card_entries_release
  before insert on public.gift_card_entries
  for each row execute function private.require_gift_card_value_release();

commit;
