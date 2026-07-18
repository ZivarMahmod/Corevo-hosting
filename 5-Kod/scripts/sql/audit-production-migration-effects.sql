-- Read-only production audit for migration effects that were applied outside the
-- normal Supabase CLI history. This file must never mutate schema, data, grants,
-- policies, or migration history.
--
-- Run from 5-Kod/:
--   supabase db query --linked --file scripts/sql/audit-production-migration-effects.sql

with checks(version, check_name, passed, evidence) as (
  values
    (
      '0014',
      'slot-hold schema contract',
      to_regclass('public.slot_holds') is not null
        and to_regprocedure('public.prune_expired_slot_holds()') is not null,
      'history records 0014, but table and prune RPC must also exist'
    ),
    (
      '0029',
      'global platform identity schema contract',
      exists (
        select 1
          from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = 'users'
           and c.column_name = 'tenant_id'
           and c.is_nullable = 'YES'
      ),
      'history records 0029; users.tenant_id must allow NULL for global platform operators'
    ),
    (
      '0060',
      'booking cancellation audit columns and index',
      to_regclass('public.bookings_cancelled_recent_idx') is not null
        and exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'bookings'
            and column_name = 'cancelled_at' and data_type = 'timestamp with time zone'
        )
        and exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'bookings'
            and column_name = 'cancelled_by' and data_type = 'text'
        )
        and exists (
          select 1
          from pg_constraint c
          where c.conrelid = 'public.bookings'::regclass
            and c.contype = 'c'
            and pg_get_constraintdef(c.oid) ilike '%cancelled_by%customer%business%system%'
        ),
      'bookings.cancelled_at/cancelled_by + bookings_cancelled_recent_idx'
    ),
    (
      '0061',
      'block series and customer flags',
      to_regclass('public.time_off_series_idx') is not null
        and exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'time_off'
            and column_name = 'series_id' and data_type = 'uuid'
        )
        and exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'customers'
            and column_name = 'hidden_at' and data_type = 'timestamp with time zone'
        )
        and exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'customers'
            and column_name = 'self_book' and data_type = 'boolean'
            and is_nullable = 'NO' and column_default ilike '%true%'
        ),
      'time_off.series_id + customers.hidden_at/self_book + time_off_series_idx'
    ),
    (
      '0062',
      'staff calendar color fence',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'staff'
          and column_name = 'color' and data_type = 'text'
      )
      and exists (
        select 1 from pg_constraint c
        where c.conrelid = 'public.staff'::regclass
          and c.conname = 'staff_color_hex'
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) like '%[0-9a-fA-F]{6}%'
      ),
      'staff.color + staff_color_hex'
    ),
    (
      '0063',
      'no-show booking status',
      exists (
        select 1 from pg_constraint c
        where c.conrelid = 'public.bookings'::regclass
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) ilike '%no_show%'
      ),
      'bookings status check contains no_show'
    ),
    (
      '0064',
      'idempotency catches exclusion violations',
      to_regprocedure(
        'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)'
      ) is not null
      and pg_get_functiondef(to_regprocedure(
        'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)'
      )) ilike '%exclusion_violation%'
      and pg_get_functiondef(to_regprocedure(
        'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)'
      )) ilike '%request_id%return%v_id%'
      ,
      'create_public_booking contains retry/idempotency handler'
    ),
    (
      '0065',
      'tenant module role fence',
      (select relrowsecurity from pg_class where oid = 'public.tenant_modules'::regclass)
      and not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'tenant_modules'
          and policyname = 'tenant_modules_rls'
      )
      and not exists (
        select required.policyname
        from (values
          ('tenant_modules_read'),
          ('tenant_modules_write'),
          ('tenant_modules_platform_insert'),
          ('tenant_modules_platform_delete')
        ) required(policyname)
        where not exists (
          select 1 from pg_policies p
          where p.schemaname = 'public' and p.tablename = 'tenant_modules'
            and p.policyname = required.policyname
        )
      ),
      'RLS enabled; broad tenant_modules_rls removed; split policies present'
    ),
    (
      '0066',
      'vertical seeds and florist terminology',
      (
        select count(*) = 5
        from public.verticals
        where key in ('ateljé','tatueringsstudio','verkstad','ekonomibyrå','rådgivning')
          and default_template = 'edit'
      )
      and coalesce((
        select terminology->>'service' = 'Beställning'
        from public.verticals where key = 'florist'
      ), false),
      'five general verticals use edit; florist service term is Beställning'
    ),
    (
      '0067',
      'admin customer aggregate RPC',
      to_regprocedure('public.admin_customer_rows(uuid,uuid)') is not null
      and not (select p.prosecdef from pg_proc p
               where p.oid = to_regprocedure('public.admin_customer_rows(uuid,uuid)'))
      and pg_get_functiondef(to_regprocedure('public.admin_customer_rows(uuid,uuid)'))
          ilike '%count(*)%sum(%loyalty_ledger%'
      and has_function_privilege(
        'authenticated', 'public.admin_customer_rows(uuid,uuid)', 'EXECUTE'
      )
      and not has_function_privilege(
        'anon', 'public.admin_customer_rows(uuid,uuid)', 'EXECUTE'
      ),
      'SECURITY INVOKER aggregate; authenticated only'
    ),
    (
      '0068',
      'automatic confirmation for pay-on-site bookings',
      pg_get_functiondef(to_regprocedure(
        'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)'
      )) ilike '%require_booking_approval%payments_enabled%stripe_charges_enabled%'
      and not exists (
        select 1
        from public.bookings b
        where b.status = 'pending'
          and b.created_at < now() - interval '10 minutes'
          and not exists (select 1 from public.payments p where p.booking_id = b.id)
          and coalesce((
            select (ts.settings->>'require_booking_approval')::boolean
            from public.tenant_settings ts where ts.tenant_id = b.tenant_id
          ), false) = false
      ),
      'RPC chooses approval/payment-aware status; no stale eligible pending rows'
    ),
    (
      '0083',
      'organization-owner permission fence',
      to_regprocedure(
        'public.set_tenant_member_permissions(uuid,text,boolean,boolean,boolean,boolean)'
      ) is not null
      and pg_get_functiondef(to_regprocedure(
        'public.set_tenant_member_permissions(uuid,text,boolean,boolean,boolean,boolean)'
      )) ilike '%organization_owner_required%'
      and pg_get_functiondef(to_regprocedure(
        'public.set_tenant_member_permissions(uuid,text,boolean,boolean,boolean,boolean)'
      )) ilike '%has_organization_scope%'
      and exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'tenant_member_permissions'
          and policyname = 'tenant_member_permissions_read'
          and qual ilike '%has_organization_scope%'
      )
      and has_function_privilege(
        'authenticated',
        'public.set_tenant_member_permissions(uuid,text,boolean,boolean,boolean,boolean)',
        'EXECUTE'
      )
      and not has_function_privilege(
        'anon',
        'public.set_tenant_member_permissions(uuid,text,boolean,boolean,boolean,boolean)',
        'EXECUTE'
      ),
      'owner-scoped read policy and mutation RPC'
    ),
    (
      '0084',
      'anonymous intake tables are closed',
      not has_table_privilege('anon', 'public.contact_messages', 'INSERT')
      and not has_table_privilege('authenticated', 'public.contact_messages', 'INSERT')
      and not has_table_privilege('anon', 'public.offert_requests', 'INSERT')
      and not has_table_privilege('authenticated', 'public.offert_requests', 'INSERT')
      and not has_table_privilege('anon', 'public.event_registrations', 'INSERT')
      and not has_table_privilege('authenticated', 'public.event_registrations', 'INSERT')
      and has_table_privilege('service_role', 'public.contact_messages', 'INSERT')
      and has_table_privilege('service_role', 'public.offert_requests', 'INSERT')
      and has_table_privilege('service_role', 'public.event_registrations', 'INSERT'),
      'contact/offert/event INSERT is service_role-only'
    ),
    (
      '0085',
      'payment and public-write RPC grants are protected',
      not exists (
        select signature
        from (values
          ('public.mark_shop_order_paid(uuid)'),
          ('public._commit_shop_order_stock(uuid)'),
          ('public._generate_gift_code(uuid,text)'),
          ('public.prune_expired_shop_reserves()'),
          ('public.check_rate_limit(text,integer,integer)'),
          ('public.reserve_shop_order(text,jsonb,text,text,integer)'),
          ('public.join_loyalty_club(text,text,text,uuid)')
        ) expected(signature)
        where to_regprocedure(signature) is null
          or has_function_privilege('anon', signature, 'EXECUTE')
          or has_function_privilege('authenticated', signature, 'EXECUTE')
          or not has_function_privilege('service_role', signature, 'EXECUTE')
      )
      and not has_function_privilege(
        'anon',
        'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)',
        'EXECUTE'
      )
      and has_function_privilege(
        'authenticated',
        'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)',
        'EXECUTE'
      )
      and (
        has_function_privilege(
          'service_role',
          'public.create_public_booking(text,uuid,uuid,timestamptz,text,uuid,text,text,text,uuid,uuid)',
          'EXECUTE'
        )
        or (
          to_regprocedure(
            'public.create_storefront_booking_with_release(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean)'
          ) is not null
          and not coalesce(has_function_privilege(
            'anon',
            to_regprocedure(
              'public.create_storefront_booking_with_release(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean)'
            ),
            'EXECUTE'
          ), false)
          and not coalesce(has_function_privilege(
            'authenticated',
            to_regprocedure(
              'public.create_storefront_booking_with_release(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean)'
            ),
            'EXECUTE'
          ), false)
          and coalesce(has_function_privilege(
            'service_role',
            to_regprocedure(
              'public.create_storefront_booking_with_release(text,uuid,uuid,timestamptz,text,text,text,text,uuid,uuid,boolean)'
            ),
            'EXECUTE'
          ), false)
        )
      ),
      'commit/intake RPCs service-only; authenticated booking exception and narrow storefront release path retained'
    ),
    (
      '0086',
      'atomic onsite event registration',
      to_regprocedure(
        'public.create_onsite_event_registration(uuid,uuid,text,text,text,integer,text)'
      ) is not null
      and pg_get_functiondef(to_regprocedure(
        'public.create_onsite_event_registration(uuid,uuid,text,text,text,integer,text)'
      )) ilike '%for update%event_capacity_exceeded%'
      and not has_function_privilege(
        'anon',
        'public.create_onsite_event_registration(uuid,uuid,text,text,text,integer,text)',
        'EXECUTE'
      )
      and has_function_privilege(
        'service_role',
        'public.create_onsite_event_registration(uuid,uuid,text,text,text,integer,text)',
        'EXECUTE'
      ),
      'locked capacity check and service-only RPC'
    ),
    (
      '0087',
      'atomic shop refund recording',
      to_regprocedure('public.record_shop_order_refund(uuid)') is not null
      and pg_get_functiondef(to_regprocedure('public.record_shop_order_refund(uuid)'))
          ilike '%shop_payment_missing%payment_status%refunded%'
      and not has_function_privilege(
        'anon', 'public.record_shop_order_refund(uuid)', 'EXECUTE'
      )
      and has_function_privilege(
        'service_role', 'public.record_shop_order_refund(uuid)', 'EXECUTE'
      ),
      'payment and order update atomically; service-only RPC'
    ),
    (
      '0088',
      'atomic reminder claims',
      to_regclass('public.bookings_due_reminder_claim_idx') is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'bookings'
          and column_name = 'reminder_claim_token' and data_type = 'uuid'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'bookings'
          and column_name = 'reminder_claimed_at'
          and data_type = 'timestamp with time zone'
      )
      and pg_get_functiondef(to_regprocedure(
        'public.claim_due_booking_reminders(uuid,timestamptz,timestamptz,integer)'
      )) ilike '%for update skip locked%'
      and not has_function_privilege(
        'anon',
        'public.claim_due_booking_reminders(uuid,timestamptz,timestamptz,integer)',
        'EXECUTE'
      )
      and has_function_privilege(
        'service_role',
        'public.claim_due_booking_reminders(uuid,timestamptz,timestamptz,integer)',
        'EXECUTE'
      ),
      'lease columns/index + SKIP LOCKED service RPC'
    ),
    (
      '0089',
      'contact-message retention',
      to_regprocedure('public.prune_contact_messages(integer)') is not null
      and pg_get_functiondef(to_regprocedure('public.prune_contact_messages(integer)'))
          ilike '%invalid_retention_months%delete from public.contact_messages%'
      and not has_function_privilege(
        'anon', 'public.prune_contact_messages(integer)', 'EXECUTE'
      )
      and has_function_privilege(
        'service_role', 'public.prune_contact_messages(integer)', 'EXECUTE'
      ),
      'guarded 18-month retention RPC; service-only'
    ),
    (
      '0090',
      'database cron sweeps',
      to_regclass('cron.job') is not null
      and not exists (
        select required.jobname, required.schedule
        from (values
          ('corevo-expire-pending-bookings', '*/15 * * * *'),
          ('corevo-prune-shop-reserves', '*/15 * * * *'),
          ('corevo-prune-slot-holds', '*/15 * * * *'),
          ('corevo-prune-contact-messages', '10 4 * * *')
        ) required(jobname, schedule)
        where not exists (
          select 1 from cron.job j
          where j.jobname = required.jobname
            and j.schedule = required.schedule
            and j.active = true
        )
      ),
      'four active named pg_cron jobs with expected schedules'
    ),
    (
      '0091',
      'engagement data foundation',
      not exists (
        select required.table_name
        from (values
          ('customer_notification_prefs'),
          ('notifications_outbox'),
          ('push_subscriptions')
        ) required(table_name)
        where to_regclass('public.' || required.table_name) is null
          or not (select c.relrowsecurity
                  from pg_class c where c.oid = to_regclass('public.' || required.table_name))
      )
      and not exists (
        select required.index_name
        from (values
          ('customer_notification_prefs_tenant_idx'),
          ('notifications_outbox_freq_idx'),
          ('push_subscriptions_customer_idx')
        ) required(index_name)
        where to_regclass('public.' || required.index_name) is null
      )
      and (
        to_regclass('public.notifications_outbox_queued_idx') is not null
        or to_regclass('public.notifications_outbox_claim_idx') is not null
      )
      and not exists (
        select required.table_name, required.policy_name
        from (values
          ('customer_notification_prefs', 'notification_prefs_read'),
          ('customer_notification_prefs', 'notification_prefs_write'),
          ('notifications_outbox', 'notifications_outbox_read'),
          ('push_subscriptions', 'push_subscriptions_own')
        ) required(table_name, policy_name)
        where not exists (
          select 1 from pg_policies p
          where p.schemaname = 'public'
            and p.tablename = required.table_name
            and p.policyname = required.policy_name
        )
      )
      and not exists (
        select required.table_name, required.column_name
        from (values
          ('customer_notification_prefs','customer_id'),
          ('customer_notification_prefs','tenant_id'),
          ('customer_notification_prefs','push_enabled'),
          ('customer_notification_prefs','email_enabled'),
          ('customer_notification_prefs','sms_enabled'),
          ('customer_notification_prefs','preferred_channel'),
          ('customer_notification_prefs','marketing_consent'),
          ('customer_notification_prefs','marketing_consent_at'),
          ('customer_notification_prefs','marketing_consent_source'),
          ('customer_notification_prefs','want_reminders'),
          ('customer_notification_prefs','want_offers'),
          ('customer_notification_prefs','want_open_slots'),
          ('customer_notification_prefs','want_recommendations'),
          ('customer_notification_prefs','created_at'),
          ('customer_notification_prefs','updated_at'),
          ('notifications_outbox','id'),
          ('notifications_outbox','tenant_id'),
          ('notifications_outbox','customer_id'),
          ('notifications_outbox','booking_id'),
          ('notifications_outbox','staff_id'),
          ('notifications_outbox','event_type'),
          ('notifications_outbox','category'),
          ('notifications_outbox','chosen_channel'),
          ('notifications_outbox','fallback_channel'),
          ('notifications_outbox','consent_state'),
          ('notifications_outbox','status'),
          ('notifications_outbox','skip_reason'),
          ('notifications_outbox','cost_ore'),
          ('notifications_outbox','provider_ref'),
          ('notifications_outbox','created_at'),
          ('notifications_outbox','sent_at'),
          ('notifications_outbox','delivered_at'),
          ('push_subscriptions','id'),
          ('push_subscriptions','tenant_id'),
          ('push_subscriptions','customer_id'),
          ('push_subscriptions','endpoint'),
          ('push_subscriptions','p256dh'),
          ('push_subscriptions','auth'),
          ('push_subscriptions','user_agent'),
          ('push_subscriptions','created_at'),
          ('push_subscriptions','last_seen_at'),
          ('push_subscriptions','revoked_at')
        ) required(table_name, column_name)
        where not exists (
          select 1 from information_schema.columns c
          where c.table_schema = 'public'
            and c.table_name = required.table_name
            and c.column_name = required.column_name
        )
      ),
      'three RLS tables, four policies, four indexes, all declared columns'
    )
)
select version, check_name, passed, evidence
from checks
order by version;
