-- 0071 — Rollmedveten RLS för kundadmin och känsliga tenantdata.
--
-- 0002 isolerade tenants men skilde inte kund (2), personal (3) och ägare (6).
-- Följden var att varje authenticated-session kunde skriva users/roles och därmed
-- ge sig själv en högre roll. Samma generiska FOR ALL-policy låg på företagets
-- konfiguration och flera privata modultabeller. Den här migrationen gör databasen
-- till samma behörighetssanning som appens admin-områden:
--   kund 2       → egna kunddata + egna läsningar
--   personal 3   → arbetsdagen (bokningar/kunder)
--   salon_admin 6→ företagets konfiguration och moduler
--   platform     → uttryckligt platform_admin-claim, aldrig enbart tenant_id

-- ── Identitet/roller: JWT-claimen måste stämma med en aktiv global roll. ─────
-- Det räcker inte att lita på en redan utfärdad platform_admin-claim: databasen
-- verifierar även public.users + public.roles vid varje RLS-fråga. Därmed dör en
-- gammal eskalerad token direkt när rollen/statusen inte längre är giltig.
create or replace function private.tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.tenant_id
    from public.users u
    join public.roles r on r.id = u.role_id
   where u.id = (select auth.uid())
     and u.status = 'active'
     and u.tenant_id is not null
     and r.tenant_id = u.tenant_id
   limit 1
$$;
revoke all on function private.tenant_id() from public;
grant execute on function private.tenant_id() to authenticated, anon;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'platform_admin')::boolean,
      false
    )
    and exists (
      select 1
        from public.users u
        join public.roles r on r.id = u.role_id
       where u.id = (select auth.uid())
         and u.status = 'active'
         and r.tenant_id is null
         and r.level >= 7
    )
$$;
revoke all on function private.is_platform_admin() from public;
grant execute on function private.is_platform_admin() to authenticated, anon, supabase_auth_admin;

-- Vanliga roller gäller bara för ett aktivt konto. En staff-roll gäller dessutom
-- bara när kontot fortfarande är länkat till en aktiv staff-rad i samma tenant.
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

-- Nya tokens får endast plattformsclaim från aktivt konto + global nivå 7–8.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb; amd jsonb; v_tenant uuid; v_level int; v_platform boolean := false;
begin
  select u.tenant_id, r.level,
         (u.status = 'active' and r.tenant_id is null and r.level >= 7)
    into v_tenant, v_level, v_platform
    from public.users u
    left join public.roles r on r.id = u.role_id
   where u.id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  amd := coalesce(claims -> 'app_metadata', '{}'::jsonb);
  if v_tenant is not null then
    amd := jsonb_set(amd, '{tenant_id}', to_jsonb(v_tenant::text), true);
  else
    amd := amd - 'tenant_id';
  end if;
  amd := jsonb_set(amd, '{platform_admin}', to_jsonb(coalesce(v_platform, false)), true);
  claims := jsonb_set(claims, '{app_metadata}', amd, true);
  return jsonb_set(event, '{claims}', claims, true);
end;
$$;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- Rollistan är inte global katalogdata för alla inloggade. Egen roll får alltid
-- läsas; ägare ser tenantens roller för inbjudningar; plattform ser allt.
drop policy if exists roles_select on public.roles;
create policy roles_scoped_read on public.roles
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or id = (select u.role_id from public.users u where u.id = (select auth.uid()))
    or (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
  );

-- Skrivning av roller är plattformsansvar.
drop policy if exists roles_write on public.roles;
create policy roles_platform_write on public.roles
  for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- ── Users: egen rad kan läsas; ägare kan läsa/skapa tenantkonton. ───────────
-- Direkt UPDATE begränsas dessutom på privilegienivå till kolumnen phone. Det är
-- avgörande: en vanlig RLS WITH CHECK på den egna raden kan inte hindra att role_id
-- byts på samma rad. Rollbyten får därför bara gå genom en framtida, smal RPC.
drop policy if exists users_rls on public.users;

