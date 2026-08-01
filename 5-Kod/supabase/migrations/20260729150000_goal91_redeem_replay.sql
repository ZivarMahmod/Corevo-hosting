-- Keep a successful redemption retry byte-for-byte compatible with its first
-- response. The value mutation was already idempotent; this repairs its reply.
begin;

create or replace function public.redeem_gift_card(
  p_tenant uuid,
  p_code_hash text,
  p_amount_cents integer,
  p_currency text,
  p_idempotency_key uuid,
  p_source_type text default 'admin',
  p_source_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_hash text;
  v_existing public.gift_card_entries%rowtype;
  v_card public.gift_cards%rowtype;
  v_entry_id uuid;
  v_balance integer;
  v_status text;
  v_currency text := pg_catalog.upper(pg_catalog.btrim(p_currency));
begin
  perform private.require_goal91_value_admin(p_tenant, 'presentkort', true);
  if p_idempotency_key is null
     or p_amount_cents not between 1 and 10000000
     or v_currency !~ '^[A-Z]{3}$'
     or pg_catalog.lower(coalesce(p_code_hash, '')) !~ '^[0-9a-f]{64}$'
     or p_source_type not in ('admin', 'booking', 'checkout', 'shop_order', 'payment')
     or pg_catalog.length(coalesce(p_source_id, '')) > 200
  then
    raise exception 'gift_card_redemption_invalid' using errcode = '22023';
  end if;

  v_request_hash := private.goal91_request_hash(pg_catalog.jsonb_build_object(
    'command', 'redeem',
    'code_hash', pg_catalog.lower(p_code_hash),
    'amount_cents', p_amount_cents,
    'currency', v_currency,
    'source_type', p_source_type,
    'source_id', p_source_id
  ));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant::text || ':' || p_idempotency_key::text, 0)
  );

  select e.*
    into v_existing
    from public.gift_card_entries e
   where e.tenant_id = p_tenant
     and e.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_request_hash or v_existing.entry_type <> 'redeem' then
      raise exception 'gift_card_idempotency_conflict' using errcode = '22023';
    end if;
    return pg_catalog.jsonb_build_object(
      'gift_card_id', v_existing.gift_card_id,
      'entry_id', v_existing.id,
      'balance_cents', v_existing.balance_after_cents,
      'status', case
        when v_existing.balance_after_cents = 0 then 'redeemed'
        else 'active'
      end,
      'code_last_four', (
        select g.code_last_four
          from public.gift_cards g
         where g.id = v_existing.gift_card_id
           and g.tenant_id = p_tenant
      )
    );
  end if;

  select g.*
    into v_card
    from public.gift_cards g
   where g.tenant_id = p_tenant
     and g.code_hash = pg_catalog.lower(p_code_hash)
   for update;
  if not found then
    raise exception 'gift_card_unavailable' using errcode = 'P0002';
  end if;
  if v_card.status = 'void' then
    raise exception 'gift_card_void' using errcode = 'P0001';
  end if;
  if v_card.expires_at is not null and v_card.expires_at <= pg_catalog.now() then
    raise exception 'gift_card_expired' using errcode = 'P0001';
  end if;
  if v_card.status <> 'active' or v_card.balance_cents <= 0 then
    raise exception 'gift_card_unavailable' using errcode = 'P0001';
  end if;
  if v_card.currency <> v_currency then
    raise exception 'gift_card_currency_mismatch' using errcode = '22023';
  end if;
  if v_card.balance_cents < p_amount_cents then
    raise exception 'gift_card_insufficient_balance' using errcode = 'P0001';
  end if;

  v_balance := v_card.balance_cents - p_amount_cents;
  v_status := case when v_balance = 0 then 'redeemed' else 'active' end;
  perform pg_catalog.set_config('private.goal91_gift_command', 'on', true);
  update public.gift_cards
     set balance_cents = v_balance,
         status = v_status
   where id = v_card.id
     and tenant_id = p_tenant;

  insert into public.gift_card_entries (
    tenant_id,
    gift_card_id,
    amount_cents,
    balance_after_cents,
    currency,
    entry_type,
    source_type,
    source_id,
    idempotency_key,
    request_hash,
    actor_user_id
  ) values (
    p_tenant,
    v_card.id,
    -p_amount_cents,
    v_balance,
    v_currency,
    'redeem',
    p_source_type,
    p_source_id,
    p_idempotency_key,
    v_request_hash,
    (select auth.uid())
  )
  returning id into v_entry_id;

  insert into public.audit_log (
    tenant_id, actor_profile_id, action, entity, entity_id, meta
  ) values (
    p_tenant,
    (select auth.uid()),
    'gift_card.redeem',
    'gift_card',
    v_card.id,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'amount_cents', p_amount_cents,
      'currency', v_currency,
      'balance_after_cents', v_balance
    )
  );
  insert into private.value_flow_outbox (
    tenant_id, domain, event_type, event_key, payload
  ) values (
    p_tenant,
    'gift_card',
    'gift_card.redeemed',
    v_entry_id::text,
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'gift_card_id', v_card.id,
      'amount_cents', p_amount_cents,
      'balance_after_cents', v_balance
    )
  );

  return pg_catalog.jsonb_build_object(
    'gift_card_id', v_card.id,
    'entry_id', v_entry_id,
    'balance_cents', v_balance,
    'status', v_status,
    'code_last_four', v_card.code_last_four
  );
end;
$$;

commit;
