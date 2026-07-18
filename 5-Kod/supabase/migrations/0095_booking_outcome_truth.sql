-- 0095 — Bokningsutfall följer sluttiden, inte starttiden eller ett UI-antagande.
-- completed/no_show är påståenden om ett avslutat besök. Vakten gäller därför
-- ALLA skrivvägar, inklusive service_role. Samma status är en idempotent no-op.

begin;

create or replace function private.enforce_booking_outcome_time()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_pending_expiry boolean := coalesce(
    pg_catalog.current_setting('app.booking_outcome_internal_intent', true) = 'pending_expiry',
    false
  );
begin
  -- INSERT och UPDATE bedöms alltid mot NEW: inte ens service_role får lagra ett
  -- framtida completed/no_show. På UPDATE används dessutom OLD längre ned, så en
  -- caller inte kan korta sluttiden och avsluta i samma statement.
  if new.status in ('completed', 'no_show') and new.end_ts > v_now then
    if new.status = 'completed' then
      raise exception 'booking_not_ended_for_completed' using errcode = 'P0001';
    end if;
    raise exception 'booking_not_ended_for_no_show' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  if new.status is distinct from old.status
     and new.status in ('completed', 'no_show')
     and old.end_ts > pg_catalog.statement_timestamp() then
    if new.status = 'completed' then
      raise exception 'booking_not_ended_for_completed' using errcode = 'P0001';
    end if;
    raise exception 'booking_not_ended_for_no_show' using errcode = 'P0001';
  end if;

  -- Ett terminalt utfall beskriver den tid som faktiskt ägde rum. Schemat är ett
  -- historiskt snapshot och är därför låst även för service_role.
  if old.status in ('completed', 'no_show')
     and row(new.location_id, new.staff_id, new.start_ts, new.end_ts)
         is distinct from row(old.location_id, old.staff_id, old.start_ts, old.end_ts) then
    raise exception 'terminal_booking_schedule_read_only' using errcode = '42501';
  end if;

  -- Korrigering byter endast det historiska utfallet direkt. Den får aldrig gå via
  -- en aktiv/avbokad mellanstatus som skulle återöppna slotten eller behålla poäng.
  if new.status is distinct from old.status and (
    (old.status = 'completed' and new.status <> 'no_show')
    or (old.status = 'no_show' and new.status <> 'completed')
  ) then
    raise exception 'invalid_booking_status_transition' using errcode = 'P0001';
  end if;

  -- När en aktiv bokning passerat får den bara ett sanningsenligt utfall. Den får
  -- inte frigöra plats retroaktivt genom cancel eller flyttas till en ny tid.
  if old.status in ('pending', 'confirmed')
     and old.end_ts <= pg_catalog.statement_timestamp() then
    if row(new.location_id, new.staff_id, new.start_ts, new.end_ts)
       is distinct from row(old.location_id, old.staff_id, old.start_ts, old.end_ts) then
      raise exception 'past_booking_schedule_read_only' using errcode = 'P0001';
    end if;
    if new.status is distinct from old.status
       and new.status not in ('completed', 'no_show')
       and not (
         v_pending_expiry
         and old.status = 'pending'
         and new.status = 'cancelled'
         and new.cancelled_by = 'system'
         and new.cancelled_at is not null
       ) then
      raise exception 'past_booking_requires_outcome' using errcode = 'P0001';
    end if;
  end if;

  -- Återställning är ett ångra av en framtida avbokning, aldrig ett sätt att
  -- återaktivera en tid som redan startat. no_show-korrigering berörs inte.
  if old.status = 'cancelled'
     and new.status is distinct from old.status
     and new.status in ('pending', 'confirmed') then
    if old.start_ts <= pg_catalog.statement_timestamp() then
      raise exception 'cancelled_booking_already_started' using errcode = 'P0001';
    end if;
    if new.status <> 'confirmed' then
      raise exception 'invalid_booking_status_transition' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_booking_outcome_time() from public, anon, authenticated;