create policy users_role_read on public.users
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (id = (select auth.uid()) or (select private.role_level()) >= 6)
    )
  );

create policy users_admin_insert on public.users
  for insert to authenticated
  with check (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (select private.role_level()) >= 6
      and exists (
        select 1 from public.roles r
         where r.id = role_id
           and r.tenant_id = users.tenant_id
           and r.level <= (select private.role_level())
      )
    )
  );

create policy users_self_update_phone on public.users
  for update to authenticated
  using (
    id = (select auth.uid())
    and tenant_id = (select private.tenant_id())
  )
  with check (
    id = (select auth.uid())
    and tenant_id = (select private.tenant_id())
  );

create policy users_platform_delete on public.users
  for delete to authenticated
  using ((select private.is_platform_admin()));

revoke update on public.users from authenticated;
grant update (phone) on public.users to authenticated;

-- ── Tenanten själv: alla tenantroller får läsa, bara ägare får ändra. ───────
drop policy if exists tenants_rls on public.tenants;
create policy tenants_role_read on public.tenants
  for select to authenticated
  using (
    (id = (select private.tenant_id()) and (select private.role_level()) >= 2)
    or (select private.is_platform_admin())
  );
create policy tenants_admin_update on public.tenants
  for update to authenticated
  using (
    (id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  )
  with check (
    (id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );
create policy tenants_platform_insert on public.tenants
  for insert to authenticated
  with check ((select private.is_platform_admin()));
create policy tenants_platform_delete on public.tenants
  for delete to authenticated
  using ((select private.is_platform_admin()));

-- Anon behöver bara publik storefront-identitet + betalningsberedskap. Ett
-- tabellgrant skulle annars även exponera Stripe-konto, abonnemangsplan och
-- plattformsfält trots att appen aldrig behöver dem.
revoke select on table public.tenants from anon;
grant select (
  id, slug, name, status, city, vertical_id, created_at, updated_at,
  stripe_charges_enabled
) on public.tenants to anon;

-- Ägaren får ändra visningsdata (namn/stad), men aldrig abonnemang, status,
-- domänidentitet, bransch eller Stripe-readiness. Plattformen passerar vakten.
create or replace function private.guard_tenants_owner_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role'
    and not (select private.is_platform_admin()) and (
    new.id is distinct from old.id
    or new.slug is distinct from old.slug
    or new.plan is distinct from old.plan
    or new.status is distinct from old.status
    or new.stripe_account_id is distinct from old.stripe_account_id
    or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
    or new.stripe_payouts_enabled is distinct from old.stripe_payouts_enabled
    or new.stripe_details_submitted is distinct from old.stripe_details_submitted
    or new.vertical_id is distinct from old.vertical_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'platform_tenant_fields_are_read_only' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_tenants_owner_fields() from public;
drop trigger if exists trg_tenants_owner_guard on public.tenants;
create trigger trg_tenants_owner_guard
  before update on public.tenants
  for each row execute function private.guard_tenants_owner_fields();

-- ── Läsbar företagskonfiguration: tenantläsning, owner-write. ───────────────
drop policy if exists tenant_settings_rls on public.tenant_settings;
drop policy if exists locations_rls on public.locations;
drop policy if exists staff_rls on public.staff;
drop policy if exists services_rls on public.services;
drop policy if exists staff_services_rls on public.staff_services;
drop policy if exists working_hours_rls on public.working_hours;
drop policy if exists working_hour_slots_rls on public.working_hour_slots;

do $policy$
declare
  t text;
begin
  foreach t in array array[
    'tenant_settings', 'locations', 'staff', 'services',
    'staff_services', 'working_hours', 'working_hour_slots'
  ] loop
    execute format(
      'create policy tenant_config_read on public.%I for select to authenticated '
      || 'using ((tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 2) '
      || 'or (select private.is_platform_admin()))',
      t
    );
    execute format(
      'create policy tenant_config_write on public.%I for all to authenticated '
      || 'using ((tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6) '
      || 'or (select private.is_platform_admin())) '
      || 'with check ((tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6) '
      || 'or (select private.is_platform_admin()))',
      t
    );
  end loop;
end
$policy$;

-- tenant_settings är ett specialfall: owner-upserts behöver INSERT+UPDATE, men
-- DELETE får aldrig göra det möjligt att återskapa raden med egna fakturavärden.
drop policy if exists tenant_config_write on public.tenant_settings;
create policy tenant_settings_admin_insert on public.tenant_settings
  for insert to authenticated
  with check (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );
create policy tenant_settings_admin_update on public.tenant_settings
  for update to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  )
  with check (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );
create policy tenant_settings_platform_delete on public.tenant_settings
  for delete to authenticated
  using ((select private.is_platform_admin()));

-- Storefronten läser branding/settings och den publika betalningsgaten. Corevos
-- prislista mot tenanten (setup-/boknings-/månadsavgift) får aldrig följa med i
-- ett anonymt `select *`.
revoke select on table public.tenant_settings from anon;
grant select (
  id, tenant_id, payment_mode, branding, settings, payments_enabled,
  created_at, updated_at
) on public.tenant_settings to anon;

-- ── Senare modultabellers äldre tenant-only-policies. ───────────────────
-- 0057 skapades efter grund-RLS: dess generiska policies måste ersättas
-- uttryckligen, annars kan kund/stale JWT läsa PII eller mutera konfiguration.
drop policy if exists shop_shipping_options_tenant_all on public.shop_shipping_options;
create policy shop_shipping_options_admin_read on public.shop_shipping_options
  for select to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );
create policy shop_shipping_options_admin_write on public.shop_shipping_options
  for all to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  )
  with check (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );

