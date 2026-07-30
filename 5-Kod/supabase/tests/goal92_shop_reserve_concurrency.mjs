import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const expectedRef = process.argv[2]
const password = process.env.E2E_PASSWORD
if (!expectedRef || !password) {
  throw new Error(
    'Usage: E2E_PASSWORD=... node supabase/tests/goal92_shop_reserve_concurrency.mjs <expected-project-ref>',
  )
}

const linkedRef = readFileSync(
  resolve(import.meta.dirname, '../.temp/project-ref'),
  'utf8',
).trim()
if (linkedRef !== expectedRef) {
  throw new Error(`Ref mismatch: expected ${expectedRef}, linked ${linkedRef}`)
}

const env = Object.fromEntries(
  readFileSync(resolve(import.meta.dirname, '../../apps/web/.env.local'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
)
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
if (
  !supabaseUrl ||
  !anonKey ||
  !serviceRoleKey ||
  new URL(supabaseUrl).hostname !== `${expectedRef}.supabase.co`
) {
  throw new Error('Preview REST credentials missing or mismatched')
}

const admin = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const tenantId = 'e2e00000-0000-0000-0000-000000000001'
const productId = 'e2e92300-0000-0000-0000-000000000001'
const variantId = 'e2e92300-0000-0000-0000-000000000002'
const requestId = 'e2e92300-0000-4000-8000-000000000003'
const items = [{ kind: 'product', variant_id: variantId, quantity: 2 }]

async function db(run, label) {
  const result = await run()
  if (result.error) throw new Error(`${label}: ${result.error.code} ${result.error.message}`)
  return result.data
}

async function reserve(token) {
  const startedAt = Date.now()
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_shop_order`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        p_tenant_slug: 'frisor1',
        p_items: items,
        p_fulfilment: 'ship',
        p_token: token,
        p_ttl_min: 30,
        p_reserve_request_id: requestId,
      }),
    })
    const body = await response.text()
    if (
      response.status !== 401 ||
      !body.includes('PGRST303') ||
      !body.includes('JWT issued at future') ||
      attempt === 3
    ) {
      return {
        ok: response.ok,
        status: response.status,
        body,
        attempts: attempt,
        elapsedMs: Date.now() - startedAt,
      }
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250))
  }
}

async function cleanup() {
  await db(
    () =>
      admin
        .from('shop_orders')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('reserve_request_id', requestId),
    'cleanup order',
  )
  await db(() => admin.from('shop_products').delete().eq('id', productId), 'cleanup product')
}

const signedIn = await admin.auth.signInWithPassword({
  email: 'e2e-admin@frisor1.test',
  password,
})
if (signedIn.error) {
  throw new Error(`E2E shop login: ${signedIn.error.code} ${signedIn.error.message}`)
}

await cleanup()
try {
  await db(
    () =>
      admin.from('shop_products').insert({
        id: productId,
        tenant_id: tenantId,
        name: 'Goal 92 concurrency product',
        price_cents: 5000,
        currency: 'SEK',
        stock: 10,
        active: true,
      }),
    'insert product',
  )
  await db(
    () =>
      admin.from('shop_product_variants').insert({
        id: variantId,
        tenant_id: tenantId,
        product_id: productId,
        name: 'Standard',
        price_cents: 5000,
        currency: 'SEK',
        stock: 10,
        reserved_qty: 0,
        active: true,
      }),
    'insert variant',
  )

  const results = await Promise.all(
    Array.from({ length: 4 }, () => reserve('goal92-concurrency-token')),
  )
  if (results.some((result) => !result.ok)) {
    throw new Error(`Unexpected session results: ${JSON.stringify(results)}`)
  }
  if (results.filter((result) => result.attempts === 1).length < 2) {
    throw new Error(`Too few concurrent first-attempt successes: ${JSON.stringify(results)}`)
  }
  const orderIds = results.map((result) => JSON.parse(result.body))
  if (new Set(orderIds).size !== 1) {
    throw new Error(`Concurrent requests returned different orders: ${JSON.stringify(orderIds)}`)
  }

  const [orders, variants, itemsRead] = await Promise.all([
    db(
      () =>
        admin
          .from('shop_orders')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('reserve_request_id', requestId),
      'read orders',
    ),
    db(
      () => admin.from('shop_product_variants').select('reserved_qty').eq('id', variantId),
      'read variant',
    ),
    db(
      () =>
        admin
          .from('shop_order_items')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('order_id', orderIds[0]),
      'read order items',
    ),
  ])
  if (orders.length !== 1 || variants[0]?.reserved_qty !== 2 || itemsRead.length !== 1) {
    throw new Error('goal92_shop_real_concurrency_invalid')
  }

  const mismatch = await reserve('different-token')
  if (mismatch.ok || !mismatch.body.includes('reserve_request_mismatch')) {
    throw new Error(`Mismatch was not rejected: ${JSON.stringify(mismatch)}`)
  }

  process.stdout.write(
    `goal92_shop_real_concurrency_ok (${results.map((row) => `${row.elapsedMs}ms`).join(', ')})\n`,
  )
} finally {
  await cleanup()
}