drop trigger if exists trg_enforce_booking_outcome_time on public.bookings;
create trigger trg_enforce_booking_outcome_time
  before insert or update of status, location_id, staff_id, start_ts, end_ts on public.bookings
  for each row execute function private.enforce_booking_outcome_time();

-- Behåll 0072:s fält-, FSM-, refund- och spårbarhetsvakter för authenticated,
-- men gör dess begripliga snabbfel överens med den rolloberoende sluttidsvakten.
create or replace function private.guard_authenticated_booking_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending_expiry boolean := coalesce(
    pg_catalog.current_setting('app.booking_outcome_internal_intent', true) = 'pending_expiry',
    false
  );
begin
  if coalesce(
       nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
       nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
       ''
     ) = 'service_role' then
    return new;
  end if;

  if row(new.id, new.tenant_id, new.service_id, new.price_cents,
         new.customer_profile_id, new.request_id, new.created_at)
     is distinct from
     row(old.id, old.tenant_id, old.service_id, old.price_cents,
         old.customer_profile_id, old.request_id, old.created_at) then
    raise exception 'immutable_booking_fields' using errcode = '42501';
  end if;

  if old.status in ('completed', 'cancelled', 'no_show')
    and new.status not in ('pending', 'confirmed')
    and row(new.location_id, new.staff_id, new.start_ts, new.end_ts)
        is distinct from row(old.location_id, old.staff_id, old.start_ts, old.end_ts) then
    raise exception 'historical_booking_schedule_read_only' using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'pending'   and new.status in ('confirmed','completed','cancelled','no_show')) or
    (old.status = 'confirmed' and new.status in ('pending','completed','cancelled','no_show')) or
    (old.status = 'completed' and new.status = 'no_show') or
    (old.status = 'no_show' and new.status = 'completed') or
    (old.status = 'cancelled' and new.status in ('confirmed'))
  ) then
    raise exception 'invalid_booking_status_transition' using errcode = 'P0001';
  end if;
  if new.status = 'no_show' and new.status is distinct from old.status
     and old.end_ts > pg_catalog.statement_timestamp() then
    raise exception 'booking_not_ended_for_no_show' using errcode = 'P0001';
  end if;
  if new.status = 'completed' and new.status is distinct from old.status
     and old.end_ts > pg_catalog.statement_timestamp() then
    raise exception 'booking_not_ended_for_completed' using errcode = 'P0001';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' and exists (
    select 1 from public.payments p
     where p.booking_id = old.id
       and p.tenant_id = old.tenant_id
       and p.status = 'refunded'
  ) then
    raise exception 'refunded_booking_cannot_be_restored' using errcode = 'P0001';
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' and (
    new.cancelled_at is null
    or new.cancelled_by is null
    or (
      new.cancelled_by not in ('customer', 'business')
      and not (
        v_pending_expiry
        and old.status = 'pending'
        and new.cancelled_by = 'system'
      )
    )
  ) then
    raise exception 'cancellation_trace_required' using errcode = 'P0001';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' and (
    new.cancelled_at is not null or new.cancelled_by is not null
  ) then
    raise exception 'cancellation_trace_must_be_cleared' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_authenticated_booking_update() from public, anon, authenticated;

-- 0018:s mass-update gick sönder när en övergiven pending-rad redan hade passerat:
-- den rolloberoende sanningsvakten stoppade hela statementet. Svepet får därför en
-- transaktionslokal, exakt intent som endast tillåter pending -> cancelled(system).
-- Vanliga service-role-writes utan denna intent är fortfarande blockerade.
create or replace function public.expire_abandoned_pending_bookings(p_ttl_min int default 30)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if p_ttl_min is null or p_ttl_min <= 0 or p_ttl_min > 1440 then
    raise exception 'invalid_ttl' using errcode = '22023';
  end if;

  perform pg_catalog.set_config('app.status_reason', 'pending_expiry', true);
  perform pg_catalog.set_config('app.booking_outcome_internal_intent', 'pending_expiry', true);

  with expired as (
    update public.bookings b
       set status = 'cancelled',
           cancelled_at = pg_catalog.statement_timestamp(),
           cancelled_by = 'system',
           updated_at = pg_catalog.statement_timestamp()
      from public.payments p
     where p.booking_id = b.id
       and p.tenant_id = b.tenant_id
       and b.status = 'pending'
       and p.status = 'pending'
       and p.created_at <= pg_catalog.statement_timestamp()
         - pg_catalog.make_interval(mins => p_ttl_min)
    returning b.id
  )
  select pg_catalog.count(*)::int into v_n from expired;

  perform pg_catalog.set_config('app.booking_outcome_internal_intent', '', true);
  perform pg_catalog.set_config('app.status_reason', '', true);
  return v_n;