drop policy if exists contact_messages_tenant_read on public.contact_messages;
drop policy if exists contact_messages_tenant_write on public.contact_messages;
create policy contact_messages_admin_read on public.contact_messages
  for select to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );
create policy contact_messages_admin_write on public.contact_messages
  for update to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  )
  with check (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );

drop policy if exists gallery_items_tenant_all on public.gallery_items;
create policy gallery_items_admin_read on public.gallery_items
  for select to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );
create policy gallery_items_admin_write on public.gallery_items
  for all to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  )
  with check (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );

drop policy if exists loyalty_plans_tenant_all on public.loyalty_plans;
create policy loyalty_plans_admin_read on public.loyalty_plans
  for select to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );
create policy loyalty_plans_admin_write on public.loyalty_plans
  for all to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  )
  with check (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );

drop policy if exists loyalty_members_tenant_all on public.loyalty_members;
create policy loyalty_members_scoped_read on public.loyalty_members
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or exists (
      select 1 from public.customers c
       where c.id = loyalty_members.customer_id
         and c.tenant_id = loyalty_members.tenant_id
         and c.auth_user_id = (select auth.uid())
    )
  );

-- Slot-holds är dormant. De gamla direkta anon/authenticated CRUD-policyerna
-- exponerade session_token och gjorde det möjligt att radera andras holds.
-- Skrivning ska endast ske genom place_slot_hold/release-RPC:n när funktionen
-- aktiveras; tills dess finns ingen direkt publik yta.
do $slot_holds$
begin
  if to_regclass('public.slot_holds') is not null then
    execute 'drop policy if exists slot_holds_rls on public.slot_holds';
    execute 'drop policy if exists slot_holds_public_read on public.slot_holds';
    execute 'drop policy if exists slot_holds_public_write on public.slot_holds';
    execute 'drop policy if exists slot_holds_public_release on public.slot_holds';
    execute $policy$
      create policy slot_holds_admin_read on public.slot_holds
        for select to authenticated
        using (
          (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
          or (select private.is_platform_admin())
        )
    $policy$;
  end if;
end
$slot_holds$;

-- Domänens verifieringsstatus kommer från Cloudflare/DCV. Ägaren får läsa
-- utfallet men aldrig själv skriva verified/is_primary via PostgREST.
drop policy if exists tenant_domains_rls on public.tenant_domains;
create policy tenant_domains_role_read on public.tenant_domains
  for select to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 2)
    or (select private.is_platform_admin())
  );
