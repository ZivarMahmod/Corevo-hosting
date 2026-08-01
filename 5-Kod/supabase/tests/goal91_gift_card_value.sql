-- Goal 91 gift-card runtime contract. Every fixture is rolled back.
begin;

select pg_catalog.set_config('request.jwt.claim.sub', '', true);
select pg_catalog.set_config('request.jwt.claim.role', '', true);
select pg_catalog.set_config('request.jwt.claims', '{}', true);

alter table public.tenants disable trigger trg_tenant_launch_readiness;
insert into public.tenants (id, slug, name, status) values
  ('91000000-0000-0000-0000-000000000001', 'goal91-gift-a', 'Goal 91 Gift A', 'active'),
  ('91000000-0000-0000-0000-000000000002', 'goal91-gift-b', 'Goal 91 Gift B', 'active');
alter table public.tenants enable trigger trg_tenant_launch_readiness;

insert into public.tenant_modules (tenant_id, module_key, state, config) values
  ('91000000-0000-0000-0000-000000000001', 'presentkort', 'off', '{}'),
  ('91000000-0000-0000-0000-000000000002', 'presentkort', 'off', '{}');
update public.tenant_modules
   set state = 'draft'
 where tenant_id in (
   '91000000-0000-0000-0000-000000000001',
   '91000000-0000-0000-0000-000000000002'
 )
   and module_key = 'presentkort';
update public.tenant_modules
   set state = 'live'
 where tenant_id in (
   '91000000-0000-0000-0000-000000000001',
   '91000000-0000-0000-0000-000000000002'
 )
   and module_key = 'presentkort';

insert into private.gift_card_value_releases (tenant_id)
values ('91000000-0000-0000-0000-000000000001');

do $$
begin
  if pg_catalog.to_regclass('public.gift_card_entries') is null
     or pg_catalog.to_regclass('private.gift_card_value_releases') is null
     or pg_catalog.to_regprocedure(
       'public.issue_gift_card(uuid,text,text,integer,text,text,text,text,timestamptz,uuid)'
     ) is null
     or pg_catalog.has_table_privilege('authenticated', 'public.gift_cards', 'insert')
     or pg_catalog.has_table_privilege('authenticated', 'public.gift_card_entries', 'insert')
     or pg_catalog.has_table_privilege(
       'authenticated',
       'private.gift_card_value_releases',
       'select'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.redeem_gift_card(uuid,text,integer,text,uuid,text,text)',
       'execute'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.restore_gift_card_redemption(uuid,uuid,uuid,text)',
       'execute'
     ) then
    raise exception 'goal91_gift_schema_or_grants_invalid';
  end if;
end
$$;

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
declare
  v_issue jsonb;
  v_retry jsonb;
  v_redeem jsonb;
  v_restore jsonb;
  v_card uuid;
  v_redeem_entry uuid;
  v_hash constant text := 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