end;
$$;

revoke all on function public.expire_abandoned_pending_bookings(int)
  from public, anon, authenticated;
grant execute on function public.expire_abandoned_pending_bookings(int) to service_role;

-- 0092-kompatibelt schema för domänhändelser som finns innan U4 har avgjort
-- samtycke och kanal. routing är avsiktligt inte med i worker-claimens statusar.
alter table public.notifications_outbox
  drop constraint if exists notifications_outbox_status_check,
  add constraint notifications_outbox_status_check
    check (status in ('routing','queued','attempting','delivery_started','sent','delivered','failed','skipped','simulated'));

create unique index if not exists notifications_outbox_routing_unique
  on public.notifications_outbox (tenant_id, event_type, event_key)
  where chosen_channel is null;

-- Completion och dess durable domänhändelse måste vara ett enda commitbeslut.
-- Producenten vet ännu varken aktuellt samtycke eller kanal och får därför aldrig
-- göra raden levererbar. U4 routar samma rad senare. En no_show-korrigering stänger
-- bara sådant som säkert inte har börjat levereras; historiskt skickat bevaras.
create or replace function private.enqueue_booking_completed_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := new.customer_id;
  v_event_key text := 'booking:' || new.id::text || ':completed';
  v_existing record;
begin
  if new.status = 'no_show' and old.status = 'completed' then
    update public.notifications_outbox
       set status = 'skipped',
           skip_reason = 'booking_outcome_changed',
           lease_token = null,
           lease_expires_at = null,
           last_error = null,
           updated_at = pg_catalog.statement_timestamp()
     where tenant_id = new.tenant_id
       and event_type = 'booking_completed'
       and event_key = v_event_key
       and status in ('routing', 'queued', 'attempting');
    return new;
  end if;

  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  if v_customer is null and new.customer_profile_id is not null then
    select c.id into v_customer
      from public.customers c
     where c.tenant_id = new.tenant_id
       and c.auth_user_id = new.customer_profile_id
     limit 1;
  end if;
  if v_customer is null then
    return new;
  end if;

  -- Lås den enda kända händelsen. Terminal/leveransstartad rad vinner alltid så
  -- en gammal korrigeringsrad aldrig kan öppnas bredvid redan skickad historik.
  select o.id, o.status, o.skip_reason
    into v_existing
    from public.notifications_outbox o
   where o.tenant_id = new.tenant_id
     and o.event_type = 'booking_completed'
     and o.event_key = v_event_key
   order by
     case when o.status in ('delivery_started', 'sent', 'delivered') then 0 else 1 end,
     o.created_at,
     o.id
   limit 1
   for update;

  if found then
    if v_existing.status = 'skipped'
       and v_existing.skip_reason = 'booking_outcome_changed' then
      update public.notifications_outbox
         set status = 'routing',
             chosen_channel = null,
             fallback_channel = null,
             consent_state = null,
             skip_reason = null,
             attempt_count = 0,
             available_at = pg_catalog.statement_timestamp(),
             lease_token = null,
             lease_expires_at = null,
             last_error = null,
             provider_ref = null,
             cost_ore = null,
             parts = null,
             sent_at = null,
             delivered_at = null,
             updated_at = pg_catalog.statement_timestamp()
       where id = v_existing.id;
    end if;
    return new;
  end if;

  insert into public.notifications_outbox (
    tenant_id, customer_id, booking_id, staff_id,
    event_type, event_key, category, chosen_channel, fallback_channel,
    consent_state, payload, status, max_attempts, available_at
  ) values (
    new.tenant_id, v_customer, new.id, new.staff_id,
    'booking_completed', v_event_key,
    'marketing', null, null,
    null,
    pg_catalog.jsonb_build_object('template', 'booking_completion', 'booking_id', new.id),
    'routing', 5, pg_catalog.statement_timestamp()
  )
  on conflict (tenant_id, event_type, event_key)
    where chosen_channel is null
  do nothing;

  return new;
