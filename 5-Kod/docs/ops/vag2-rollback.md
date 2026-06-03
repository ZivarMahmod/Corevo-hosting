# VÅG 2 — rollback-artefakter (DB)

**PITR-referens (restore-punkt FÖRE VÅG 2-mutationer):** `2026-06-03 06:48:06.845182+00` (UTC).
Baslinje innan migr 0015–0018. Advisors guardrail #3/#6: kod-rollback = `git revert`; DB-rollback = PITR till denna tidpunkt ELLER per-migration revert-SQL nedan.

Live-state innan: `bookings`=8, `payments`=0 (refund/pending-expiry inert idag). Advisor 15 WARN/0 ERROR-baslinje.

## 0015 rollback — restore ORIGINAL `create_public_booking` (6-arg) + drop helper
Den nya 9-arg-funktionen ersätter denna. För att rulla tillbaka: drop 9-arg, återskapa 6-arg nedan (EXAKT live-def fångad via `pg_get_functiondef` 2026-06-03), drop helper.
```sql
drop function if exists public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text);
drop function if exists private.resolve_customer_id(uuid,uuid,text,text,text);

CREATE OR REPLACE FUNCTION public.create_public_booking(p_tenant_slug text, p_service uuid, p_staff uuid, p_start timestamp with time zone, p_note text DEFAULT NULL::text, p_customer uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tenant uuid; v_duration int; v_price int; v_location uuid; v_id uuid;
  v_uid uuid := auth.uid();
begin
  -- Identity fence (the action layer is bypassable; this is not).
  if v_uid is null then
    if p_customer is not null then
      raise exception 'forbidden_customer' using errcode = '42501';
    end if;
  elsif p_customer is not null and p_customer <> v_uid then
    raise exception 'forbidden_customer' using errcode = '42501';
  end if;

  -- No past-dated bookings (cheap anti-spam; small grace for clock skew / slot edge).
  if p_start < (now() - interval '2 minutes') then
    raise exception 'start_in_past' using errcode = 'P0001';
  end if;

  select t.id into v_tenant from public.tenants t
   where t.slug = lower(btrim(p_tenant_slug)) and t.status = 'active';
  if v_tenant is null then raise exception 'unknown_or_inactive_tenant' using errcode = 'P0002'; end if;

  select s.duration_min, s.price_cents into v_duration, v_price from public.services s
   where s.id = p_service and s.tenant_id = v_tenant and s.active = true;
  if v_duration is null then raise exception 'invalid_service' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from public.staff st
      join public.staff_services ss on ss.staff_id = st.id and ss.service_id = p_service
     where st.id = p_staff and st.tenant_id = v_tenant and st.active = true
  ) then raise exception 'invalid_staff' using errcode = 'P0002'; end if;

  select l.id into v_location from public.locations l
   where l.tenant_id = v_tenant and l.is_primary limit 1;

  insert into public.bookings (
    tenant_id, location_id, staff_id, service_id, customer_profile_id,
    start_ts, end_ts, status, price_cents, note
  ) values (
    v_tenant, v_location, p_staff, p_service, p_customer,
    p_start, p_start + (v_duration * interval '1 minute'), 'pending', v_price, p_note
  ) returning id into v_id;
  return v_id;
end;
$function$;
revoke execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid) from public;
grant execute on function public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid) to anon, authenticated;
```

## 0016 rollback — drop loyalty-earn trigger + fn
```sql
drop trigger if exists trg_loyalty_earn_on_completed on public.bookings;
drop function if exists public.earn_loyalty_on_completed();
```

## 0017 rollback — history + soft-delete + FK
```sql
-- restore bookings.tenant_id CASCADE (was RESTRICT after 0017)
alter table public.bookings drop constraint if exists bookings_tenant_id_fkey;
alter table public.bookings add constraint bookings_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;
-- audit_log.tenant_id was LEFT as CASCADE (advisor) — no change to revert.
drop trigger if exists trg_bookings_no_delete on public.bookings;
drop function if exists public.block_booking_hard_delete();
drop trigger if exists trg_record_booking_status on public.bookings;
drop function if exists public.record_booking_status_change();
drop table if exists public.booking_status_history cascade;
alter table public.tenants drop constraint if exists tenants_status_chk;
```

## 0018 rollback — drop pending-expiry RPC
```sql
drop function if exists public.expire_abandoned_pending_bookings(int);
```

## ⚠️ Känt gap för REDEEM-vågen (earn-only nu)
Admin-status-matrisen (`ALLOWED_FROM`, `lib/admin/format.ts`) tillåter nu `completed → cancelled`
(betald+genomförd bokning kan avbokas+återbetalas via back-office). Den avbokningen **återbetalar
pengar men återkallar INTE de intjänade lojalitetspoängen** (0016 mintar vid `→completed`; revoke/
spendera är medvetet uppskjutet, earn-only). Ofarligt idag (poäng kan inte lösas in ännu). **När
REDEEM-vågen byggs:** lägg en revoke-väg på `completed → {cancelled, pending, confirmed}` så ett
ångrat/avbokat besök inte lämnar kvar mintade poäng. Idempotens via `loyalty_ledger_earn_once`
gör att om-completion inte dubbel-mintar — men reverteringen saknar mot-bokföring.