create policy tenant_domains_platform_write on public.tenant_domains
  for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- Plattformens abonnemangs-, fakturerings- och Stripe-aktiveringsfält är inte
-- ägarinställningar. Ägaren får fortsatt ändra bokning, design och sajtinnehåll.
create or replace function private.guard_tenant_settings_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role'
    and not (select private.is_platform_admin()) then
    if tg_op = 'INSERT' and (
      new.billing_model is distinct from 'per_booking'
      or new.service_fee_type is distinct from 'fixed'
      or new.service_fee_value is distinct from 500
      or new.setup_fee_cents is distinct from 0
      or new.per_booking_fee_cents is distinct from 0
      or new.flat_monthly_fee_cents is distinct from 0
      or new.payments_enabled is distinct from false
    ) then
      raise exception 'platform_billing_fields_are_read_only' using errcode = '42501';
    elsif tg_op = 'UPDATE' and (
      new.billing_model is distinct from old.billing_model
      or new.service_fee_type is distinct from old.service_fee_type
      or new.service_fee_value is distinct from old.service_fee_value
      or new.setup_fee_cents is distinct from old.setup_fee_cents
      or new.per_booking_fee_cents is distinct from old.per_booking_fee_cents
      or new.flat_monthly_fee_cents is distinct from old.flat_monthly_fee_cents
      or new.payments_enabled is distinct from old.payments_enabled
    ) then
      raise exception 'platform_billing_fields_are_read_only' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_tenant_settings_billing() from public;
drop trigger if exists trg_tenant_settings_billing_guard on public.tenant_settings;
create trigger trg_tenant_settings_billing_guard
  before insert or update of billing_model, service_fee_type, service_fee_value,
    setup_fee_cents, per_booking_fee_cents, flat_monthly_fee_cents, payments_enabled
  on public.tenant_settings
  for each row execute function private.guard_tenant_settings_billing();

-- ── Frånvaro: hela arbetslaget läser; personal skriver bara sin egen rad. ───
drop policy if exists time_off_rls on public.time_off;
create policy time_off_staff_read on public.time_off
  for select to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 3)
    or (select private.is_platform_admin())
  );
create policy time_off_admin_write on public.time_off
  for all to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  )
  with check (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
    or (select private.is_platform_admin())
  );
create policy time_off_self_write on public.time_off
  for all to authenticated
  using (
    tenant_id = (select private.tenant_id())
    and (select private.role_level()) >= 3
    and exists (
      select 1 from public.staff s
       where s.id = time_off.staff_id
         and s.tenant_id = time_off.tenant_id
         and s.profile_id = (select auth.uid())
    )
  )
  with check (
    tenant_id = (select private.tenant_id())
    and (select private.role_level()) >= 3
    and exists (
      select 1 from public.staff s
       where s.id = time_off.staff_id
         and s.tenant_id = time_off.tenant_id
         and s.profile_id = (select auth.uid())
    )
  );

-- ── Kundregistret: personalens arbetsyta, kunden själv bara egen rad. ────────
drop policy if exists customers_rls on public.customers;
create policy customers_role_read on public.customers
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and ((select private.role_level()) >= 3 or auth_user_id = (select auth.uid()))
    )
  );
create policy customers_staff_write on public.customers
  for all to authenticated
  using (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 3)
    or (select private.is_platform_admin())
  )
  with check (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 3)
    or (select private.is_platform_admin())
  );
create policy customers_self_insert on public.customers
  for insert to authenticated
  with check (
    tenant_id = (select private.tenant_id())
    and auth_user_id = (select auth.uid())
  );

-- ── Bokningar: egen kundrad/personal får läsa; personal skriver. ─────
-- Kundens avbokning går genom den servervaktade actionen (cutoff, refund, notis,
-- spårbarhet), aldrig som en rå PostgREST-UPDATE.
drop policy if exists bookings_rls on public.bookings;
drop policy if exists bookings_customer_cancel on public.bookings;
create policy bookings_role_read on public.bookings
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and ((select private.role_level()) >= 3 or customer_profile_id = (select auth.uid()))
    )
  );
