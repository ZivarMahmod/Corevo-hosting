import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')

describe('0095 booking outcome truth', () => {
  const sql = fs.readFileSync(
    path.join(CODE_ROOT, 'supabase', 'migrations', '0095_booking_outcome_truth.sql'),
    'utf8',
  )
  const runtimeSql = fs.readFileSync(
    path.join(CODE_ROOT, 'supabase', 'tests', 'booking_outcome_truth_0095_test.sql'),
    'utf8',
  )
  const loyaltyAuthRuntimeSql = fs.readFileSync(
    path.join(CODE_ROOT, 'supabase', 'tests', 'loyalty_totals_authorization_0095_test.sql'),
    'utf8',
  )

  it('vaktar completed/no_show mot end_ts för alla roller', () => {
    expect(sql).toContain('create or replace function private.enforce_booking_outcome_time')
    expect(sql).toContain("new.status in ('completed', 'no_show')")
    expect(sql).toContain("tg_op = 'INSERT'")
    expect(sql).toContain('new.end_ts > v_now')
    expect(sql).toContain('old.end_ts > pg_catalog.statement_timestamp()')
    expect(sql).toContain('create trigger trg_enforce_booking_outcome_time')
    expect(sql).toMatch(/before insert or update of[\s\S]*?on public\.bookings/)
    const body = sql.match(
      /create or replace function private\.enforce_booking_outcome_time\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/,
    )?.[1]
    expect(body).toBeTruthy()
    const executable = body?.replace(/--.*$/gm, '') ?? ''
    expect(executable).not.toContain('auth.role()')
    expect(executable).not.toContain('service_role')
  })

  it('låser terminalt schema och kräver ett utfall för passerade aktiva bokningar', () => {
    expect(sql).toContain("old.status in ('completed', 'no_show')")
    expect(sql).toContain('terminal_booking_schedule_read_only')
    expect(sql).toContain("old.status in ('pending', 'confirmed')")
    expect(sql).toContain('old.end_ts <= pg_catalog.statement_timestamp()')
    expect(sql).toContain('past_booking_requires_outcome')
    expect(sql).toContain('past_booking_schedule_read_only')
  })

  it('återställer cancelled endast innan den ursprungliga starten och använder inte auth.role()', () => {
    expect(sql).toContain("old.status = 'cancelled'")
    expect(sql).toContain("new.status in ('pending', 'confirmed')")
    expect(sql).toContain('old.start_ts <= pg_catalog.statement_timestamp()')
    expect(sql).toContain('cancelled_booking_already_started')
    expect(sql).not.toContain('auth.role()')
    expect(sql).toContain("current_setting('request.jwt.claim.role', true)")
  })

  it('gör samma status idempotent och visitaggregeringen completed-only', () => {
    expect(sql).toContain('new.status is distinct from old.status')
    expect(sql).toContain("b.status = 'completed'")
    expect(sql).not.toContain("b.status in ('pending', 'confirmed', 'completed')")
  })

  it('fencar personalens mutation till tenant, egen personal och end_ts', () => {
    const personal = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'personal', 'actions.ts'), 'utf8')
    expect(personal).toContain(".select('id, status, end_ts, customer_id, staff_id')")
    expect(personal).toContain(".eq('tenant_id', user.tenantId ?? '')")
    expect(personal).toContain(".in('staff_id', myStaffIds)")
    expect(personal).toContain(".lte('end_ts', nowIso)")
  })

  it('producerar completion som en atomisk, icke-levererbar routing-händelse', () => {
    const admin = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'admin', 'actions.ts'), 'utf8')
    expect(sql).toContain('create or replace function private.enqueue_booking_completed_event')
    expect(sql).toContain('insert into public.notifications_outbox')
    expect(sql).toContain("'booking_completed'")
    expect(sql).toContain("'booking:' || new.id::text || ':completed'")
    expect(sql).toContain('notifications_outbox_routing_unique')
    expect(sql).toContain('where chosen_channel is null')
    expect(sql).toContain("'marketing', null, null")
    expect(sql).toContain("'routing', 5, pg_catalog.statement_timestamp()")
    expect(sql).not.toMatch(/'booking_completed'[\s\S]{0,700}'email'/)
    expect(sql).not.toMatch(/'booking_completed'[\s\S]{0,700}jsonb_build_object\('producer'/)
    expect(sql).toMatch(
      /create trigger trg_enqueue_booking_completed_event[\s\S]*?after update of status on public\.bookings/,
    )
    expect(admin).not.toContain('enqueueNotification')
    expect(admin).not.toContain('sendReviewNudgeForBooking')
    expect(admin).not.toContain("channel: 'sms'")
  })

  it('ogiltigförklarar oskickat completion-event vid no_show och återöppnar bara egen korrigering', () => {
    const body = sql.match(
      /create or replace function private\.enqueue_booking_completed_event\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/,
    )?.[1]
    expect(body).toBeTruthy()
    expect(body).toContain("new.status = 'no_show' and old.status = 'completed'")
    expect(body).toContain("status in ('routing', 'queued', 'attempting')")
    expect(body).toContain("skip_reason = 'booking_outcome_changed'")
    expect(body).toContain('lease_token = null')
    expect(body).toContain('lease_expires_at = null')
    expect(body).toContain("status = 'skipped'")
    expect(body).toContain("skip_reason = 'booking_outcome_changed'")
    expect(body).toContain("status = 'routing'")
    expect(body).toContain('chosen_channel = null')
    expect(body).toContain('consent_state = null')
    expect(body).toMatch(/status = 'skipped'[\s\S]*?skip_reason = 'booking_outcome_changed'/)
    const noShowBranch =
      body?.match(
        /if new\.status = 'no_show' and old\.status = 'completed' then([\s\S]*?)return new;/,
      )?.[1] ?? ''
    expect(noShowBranch).not.toContain('delivery_started')
    expect(noShowBranch).not.toContain("'sent'")
    expect(noShowBranch).not.toContain("'delivered'")
  })

  it('låter personalens statuswrite förlita sig på samma atomiska DB-event', () => {
    const personal = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'personal', 'actions.ts'), 'utf8')
    expect(personal).not.toContain('enqueueNotification')
    expect(personal).not.toContain('sendReviewNudgeForBooking')
    expect(personal).not.toContain("channel: 'sms'")
  })

  it('ger bara expiry-svepet en exakt intern väg för passerade pending-rader', () => {
    expect(sql).toContain('create or replace function public.expire_abandoned_pending_bookings')
    expect(sql).toContain(
      "set_config('app.booking_outcome_internal_intent', 'pending_expiry', true)",
    )
    expect(sql).toContain(
      "current_setting('app.booking_outcome_internal_intent', true) = 'pending_expiry'",
    )
    expect(sql).toContain("new.cancelled_by = 'system'")
    expect(sql).toContain("new.status = 'cancelled'")
    expect(sql).toContain("p.status = 'pending'")
    expect(sql).not.toMatch(/past_booking_requires_outcome[\s\S]{0,500}service_role/)
  })

  it('tillåter bara direkt completed/no_show-korrigering och bokför reversal/re-earn', () => {
    expect(sql).toContain("old.status = 'completed' and new.status = 'no_show'")
    expect(sql).toContain("old.status = 'no_show' and new.status = 'completed'")
    expect(sql).not.toContain(
      "old.status = 'completed' and new.status in ('pending','confirmed','cancelled')",
    )
    expect(sql).not.toContain(
      "old.status = 'no_show'   and new.status in ('pending','confirmed','cancelled')",
    )
    expect(sql).toContain("'booking_completed_reversal'")
    expect(sql).toContain("'booking_completed_reearn'")
    expect(sql).toContain('least(v_booking_points, greatest(v_customer_balance, 0))')
    expect(sql).toMatch(
      /select[\s\S]*?reason = 'earn_completed'[\s\S]*?if v_earned_points > 0 then/,
    )
    expect(sql).toMatch(
      /if v_earned_points > 0 then[\s\S]*?booking_completed_reearn[\s\S]*?return new;/,
    )
  })

  it('räknar livstid tenantbrett bakom en explicit auktoriserad definer-RPC', () => {
    const customerPortal = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'kund', 'loyalty.ts'), 'utf8')
    const staffCard = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'personal', 'customer.ts'), 'utf8')
    const totals = sql.match(
      /create or replace function public\.customer_loyalty_totals\([\s\S]*?comment on function public\.customer_loyalty_totals\(uuid, uuid\)[\s\S]*?;/,
    )?.[0]
    expect(totals).toBeTruthy()
    expect(sql).toContain('create or replace function public.customer_loyalty_totals')
    expect(sql).toContain("ll.reason = 'earn_completed' and b.status = 'completed'")
    expect(sql).toContain("ll.reason = 'adjustment'")
    expect(sql).toContain('ll.booking_id is null')
    expect(sql).toContain('ll.tenant_id = p_tenant')
    expect(sql).toContain('ll.customer_id = p_customer')
    expect(totals).toContain('security definer')
    expect(totals).toContain("set search_path = ''")
    expect(totals).toContain('auth.uid()')
    expect(totals).toContain("u.status = 'active'")
    expect(totals).toContain('r.tenant_id = p_tenant')
    expect(totals).toContain('for share of u, r')
    expect(totals).toContain("c.status = 'active'")
    expect(totals).not.toContain('private.is_platform_admin()')
    expect(totals).not.toContain('private.can_access_customer(')
    expect(totals).toContain('from public, anon, authenticated, service_role')
    expect(totals).toContain('to authenticated')
    expect(totals).not.toContain('to authenticated, service_role')
    expect(customerPortal).toContain("rpc('customer_loyalty_totals'")
    expect(staffCard).toContain("rpc('customer_loyalty_totals'")
    expect(customerPortal).not.toContain(
      ".from('loyalty_ledger')\n      .select('points_delta, reason')",
    )
    expect(staffCard).not.toContain(".from('loyalty_ledger').select('points_delta')")
  })

  it('runtime-provar totalsyn utan att bredda rå bokningsåtkomst', () => {
    expect(loyaltyAuthRuntimeSql).toContain('restricted_staff_raw_booking_count_')
    expect(loyaltyAuthRuntimeSql).toContain('restricted_staff_totals_inconsistent_')
    expect(loyaltyAuthRuntimeSql).toContain('cross_tenant_totals_succeeded')
    expect(loyaltyAuthRuntimeSql).toContain('customer_own_totals_wrong_')
    expect(loyaltyAuthRuntimeSql).toContain('customer_other_totals_succeeded')
    expect(loyaltyAuthRuntimeSql).toContain('inactive_user_totals_succeeded')
    expect(loyaltyAuthRuntimeSql).toContain('platform_role_totals_succeeded')
  })

  it('runtime-låser atomisk rollback/retry, blandad expiry och korrigeringsidempotens', () => {
    expect(runtimeSql).toContain('completion_survived_outbox_failure')
    expect(runtimeSql).toContain('outbox_failure_did_not_rollback_status')
    expect(runtimeSql).toContain('completion_outbox_not_exactly_once')
    expect(runtimeSql).toContain('expiry_mixed_count_')
    expect(runtimeSql).toContain('expiry_touched_noncheckout_pending')
    expect(runtimeSql).toContain('completed_reopened_to_confirmed')
    expect(runtimeSql).toContain('full_reversal_not_zero')
    expect(runtimeSql).toContain('capped_reversal_not_zero')
    expect(runtimeSql).toContain('capped_reearn_wrong')
    expect(runtimeSql).toContain('second_recompletion_duplicated_outbox')
    expect(runtimeSql).toContain('routing_event_became_deliverable')
    expect(runtimeSql).toContain('no_show_did_not_skip_unsent_completion')
    expect(runtimeSql).toContain('recompletion_did_not_reopen_routing')
    expect(runtimeSql).toContain('sent_completion_was_duplicated')
    expect(runtimeSql).toContain('config_zero_did_not_restore_original_earn')
    expect(runtimeSql).toContain('config_zero_created_new_earn')
    expect(runtimeSql).toContain('no_show_contributed_to_lifetime')
  })

  it('låter inte passerade aktiva bokningar avbokas eller ombokas via personalservern', () => {
    const personal = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'personal', 'actions.ts'), 'utf8')
    expect(personal).toContain(".gt('end_ts', nowIso)")
    expect(personal).toContain('Bokningen behöver avslutas som Genomförd eller Uteblev.')
  })

  it('behåller exakt count-stöd i datalagret utan en påtvingad kalenderkö', () => {
    const data = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'admin', 'data.ts'), 'utf8')
    const page = fs.readFileSync(
      path.join(WEB_ROOT, 'app', '(admin)', 'admin', 'bokningar', 'page.tsx'),
      'utf8',
    )
    expect(data).toContain('export async function countBookings')
    expect(data).toContain("count: 'exact', head: true")
    expect(data).toContain('filters.limit')
    expect(data).toMatch(/\.range\(\s*filters\.offset \?\? 0,/)
    expect(page).not.toContain('countBookings(tenant.id')
    expect(page).not.toContain('unresolvedCount')
  })

  it('låter bara dokumenterad unik idempotens sväljas av lojalitetstriggern', () => {
    const body = sql.match(
      /create or replace function public\.earn_loyalty_on_completed\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/,
    )?.[1]
    expect(body).toBeTruthy()
    expect(body).toContain("on conflict (booking_id) where (reason = 'earn_completed') do nothing")
    expect(body).not.toContain('exception when others')
  })

  it('håller utfall valbart inne i bokningen utan en klocka eller kö över kalendern', () => {
    const page = fs.readFileSync(
      path.join(WEB_ROOT, 'app', '(admin)', 'admin', 'bokningar', 'page.tsx'),
      'utf8',
    )
    const drawer = fs.readFileSync(
      path.join(WEB_ROOT, 'components', 'admin', 'BookingDrawer.tsx'),
      'utf8',
    )
    expect(page).not.toContain('endToUtc: nowIso')
    expect(page).not.toContain("statuses: ['pending', 'confirmed']")
    expect(page).toContain('new Date(b.endTs).getTime() <= now')
    expect(page).not.toContain('tidigare bokningar saknar resultat')
    expect(page).not.toContain('calendarStyles.unresolvedQueue')
    expect(drawer).toContain("target: 'completed'")
    expect(drawer).toContain('Uteblev')
    expect(drawer).not.toContain('Behöver avslutas.')
  })
})
