import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const PREVIEW_REF = 'cwnhpesrgolflkmyjbrm'
const ROOT = path.resolve(__dirname, '../../..')
const read = (relativePath: string) =>
  readFileSync(path.join(ROOT, relativePath), 'utf8').replaceAll('\r\n', '\n')

test.describe('08 Goal 92 commerce — source contract @readonly @contract', () => {
  test('08-C01 media has one reserved lifecycle and durable cleanup', () => {
    const actions = read('apps/web/lib/admin/media/actions.ts')
    const lifecycle = read('apps/web/lib/media/lifecycle.ts')
    const migration = read('supabase/migrations/20260729144926_goal92_media_lifecycle.sql')

    expect(actions).toContain('uploadManagedImage(')
    expect(actions).toContain("supabase.rpc('request_media_delete'")
    for (const boundary of [
      'reserve_media_upload',
      'finalize_media_upload',
      'cancel_media_upload',
      'request_media_delete',
    ]) {
      expect(lifecycle).toContain(`'${boundary}'`)
    }
    expect(migration).toContain('claim_media_cleanup_jobs')
    expect(migration).toContain('for update skip locked')
    expect(migration).toContain('alter table public.media_assets enable row level security')
  })

  test('08-C02 offert intake, CAS and delivery use server-owned boundaries', () => {
    const intake = read('apps/web/lib/storefront/offert/intake.ts')
    const actions = read('apps/web/lib/admin/offert/actions.ts')
    const delivery = read('apps/web/lib/admin/offert/reply-delivery.ts')
    const migration = read('supabase/migrations/20260729160814_goal92_offert_fsm.sql')

    expect(intake).toContain('const ctx = await getTenantContext()')
    expect(intake).toContain("writer.from('offert_requests').insert")
    expect(actions).toContain("rpc('update_offert_request'")
    expect(actions).toContain('p_expected_version: expectedVersion')
    expect(delivery).toContain("client.rpc('offert_reply_delivery_target'")
    expect(migration).toContain('for update skip locked')
    expect(migration).toContain("reply_delivery_state = 'sent'")
  })

  test('08-C03 checkout replay and strict SEK snapshot meet one settlement path', () => {
    const actions = read('apps/web/app/butik/actions.ts')
    const checkout = read('apps/web/components/storefront/shop/useCheckout.ts')
    const settle = read('apps/web/lib/payments/settle.ts')
    const migration = read('supabase/migrations/20260729163822_goal92_shop_payment_truth.sql')

    expect(actions).toContain('p_reserve_request_id: input.reserveRequestId')
    expect(actions).toContain("admin.rpc('prepare_shop_order_payment'")
    expect(checkout).toContain('useState(() => crypto.randomUUID())')
    expect(checkout).toContain('!inFlight.current')
    for (const boundary of [
      'register_shop_payment_event',
      'settle_shop_payment_event',
      'complete_shop_payment_event',
    ]) {
      expect(settle).toContain(`'${boundary}'`)
    }
    expect(migration).toContain('on public.shop_orders (tenant_id, reserve_request_id)')
    expect(migration).toContain("v_payment.currency <> 'SEK'")
  })

  test('08-C04 Stripe and PayPal refunds enter the same durable inbox', () => {
    const stripe = read('apps/web/app/api/stripe/webhook/route.ts')
    const paypal = read('apps/web/app/api/paypal/webhook/route.ts')
    const migration = read('supabase/migrations/20260729163822_goal92_shop_payment_truth.sql')

    expect(stripe).toContain('settleShopPaymentEvent({')
    expect(paypal).toContain("event.event_type === 'PAYMENT.CAPTURE.REFUNDED'")
    expect(paypal).toContain("eventType: 'refund_succeeded'")
    expect(migration).toContain('create table if not exists private.shop_payment_events')
    expect(migration).toContain('unique (provider, account_scope, provider_event_id)')
  })

  test('08-C05 admin refunds only enqueue the shared leased outbox', () => {
    const admin = read('apps/web/lib/admin/shop/actions.ts')
    const outbox = read('apps/web/lib/payments/refund-outbox.ts')
    const migration = read('supabase/migrations/20260729163926_goal92_shop_refund_jobs.sql')

    expect(admin).toContain("refundRpc.rpc('enqueue_shop_order_refund'")
    expect(admin).toContain('dispatchPaymentRefundJobById(enqueueRow.job_id)')
    expect(admin).not.toContain('.refunds.create(')
    expect(outbox).toContain("'claim_payment_refund_jobs'")
    expect(outbox).toContain("'complete_payment_refund_job'")
    expect(migration).toContain('for update skip locked')
    expect(migration).toContain('payment_refund_jobs_one_source')
  })

  test('08-C06 probe uses real SQL, concurrency and browser surfaces', () => {
    const probe = read('e2e/acceptans/08-goal92-commerce/probe.js')

    expect(probe).toContain(`const PREVIEW_REF = '${PREVIEW_REF}'`)
    expect(probe).toContain('goal92_media_quota_concurrency.mjs')
    expect(probe).toContain('goal92_shop_reserve_concurrency.mjs')
    expect(probe).toContain('e2e-db.mjs')
    expect(probe).toContain('BLOCKED 08-X01 Stripe sandbox')
    expect(probe).toContain('BLOCKED 08-X02 PayPal sandbox')
    expect(probe).not.toContain('EvidenceUrl')
    expect(probe).not.toContain('FIXTURE_TOKEN')
  })
})

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`08 runtime requires ${name}`)
  return value
}