drop policy if exists bookings_staff_write on public.bookings;
create policy bookings_staff_insert on public.bookings
  for insert to authenticated
  with check (
    (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 3)
    or (select private.is_platform_admin())
  );
drop trigger if exists trg_customer_booking_update_guard on public.bookings;

-- Betalningar skrivs av webhook/service role. Authenticated får bara läsa den
-- egna betalningen (kund) eller tenantens betalningar (personal/admin).
drop policy if exists payments_rls on public.payments;
create policy payments_role_read on public.payments
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (select private.role_level()) >= 3
        or exists (
          select 1 from public.bookings b
           where b.id = payments.booking_id
             and b.customer_profile_id = (select auth.uid())
        )
      )
    )
  );

drop policy if exists booking_status_history_select on public.booking_status_history;
create policy booking_status_history_role_read on public.booking_status_history
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (
      tenant_id = (select private.tenant_id())
      and (
        (select private.role_level()) >= 3
        or exists (
          select 1 from public.bookings b
           where b.id = booking_status_history.booking_id
             and b.customer_profile_id = (select auth.uid())
        )
      )
    )
  );

-- ── Privata admin-/modultabeller: endast ägare eller plattform. ─────────────
drop policy if exists content_slots_rls on public.content_slots;
drop policy if exists media_assets_rls on public.media_assets;
drop policy if exists blog_posts_rls on public.blog_posts;
drop policy if exists shop_products_rls on public.shop_products;
drop policy if exists shop_variants_rls on public.shop_product_variants;
drop policy if exists shop_orders_rls on public.shop_orders;
drop policy if exists shop_order_items_rls on public.shop_order_items;
drop policy if exists offert_requests_rls on public.offert_requests;
drop policy if exists gift_cards_rls on public.gift_cards;
drop policy if exists tenant_events_rls on public.tenant_events;
drop policy if exists event_registrations_rls on public.event_registrations;
drop policy if exists payment_disputes_rls on public.payment_disputes;

do $policy$
declare
  t text;
begin
  foreach t in array array[
    'content_slots', 'media_assets', 'blog_posts', 'shop_products',
    'shop_product_variants', 'shop_orders', 'shop_order_items', 'offert_requests',
    'gift_cards', 'tenant_events', 'event_registrations', 'payment_disputes'
  ] loop
    execute format(
      'create policy admin_private_data_read on public.%I for select to authenticated '
      || 'using ((tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6) '
      || 'or (select private.is_platform_admin()))',
      t
    );
  end loop;

  -- Redaktionell katalogdata får owner-CRUD. Finansiella/order-/anmälansrader
  -- får smalare policies och maskinägda fältvakter direkt efter loopen.
  foreach t in array array[
    'content_slots', 'media_assets', 'blog_posts', 'shop_products',
    'shop_product_variants', 'offert_requests', 'tenant_events'
  ] loop
    execute format(
      'create policy admin_private_data_write on public.%I for all to authenticated '
      || 'using ((tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6) '
      || 'or (select private.is_platform_admin())) '
      || 'with check ((tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6) '
      || 'or (select private.is_platform_admin()))',
      t
    );
  end loop;
end
$policy$;

