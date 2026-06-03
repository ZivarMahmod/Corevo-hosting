-- 0017 — Booking traceability + tenants soft-delete.
-- A booking can now only CHANGE STATUS, never silently vanish: every status
-- transition is recorded in booking_status_history (authoritative, in-transaction)
-- and mirrored best-effort into audit_log; bookings can never be hard-deleted; and
-- tenants are soft-deleted so a tenant removal never cascades booking/audit history away.
set search_path = public;

-- ============ PART A — booking_status_history (authoritative trail) ============
create table if not exists public.booking_status_history (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  tenant_id     uuid not null,            -- NO FK by design: history survives tenant removal
  from_status   text,
  to_status     text not null,
  changed_by    uuid,                     -- auth.uid() of the actor, NULL for system/guest
  source        text not null default 'app',
  rebooked_from timestamptz,
  rebooked_to   timestamptz,
  changed_at    timestamptz not null default now()
);
create index if not exists booking_status_history_booking_idx on public.booking_status_history (booking_id, changed_at);
create index if not exists booking_status_history_tenant_idx  on public.booking_status_history (tenant_id, changed_at);

alter table public.booking_status_history enable row level security;
drop policy if exists booking_status_history_select on public.booking_status_history;
create policy booking_status_history_select on public.booking_status_history
  for select to authenticated
  using (tenant_id = private.tenant_id() or private.is_platform_admin());
-- append-only: no client insert policy (trigger writes via SECURITY DEFINER); block update/delete.
drop trigger if exists trg_bsh_no_mutation on public.booking_status_history;
create trigger trg_bsh_no_mutation
  before update or delete on public.booking_status_history
  for each row execute function public.block_audit_mutation();

-- ============ PART B — record every status transition ============
-- SECURITY DEFINER: anon guest INSERT has no tenant JWT claim, so the bsh/audit insert
-- needs to bypass RLS. tenant_id comes from the ROW (never private.tenant_id() here);
-- changed_by = auth.uid() (request-scoped, correct even under DEFINER); a non-uuid
-- system label goes into SOURCE, never changed_by.
create or replace function public.record_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
  v_to   text;
  v_actor uuid;
  v_source text;
begin
  if tg_op = 'INSERT' then
    v_from := null; v_to := new.status;
  else
    if new.status is not distinct from old.status then
      return new;  -- no status change (reschedule / GDPR scrub) -> no history row
    end if;
    v_from := old.status; v_to := new.status;
  end if;

  v_actor  := auth.uid();
  v_source := coalesce(nullif(current_setting('app.status_reason', true), ''),
                       case when auth.uid() is null then 'system' else 'app' end);

  -- Authoritative, in-transaction (guaranteed history).
  insert into public.booking_status_history (booking_id, tenant_id, from_status, to_status, changed_by, source)
  values (new.id, new.tenant_id, v_from, v_to, v_actor, v_source);

  -- Best-effort audit mirror (preserve the "audit never blocks the action" invariant).
  begin
    insert into public.audit_log (tenant_id, actor_profile_id, action, entity, entity_id, meta)
    values (new.tenant_id, v_actor, 'booking.status.' || v_to, 'booking', new.id,
            jsonb_build_object('from', v_from, 'to', v_to, 'source', v_source));
  exception when others then
    null;
  end;

  return new;
end;
$$;
revoke all on function public.record_booking_status_change() from public;
-- Trigger-only fn: strip the Supabase default anon/authenticated grants (never RPC-callable).
revoke execute on function public.record_booking_status_change() from anon, authenticated;

drop trigger if exists trg_record_booking_status on public.bookings;
create trigger trg_record_booking_status
  after insert or update on public.bookings
  for each row execute function public.record_booking_status_change();

-- ============ PART C — bookings are NEVER hard-deleted ============
-- Only status changes. GDPR erase anonymizes via UPDATE, so it is unaffected.
-- Test fixtures that DELETE bookings set the tx-local GUC corevo.allow_booking_delete='on'.
create or replace function public.block_booking_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('corevo.allow_booking_delete', true), 'off') = 'on' then
    return old;  -- explicit test-only escape hatch
  end if;
  raise exception 'bookings are never hard-deleted (status-change only)' using errcode = 'P0001';
end;
$$;
revoke all on function public.block_booking_hard_delete() from public, anon, authenticated;
drop trigger if exists trg_bookings_no_delete on public.bookings;
create trigger trg_bookings_no_delete
  before delete on public.bookings
  for each row execute function public.block_booking_hard_delete();

-- ============ PART D — tenants soft-delete + bookings FK decouple ============
-- All current tenants are 'active' so the CHECK is satisfiable.
alter table public.tenants drop constraint if exists tenants_status_chk;
alter table public.tenants add constraint tenants_status_chk check (status in ('active','suspended','deleted'));

-- bookings.tenant_id CASCADE -> RESTRICT: a tenant with bookings can no longer be
-- hard-deleted (must be soft-deleted), so booking history can never cascade away.
-- (audit_log.tenant_id is LEFT as CASCADE: real tenants are soft-deleted now, so
-- their audit persists; the only hard-delete is createTenant's history-less rollback,
-- whose cascade is harmless — and RESTRICT there would break that rollback.)
alter table public.bookings drop constraint bookings_tenant_id_fkey;
alter table public.bookings add constraint bookings_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete restrict;