function runtimeOrigins() {
  const publicOrigin = required('ACCEPT_BASE_URL').replace(/\/$/, '')
  const backofficeOrigin = (
    process.env.ACCEPT_BACKOFFICE_URL ?? publicOrigin
  ).replace(/\/$/, '')
  return { publicOrigin, backofficeOrigin }
}

function tenantUrl(origin: string, route: string): string {
  const url = new URL(route, `${origin}/`)
  url.searchParams.set('tenant', process.env.GOAL92_ACCEPT_TENANT_SLUG ?? 'frisor1')
  return url.toString()
}

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

async function expectOk(page: Page, url: string) {
  const response = await page.goto(url)
  expect(response, `no response for ${url}`).not.toBeNull()
  expect(response!.status(), url).toBeLessThan(400)
}

async function loginBackoffice(page: Page, origin: string) {
  await expectOk(page, `${origin}/login`)
  await page.getByLabel('E-post').fill(
    process.env.GOAL92_ACCEPT_ADMIN_EMAIL ?? 'e2e-admin@frisor1.test',
  )
  await page.locator('input[name="password"]').fill(required('E2E_PASSWORD'))
  await page.getByRole('button', { name: 'Logga in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

test.describe('08 Goal 92 commerce — guarded preview runtime @runtime', () => {
  test('08-R01 admin media, offerter and webshop render without runtime errors', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    expect(required('GOAL92_ACCEPT_PREVIEW_REF')).toBe(PREVIEW_REF)
    const { backofficeOrigin } = runtimeOrigins()
    const errors = collectRuntimeErrors(page)

    await loginBackoffice(page, backofficeOrigin)

    await expectOk(page, `${backofficeOrigin}/admin/media`)
    await expect(page.getByRole('heading', { name: 'Bildbibliotek' })).toBeVisible()
    await page.getByRole('button', { name: 'Ladda upp', exact: true }).first().click()
    const upload = page.getByRole('dialog', { name: 'Ladda upp bilder' })
    await upload.locator('input[name="files"]').setInputFiles(path.join(ROOT, 'package.json'))
    await upload.getByRole('button', { name: 'Ladda upp', exact: true }).click()
    await expect(upload.getByRole('alert')).toBeVisible()

    await expectOk(page, `${backofficeOrigin}/admin/offerter`)
    await expect(page.getByRole('heading', { name: /Offerter|Offertförfrågningar/ })).toBeVisible()

    await expectOk(page, `${backofficeOrigin}/admin/webshop`)
    await expect(page.getByRole('heading', { name: 'Webshop' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('08-R02 public offert reaches the admin inbox and shop cart is interactive', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    expect(required('GOAL92_ACCEPT_PREVIEW_REF')).toBe(PREVIEW_REF)
    const { publicOrigin, backofficeOrigin } = runtimeOrigins()
    const errors = collectRuntimeErrors(page)
    const name = `Goal92 ${randomUUID()}`

    await expectOk(page, tenantUrl(publicOrigin, '/offert'))
    await page.getByLabel('Namn').fill(name)
    await page.getByLabel('E-post').fill('goal92@example.test')
    await page.getByLabel('Telefon').fill('0700000092')
    const subject = page.getByLabel('Vad gäller det?')
    if (await subject.isVisible().catch(() => false)) await subject.fill('Acceptans')
    const message = page.getByLabel(/Beskriv/)
    if (await message.isVisible().catch(() => false)) {
      await message.fill('Goal 92 previewacceptans')
    }
    await page.locator('form button[type="submit"]').click()
    await expect(page.getByRole('status')).toContainText('Tack!')

    await loginBackoffice(page, backofficeOrigin)
    await expectOk(page, `${backofficeOrigin}/admin/offerter`)
    await expect(page.getByText(name, { exact: true })).toBeVisible()

    await expectOk(page, tenantUrl(publicOrigin, '/shop'))
    await expect(page.getByRole('heading', { name: 'Handla hos oss' })).toBeVisible()
    await expect(page.getByText('Goal 92 testprodukt', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Lägg i kundvagn', exact: true }).click()
    await expect(page.getByRole('button', { name: /Tillagd/ })).toBeVisible()
    await page.getByRole('link', { name: /Varukorg/ }).click()
    await expect(page.getByRole('heading', { name: 'Varukorg' })).toBeVisible()
    await expect(page.getByText('Goal 92 testprodukt', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('Goal 92 testprodukt', { exact: true })).toBeVisible()

    expect(errors).toEqual([])
  })
})

test('08-X01 Stripe sandbox payment reaches a paid Corevo confirmation @stripe-sandbox', async ({
  page,
}) => {
  const { publicOrigin } = runtimeOrigins()
  await page.goto(required('GOAL92_STRIPE_SANDBOX_CHECKOUT_URL'))
  await page.getByLabel(/email/i).fill(required('GOAL92_STRIPE_SANDBOX_EMAIL'))
  await page.getByLabel(/card number/i).fill('4242424242424242')
  await page.getByLabel(/expiration|expiry/i).fill('1234')
  await page.getByLabel(/cvc/i).fill('123')
  await page.getByRole('button', { name: /pay|betala/i }).click()
  await expect(page).toHaveURL(new RegExp(`${publicOrigin}/bekraftelse/`), {
    timeout: 90_000,
  })
  await expect(page.getByText(/Betald/)).toBeVisible()
})

test('08-X02 PayPal sandbox capture returns to a paid Corevo confirmation @paypal-sandbox', async ({
  page,
}) => {
  const { publicOrigin } = runtimeOrigins()
  await page.goto(required('GOAL92_PAYPAL_SANDBOX_APPROVAL_URL'))
  await page.locator('#email').fill(required('GOAL92_PAYPAL_SANDBOX_EMAIL'))
  await page.locator('#btnNext').click()
  await page.locator('#password').fill(required('GOAL92_PAYPAL_SANDBOX_PASSWORD'))
  await page.locator('#btnLogin').click()
  await page.locator('#payment-submit-btn').click()
  await expect(page).toHaveURL(new RegExp(`${publicOrigin}/bekraftelse/`), {
    timeout: 90_000,
  })
  await expect(page.getByText(/Betald/)).toBeVisible()
})