-- Ordern är en maskinbyggd snapshot. Owner får bara köra den manuella
-- leverans-FSM:n och sätta spårning; betalning, belopp, lagerlatch och kundsnapshot
-- ägs av checkout/webhook-RPC:erna.
create policy shop_orders_owner_update on public.shop_orders
  for update to authenticated
  using (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
  with check (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6);
create policy shop_orders_platform_write on public.shop_orders
  for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create or replace function private.guard_shop_order_owner_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role')
    or coalesce((select auth.role()), '') = 'service_role'
    or (select private.is_platform_admin()) then
    return new;
  end if;
  if (to_jsonb(new) - array['status','tracking_number','carrier','shipped_at','updated_at'])
     is distinct from
     (to_jsonb(old) - array['status','tracking_number','carrier','shipped_at','updated_at']) then
    raise exception 'machine_owned_order_fields_are_read_only' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'pending' and new.status in ('confirmed','cancelled')) or
    (old.status = 'confirmed' and new.status in ('ready','cancelled')) or
    (old.status = 'ready' and new.status = 'completed') or
    (old.status not in ('pending','confirmed','ready','completed','cancelled') and new.status = 'cancelled')
  ) then
    raise exception 'invalid_shop_order_status_transition' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_shop_order_owner_update() from public;
drop trigger if exists trg_shop_order_owner_guard on public.shop_orders;
create trigger trg_shop_order_owner_guard before update on public.shop_orders
  for each row execute function private.guard_shop_order_owner_update();

-- Orderrader och Stripe-tvister skrivs bara av checkout/webhook eller plattform.
create policy shop_order_items_platform_write on public.shop_order_items
  for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
create policy payment_disputes_platform_write on public.payment_disputes
  for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- Manuella presentkort får utfärdas av owner, men ett befintligt kort får bara
-- makuleras active→void. Saldo, orderlänk och mejllatch är maskinägda.
create policy gift_cards_owner_insert on public.gift_cards
  for insert to authenticated
  with check (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6);
create policy gift_cards_owner_update on public.gift_cards
  for update to authenticated
  using (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
  with check (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6);
create policy gift_cards_platform_write on public.gift_cards
  for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create or replace function private.guard_gift_card_owner_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role')
    or coalesce((select auth.role()), '') = 'service_role'
    or (select private.is_platform_admin()) then
    return new;
  end if;
  if tg_op = 'INSERT' and (
    new.status <> 'active'
    or new.balance_cents is distinct from new.initial_amount_cents
    or new.order_id is not null or new.order_item_id is not null
    or new.issued_at is not null or new.emailed_at is not null
  ) then
    raise exception 'invalid_manual_gift_card' using errcode = '42501';
  elsif tg_op = 'UPDATE' and (
    (to_jsonb(new) - array['status','updated_at']) is distinct from
      (to_jsonb(old) - array['status','updated_at'])
    or old.status <> 'active' or new.status <> 'void'
  ) then
    raise exception 'gift_card_machine_fields_are_read_only' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_gift_card_owner_write() from public;
drop trigger if exists trg_gift_card_owner_guard on public.gift_cards;
create trigger trg_gift_card_owner_guard before insert or update on public.gift_cards
  for each row execute function private.guard_gift_card_owner_write();

-- Deltagaruppgifter skapas av intake/checkout. Owner får endast bekräfta eller
-- avboka en befintlig registrering; paid order_item-länkar kan inte förfalskas.
create policy event_registrations_owner_update on public.event_registrations
  for update to authenticated
  using (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6)
  with check (tenant_id = (select private.tenant_id()) and (select private.role_level()) >= 6);
create policy event_registrations_platform_write on public.event_registrations
  for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create or replace function private.guard_event_registration_owner_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role')
    or coalesce((select auth.role()), '') = 'service_role'
    or (select private.is_platform_admin()) then
    return new;
  end if;
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'registration_identity_is_read_only' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_event_registration_owner_update() from public;
drop trigger if exists trg_event_registration_owner_guard on public.event_registrations;
create trigger trg_event_registration_owner_guard before update on public.event_registrations
  for each row execute function private.guard_event_registration_owner_update();

-- Auditloggen innehåller revisionsdata och kan inte muteras. Endast plattformen
-- läser/skriver direkt; GDPR-flödet använder service role.
drop policy if exists audit_log_select on public.audit_log;
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_platform_select on public.audit_log
  for select to authenticated
  using ((select private.is_platform_admin()));
create policy audit_log_platform_insert on public.audit_log
  for insert to authenticated
  with check ((select private.is_platform_admin()));