begin
  begin
    perform public.issue_gift_card(
      '91000000-0000-0000-0000-000000000002',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'B91F',
      10000,
      'SEK',
      null,
      null,
      null,
      '2099-01-01 00:00:00+00',
      '91000000-0000-4000-8000-000000000100'
    );
    raise exception 'gift_unreleased_direct_rpc_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'gift_card_value_not_released' then raise; end if;
  end;

  v_issue := public.issue_gift_card(
    '91000000-0000-0000-0000-000000000001',
    v_hash,
    'A91F',
    100000,
    'SEK',
    'Ada',
    'ada@example.test',
    'Grattis',
    '2099-01-01 00:00:00+00',
    '91000000-0000-4000-8000-000000000101'
  );
  v_retry := public.issue_gift_card(
    '91000000-0000-0000-0000-000000000001',
    v_hash,
    'A91F',
    100000,
    'SEK',
    'Ada',
    'ada@example.test',
    'Grattis',
    '2099-01-01 00:00:00+00',
    '91000000-0000-4000-8000-000000000101'
  );
  if v_issue is distinct from v_retry then
    raise exception 'gift_issue_retry_changed_result';
  end if;
  v_card := (v_issue ->> 'gift_card_id')::uuid;

  if (
    select pg_catalog.count(*)
      from public.gift_cards g
     where g.id = v_card
       and g.code = 'redacted:' || g.id::text
       and g.code_hash = v_hash
       and g.code_last_four = 'A91F'
  ) <> 1
  or (
    select pg_catalog.count(*)
      from public.gift_card_entries e
     where e.gift_card_id = v_card
       and e.entry_type = 'issue'
  ) <> 1 then
    raise exception 'gift_issue_not_exactly_once';
  end if;

  begin
    perform public.issue_gift_card(
      '91000000-0000-0000-0000-000000000001',
      v_hash,
      'A91F',
      200000,
      'SEK',
      'Ada',
      'ada@example.test',
      'Grattis',
      '2099-01-01 00:00:00+00',
      '91000000-0000-4000-8000-000000000101'
    );
    raise exception 'gift_issue_changed_payload_succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'gift_card_idempotency_conflict' then raise; end if;
  end;

  v_redeem := public.redeem_gift_card(
    '91000000-0000-0000-0000-000000000001',
    v_hash,
    40000,
    'SEK',
    '91000000-0000-4000-8000-000000000102',
    'admin',
    null
  );
  v_redeem_entry := (v_redeem ->> 'entry_id')::uuid;
  if (v_redeem ->> 'balance_cents')::integer <> 60000 then
    raise exception 'gift_partial_redeem_wrong_balance';
  end if;

  if public.redeem_gift_card(
    '91000000-0000-0000-0000-000000000001',
    v_hash,
    40000,
    'SEK',
    '91000000-0000-4000-8000-000000000102',
    'admin',
    null
  ) is distinct from v_redeem then
    raise exception 'gift_redeem_retry_changed_result';
  end if;

  begin
    perform public.redeem_gift_card(
      '91000000-0000-0000-0000-000000000001',
      v_hash,
      70000,
      'SEK',
      '91000000-0000-4000-8000-000000000103',
      'admin',
      null
    );
    raise exception 'gift_overspend_succeeded';
  exception when raise_exception then
    if sqlerrm <> 'gift_card_insufficient_balance' then raise; end if;
  end;

  begin
    perform public.redeem_gift_card(
      '91000000-0000-0000-0000-000000000002',
      v_hash,
      1,
      'SEK',
      '91000000-0000-4000-8000-000000000104',
      'admin',
      null
    );
    raise exception 'gift_cross_tenant_redeem_succeeded';
  exception when no_data_found then
    if sqlerrm <> 'gift_card_unavailable' then raise; end if;
  end;

  v_restore := public.restore_gift_card_redemption(
    '91000000-0000-0000-0000-000000000001',
    v_redeem_entry,
    '91000000-0000-4000-8000-000000000105',
    'Betalningen återförd'
  );
  if (v_restore ->> 'balance_cents')::integer <> 100000 then
    raise exception 'gift_restore_wrong_balance';
  end if;

  begin
    perform public.restore_gift_card_redemption(
      '91000000-0000-0000-0000-000000000001',
      v_redeem_entry,
      '91000000-0000-4000-8000-000000000106',
      'Andra återställningen'
    );
    raise exception 'gift_double_restore_succeeded';
  exception when unique_violation then
    if sqlerrm <> 'gift_card_reversal_exists' then raise; end if;
  end;

  perform public.void_gift_card(
    '91000000-0000-0000-0000-000000000001',
    v_card,
    '91000000-0000-4000-8000-000000000107',
    'Felutfärdat'
  );
  if (
    select g.balance_cents <> 0 or g.status <> 'void'
      from public.gift_cards g
     where g.id = v_card
  ) then
    raise exception 'gift_void_did_not_zero_value';
  end if;

  begin
    perform public.redeem_gift_card(
      '91000000-0000-0000-0000-000000000001',
      v_hash,
      1,
      'SEK',
      '91000000-0000-4000-8000-000000000108',
      'admin',
      null
    );
    raise exception 'void_gift_redeemed';
  exception when raise_exception then
    if sqlerrm <> 'gift_card_void' then raise; end if;
  end;
end
$$;

reset role;

-- Expiry is checked at spend time even if no cron has changed status.
update public.gift_cards
   set expires_at = '2000-01-01 00:00:00+00',
       status = 'active',
       balance_cents = 100
 where tenant_id = '91000000-0000-0000-0000-000000000001';

select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
begin
  begin
    perform public.redeem_gift_card(
      '91000000-0000-0000-0000-000000000001',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      1,
      'SEK',
      '91000000-0000-4000-8000-000000000109',
      'admin',
      null
    );
    raise exception 'expired_gift_redeemed';
  exception when raise_exception then
    if sqlerrm <> 'gift_card_expired' then raise; end if;
  end;

  begin
    perform public._generate_gift_code(
      '91000000-0000-0000-0000-000000000001',
      null
    );
    raise exception 'legacy_plaintext_generator_open';
  exception when insufficient_privilege then
    if sqlerrm <> 'gift_card_paid_issuance_requires_goal92' then raise; end if;
  end;
end
$$;
reset role;

do $$
declare
  v_mismatch bigint;
begin
  -- Restore the cache changed only by the expiry fixture so ledger/cache reconcile.
  perform pg_catalog.set_config('private.goal91_gift_command', 'on', true);
  update public.gift_cards
     set balance_cents = 0,
         status = 'void'
   where tenant_id = '91000000-0000-0000-0000-000000000001';

  select r.mismatch_count
    into v_mismatch
    from public.gift_card_reconciliation(
      '91000000-0000-0000-0000-000000000001'
    ) r;
  if v_mismatch <> 0 then
    raise exception 'gift_reconciliation_mismatch_%', v_mismatch;
  end if;

  if exists (
    select 1
      from public.audit_log a
     where a.tenant_id = '91000000-0000-0000-0000-000000000001'
       and a.meta::text ilike '%aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa%'
  )
  or exists (
    select 1
      from private.value_flow_outbox o
     where o.tenant_id = '91000000-0000-0000-0000-000000000001'
       and o.payload::text ilike '%aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa%'
  ) then
    raise exception 'gift_code_hash_leaked_to_audit_or_outbox';
  end if;

  begin
    update public.gift_card_entries
       set amount_cents = amount_cents + 1
     where tenant_id = '91000000-0000-0000-0000-000000000001';
    raise exception 'gift_ledger_update_succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'gift_card_entries_append_only' then raise; end if;
  end;
end
$$;

select 'goal91_gift_card_value_ok' as result;
rollback;