end;
$$;

revoke all on function private.enqueue_booking_completed_event()
  from public, anon, authenticated;

drop trigger if exists trg_enqueue_booking_completed_event on public.bookings;
create trigger trg_enqueue_booking_completed_event
  after update of status on public.bookings
  for each row execute function private.enqueue_booking_completed_event();

-- 0016 isolerade alla ledgerfel och kunde därför påstå completed utan att den
-- utlovade poängraden fanns. Nu är ledgern append-only och transaktionell:
-- första completion använder den befintliga unika earn-raden; direkt korrigering
-- completed <-> no_show bokför explicita adjustment-rader. En reversal tar aldrig
-- mer än det aktuella saldot, och re-completion återlägger exakt samma avdrag.
create or replace function public.earn_loyalty_on_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid;
  v_points int;
  v_earned_points int;
  v_booking_points int;
  v_customer_balance int;
  v_reversal int;
  v_reearn int;
begin
  if not (
    (new.status = 'completed' and old.status is distinct from 'completed')
    or (old.status = 'completed' and new.status = 'no_show')
  ) then
    return new;
  end if;

  v_customer := new.customer_id;
  if v_customer is null and new.customer_profile_id is not null then
    select c.id into v_customer
      from public.customers c
     where c.tenant_id = new.tenant_id
       and c.auth_user_id = new.customer_profile_id
     limit 1;
  end if;
  if v_customer is null then return new; end if;

  -- Serialiserar korrigering mot andra U9-ledgerwrites för samma kund.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_customer::text, 0)
  );

  if new.status = 'completed' then
    -- Konfigurationsgaten styr bara den FÖRSTA earn-raden. Finns originalet redan
    -- är beloppet historiskt; no_show -> completed måste då återställa exakt den
    -- del som tidigare reverserades även om programmet därefter satts till 0.
    select coalesce(max(ll.points_delta), 0)::int
      into v_earned_points
      from public.loyalty_ledger ll
     where ll.booking_id = new.id
       and ll.reason = 'earn_completed';

    if v_earned_points > 0 then
      if old.status = 'no_show' then
        select coalesce(sum(ll.points_delta), 0)::int
          into v_booking_points
          from public.loyalty_ledger ll
         where ll.booking_id = new.id
           and (
             ll.reason = 'earn_completed'
             or (ll.reason = 'adjustment' and ll.note in (
               'booking_completed_reversal', 'booking_completed_reearn'
             ))
           );
        v_reearn := greatest(v_earned_points - v_booking_points, 0);
        if v_reearn > 0 then
          insert into public.loyalty_ledger (
            tenant_id, customer_id, booking_id, points_delta, reason, note
          ) values (
            new.tenant_id, v_customer, new.id, v_reearn,
            'adjustment', 'booking_completed_reearn'
          );
        end if;
      end if;
      return new;
    end if;

    select coalesce(nullif(ts.settings #>> '{loyalty,points_per_visit}', '')::int, 50)
      into v_points
      from public.tenant_settings ts
     where ts.tenant_id = new.tenant_id;
    v_points := coalesce(v_points, 50);
    if v_points <= 0 then return new; end if;

    insert into public.loyalty_ledger (
      tenant_id, customer_id, booking_id, points_delta, reason
    ) values (
      new.tenant_id, v_customer, new.id, v_points, 'earn_completed'
    )
    on conflict (booking_id) where (reason = 'earn_completed') do nothing;
  else
    select coalesce(sum(ll.points_delta), 0)::int
      into v_booking_points
      from public.loyalty_ledger ll
     where ll.booking_id = new.id
       and (
         ll.reason = 'earn_completed'
         or (ll.reason = 'adjustment' and ll.note in (
           'booking_completed_reversal', 'booking_completed_reearn'
         ))
       );
    select coalesce(sum(ll.points_delta), 0)::int
      into v_customer_balance
      from public.loyalty_ledger ll
     where ll.tenant_id = new.tenant_id
       and ll.customer_id = v_customer;
    v_reversal := least(v_booking_points, greatest(v_customer_balance, 0));
    if v_reversal > 0 then
      insert into public.loyalty_ledger (
        tenant_id, customer_id, booking_id, points_delta, reason, note
      ) values (
        new.tenant_id, v_customer, new.id, -v_reversal,
        'adjustment', 'booking_completed_reversal'
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.earn_loyalty_on_completed() from public, anon, authenticated;

drop trigger if exists trg_loyalty_earn_on_completed on public.bookings;
create trigger trg_loyalty_earn_on_completed
  after update of status on public.bookings
  for each row execute function public.earn_loyalty_on_completed();

-- Spendable balance är hela ledgerns nettosumma. Lifetime är däremot ett
-- utfallsmedvetet mått: varje original-earn räknas högst en gång och endast när
-- bokningens NUVARANDE status är completed. Bokningskopplade reversal/re-earn-rader
-- räknas aldrig igen; bara explicit fristående positiva adjustments är manuella
-- lifetime-earns. Aggregatet körs i DB för att undvika PostgRESTs 1000-radstak.
--
-- SECURITY DEFINER är avsiktligt och smalt: loyalty-ledgern är tenantbred för
-- personal medan bookings-RLS är platsbegränsad. En vanlig invoker-join kunde
-- därför ge rätt saldo men för låg lifetime/tier. Funktionen låser och verifierar
-- den aktuella aktiva tenantmedlemmen samt samma kundkortsbehörighet som RLS innan
-- den kringgår booking-RLS. Den returnerar bara tre aggregat och öppnar aldrig
-- råa bokningsrader. Platformrollen/service_role är uttryckligen inte anropsvägar.
create or replace function public.customer_loyalty_totals(
  p_tenant uuid,
  p_customer uuid
)
returns table (
  balance bigint,
  lifetime bigint,
  entry_count bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role_level integer;
  v_access_scope text;
  v_customer_auth_user uuid;
  v_allowed boolean := false;
begin
  if v_uid is null or p_tenant is null or p_customer is null then
    raise exception using
      errcode = '42501',
      message = 'customer_loyalty_totals_access_denied';
  end if;

  -- DB-raden, inte JWT-metadata, är tenant- och rollauktoriteten. SHARE-låset
  -- hindrar status/roll/tenant från att ändras mitt i auktorisering + aggregat.
  select r.level, u.access_scope
    into v_role_level, v_access_scope
    from public.users u
    join public.roles r on r.id = u.role_id
   where u.id = v_uid
     and u.status = 'active'
     and u.tenant_id = p_tenant
     and r.tenant_id = p_tenant
   for share of u, r;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'customer_loyalty_totals_access_denied';
  end if;

  select c.auth_user_id
    into v_customer_auth_user
    from public.customers c
   where c.id = p_customer
     and c.tenant_id = p_tenant
     and c.status = 'active'
   for share of c;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'customer_loyalty_totals_access_denied';
  end if;

  if v_customer_auth_user = v_uid then
    v_allowed := true;
  elsif v_role_level >= 6 and v_access_scope = 'organization' then
    v_allowed := true;
  elsif v_role_level >= 6 and v_access_scope = 'locations' then
    select exists (
      select 1
        from public.bookings b
        join public.locations l
          on l.id = b.location_id
         and l.tenant_id = b.tenant_id
         and l.active
        join public.user_location_access ula
          on ula.location_id = b.location_id
         and ula.tenant_id = b.tenant_id
         and ula.user_id = v_uid
       where b.tenant_id = p_tenant
         and b.customer_id = p_customer
    ) into v_allowed;
  elsif v_role_level = 3 then
    select exists (
      select 1
        from public.bookings b
        join public.locations l
          on l.id = b.location_id
         and l.tenant_id = b.tenant_id
         and l.active
        join public.staff s
          on s.location_id = b.location_id
         and s.tenant_id = b.tenant_id
         and s.profile_id = v_uid
         and s.active
       where b.tenant_id = p_tenant
         and b.customer_id = p_customer
    ) into v_allowed;
  end if;

  if not v_allowed then
    raise exception using
      errcode = '42501',
      message = 'customer_loyalty_totals_access_denied';
  end if;

  return query
  select
    coalesce(pg_catalog.sum(ll.points_delta), 0)::bigint as balance,
    coalesce(pg_catalog.sum(
      case
        when ll.reason = 'earn_completed' and b.status = 'completed'
          then greatest(ll.points_delta, 0)
        when ll.reason = 'adjustment'
             and ll.booking_id is null
             and ll.points_delta > 0
             and coalesce(ll.note, '') not in (
               'booking_completed_reversal', 'booking_completed_reearn'
             )
          then ll.points_delta
        else 0
      end
    ), 0)::bigint as lifetime,
    pg_catalog.count(ll.id)::bigint as entry_count
  from public.loyalty_ledger ll
  left join public.bookings b
    on b.id = ll.booking_id
   and b.tenant_id = ll.tenant_id
  where ll.tenant_id = p_tenant
    and ll.customer_id = p_customer;
end;
$$;

revoke all on function public.customer_loyalty_totals(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_loyalty_totals(uuid, uuid)
  to authenticated;

comment on function public.customer_loyalty_totals(uuid, uuid) is
  'Intentional SECURITY DEFINER totals-only boundary: explicit active local tenant/customer-card authorization precedes same-tenant ledger+booking aggregation; raw booking access remains under RLS.';

-- 0067 räknade framtida/pågående bokningar som besök. Kundkortets besök och
-- senaste besök är verkliga completed-rader; lojalitetssaldot förblir ledgerstyrt.
create or replace function public.admin_customer_rows(
  p_tenant uuid,
  p_customer uuid default null
)
returns table (
  id uuid,
  display_name text,
  full_name text,
  name_hidden boolean,
  status text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  hidden_at timestamptz,
  visits bigint,
  last_visit_ts timestamptz,
  loyalty_points bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id, c.display_name, c.full_name, c.name_hidden, c.status,
    c.first_seen_at, c.last_seen_at, c.hidden_at,
    coalesce(v.visits, 0) as visits,
    v.last_visit_ts,
    coalesce(l.points, 0) as loyalty_points
  from public.customers c
  left join (
    select b.customer_id, count(*) as visits, max(b.start_ts) as last_visit_ts
      from public.bookings b
     where b.tenant_id = p_tenant
       and b.status = 'completed'
       and (p_customer is null or b.customer_id = p_customer)
     group by b.customer_id
  ) v on v.customer_id = c.id
  left join (
    select ll.customer_id, sum(ll.points_delta) as points
      from public.loyalty_ledger ll
     where ll.tenant_id = p_tenant
       and (p_customer is null or ll.customer_id = p_customer)
     group by ll.customer_id
  ) l on l.customer_id = c.id
  where c.tenant_id = p_tenant
    and c.status = 'active'
    and (p_customer is null or c.id = p_customer)
  order by c.last_seen_at desc nulls last, c.id;
$$;

revoke execute on function public.admin_customer_rows(uuid, uuid) from public, anon;
grant execute on function public.admin_customer_rows(uuid, uuid) to authenticated;

comment on function private.enforce_booking_outcome_time()
  is 'Rolloberoende invariant: completed/no_show kräver att booking.end_ts har passerat.';
comment on function public.admin_customer_rows(uuid, uuid)
  is 'Tenantfencad kundlista där besök och senaste besök räknas completed-only.';

commit;
