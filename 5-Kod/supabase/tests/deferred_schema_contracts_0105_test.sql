-- 0105 runtime: historical schema drift is restored without exposing dormant
-- slot-hold writes or the server-only shop order counter to client roles.
begin;

do $$
begin
  if to_regclass('public.slot_holds') is null then
    raise exception 'slot_holds_missing';
  end if;
  if to_regprocedure(
    'public.place_slot_hold(text,uuid,uuid,timestamptz,text,integer)'
  ) is null or to_regprocedure(
    'public.release_slot_hold(uuid,timestamptz,text)'
  ) is null or to_regprocedure(
    'public.prune_expired_slot_holds()'
  ) is null then
    raise exception 'slot_hold_rpc_missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.place_slot_hold(text,uuid,uuid,timestamptz,text,integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.release_slot_hold(uuid,timestamptz,text)',
    'EXECUTE'
  ) then
    raise exception 'dormant_slot_hold_rpc_exposed';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.prune_expired_slot_holds()',
    'EXECUTE'
  ) then
    raise exception 'slot_hold_prune_service_grant_missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'slot_holds'
      and policyname = 'slot_holds_scoped_read'
  ) then
    raise exception 'slot_holds_scoped_read_missing';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'slot_holds'
      and policyname in (
        'slot_holds_rls', 'slot_holds_public_read',
        'slot_holds_public_write', 'slot_holds_public_release'
      )
  ) then
    raise exception 'legacy_slot_hold_policy_present';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shop_order_counters'
      and policyname = 'shop_order_counters_client_deny_all'
      and qual = 'false'
      and with_check = 'false'
  ) then
    raise exception 'shop_order_counter_deny_policy_missing';
  end if;
  if has_table_privilege('anon', 'public.shop_order_counters', 'SELECT')
     or has_table_privilege('authenticated', 'public.shop_order_counters', 'UPDATE') then
    raise exception 'shop_order_counter_client_grant_present';
  end if;
end
$$;

rollback;
