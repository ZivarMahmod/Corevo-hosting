-- Goal 91 spends and the existing booking earn/reversal trigger must serialize
-- on the same tenant/customer key.
begin;

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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.tenant_id::text || ':' || v_customer::text, 0)
  );

  if new.status = 'completed' then
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

commit;
