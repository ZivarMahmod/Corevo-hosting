#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { once } from 'node:events'
import { existsSync, readFileSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PREVIEW_REF = 'cwnhpesrgolflkmyjbrm'
const PROD_REF = 'clylvowtowbtotrahuad'
const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const NEXT_BIN = createRequire(import.meta.url).resolve('next/dist/bin/next')
const WEBSITE_FIXTURE = {
  slug: 'goal84-webb-acceptans',
  name: 'Goal 84 webbacceptans',
  ownerName: 'Goal 84 webbägare',
  ownerEmail: 'goal84-webb-owner@corevo.se',
  bookingState: 'off',
}
const BOOKING_FIXTURE = {
  slug: 'goal84-acceptans',
  name: 'Goal 84 acceptans',
  ownerName: 'Goal 84 ägare',
  ownerEmail: 'goal84-owner@corevo.se',
  bookingState: 'live',
}
const SERVICE_NAME = 'Goal 84 behandling'
const STAFF_TITLE = 'Goal 84 personal'
const GUEST_EMAIL = 'goal84-booker@example.com'

function readConfig(env) {
  const ref = String(env.GOAL84_PREVIEW_REF ?? '').trim()
  const rawUrl = String(env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  if (ref === PROD_REF || rawUrl.includes(PROD_REF)) {
    throw new Error('Goal 84 vägrar production Supabase.')
  }
  if (ref !== PREVIEW_REF) {
    throw new Error(`GOAL84_PREVIEW_REF måste vara ${PREVIEW_REF}.`)
  }

  let supabaseUrl
  try {
    supabaseUrl = new URL(rawUrl)
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL är ogiltig.')
  }
  if (supabaseUrl.protocol !== 'https:' || supabaseUrl.hostname !== `${PREVIEW_REF}.supabase.co`) {
    throw new Error('Supabase-URL:en matchar inte Goal 84-previewref.')
  }

  const anonKey = String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  const pinPepper = String(env.BOOKING_PIN_PEPPER ?? '')
  const platformEmail = String(env.GOAL84_SUPERADMIN_EMAIL ?? '').trim().toLowerCase()
  const platformPassword = String(env.GOAL84_SUPERADMIN_PASSWORD ?? '')
  if (anonKey.length < 20) throw new Error('Preview anon key saknas.')
  if (serviceKey.length < 32) throw new Error('Preview service role key saknas.')
  if (pinPepper.length < 32) throw new Error('BOOKING_PIN_PEPPER måste vara minst 32 tecken.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(platformEmail)) throw new Error('GOAL84_SUPERADMIN_EMAIL saknas.')
  if (platformPassword.length === 0) throw new Error('GOAL84_SUPERADMIN_PASSWORD saknas.')

  return {
    ref,
    supabaseUrl: supabaseUrl.origin,
    anonKey,
    serviceKey,
    pinPepper,
    platformEmail,
    platformPassword,
  }
}

function extractPin(subject, html) {
  if (!/^Din kod för bokningen hos .+$/i.test(subject.trim())) return null
  return html.match(
    /<p style="font-size:28px;font-weight:700;letter-spacing:6px">(\d{4})<\/p>/i,
  )?.[1] ?? null
}

function sameSecret(presented, expected) {
  if (typeof presented !== 'string') return false
  const left = Buffer.from(presented)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

function shouldProveLiveBlockers(mode, tenantStatus, readiness) {
  if (mode === 'lock') {
    assert.equal(tenantStatus, 'provisioning', 'Färsk bokningskund ska börja under konfiguration.')
    assert.equal(readiness?.ready, false, 'Ofullständig bokningskund får inte vara redo.')
    return true
  }
  return tenantStatus === 'provisioning' && readiness?.ready === false
}

function acceptanceMode(argv) {
  const unknown = argv.filter((argument) => !['--lock', '--smoke'].includes(argument))
  assert.equal(unknown.length, 0, `Okänt argument: ${unknown.join(', ')}`)
  assert(
    !(argv.includes('--lock') && argv.includes('--smoke')),
    '--lock och --smoke kan inte kombineras.',
  )
  return argv.includes('--smoke') ? 'smoke' : 'lock'
}

function cliMode(argv) {
  if (!argv.includes('--self-test')) return acceptanceMode(argv)
  assert.equal(argv.length, 1, '--self-test måste användas ensamt.')
  return 'self-test'
}

function assertFixtureAvailability(mode, fixtures) {
  if (mode === 'smoke') return
  const existing = fixtures.filter(Boolean).map((fixture) => fixture.slug)
  assert.equal(
    existing.length,
    0,
    `Lock kräver nya canonical fixtures; finns redan: ${existing.join(', ')}`,
  )
}

function acceptanceSuccess(mode) {
  return mode === 'smoke'
    ? 'goal84: SMOKE/reuse OK — inte ett slutligt lockbevis'
    : 'goal84: preview-browseracceptans LOCK OK'
}

async function startRelay() {
  const secret = randomBytes(32).toString('base64url')
  const captures = new Map()
  const waiters = new Map()
  const sockets = new Set()
  const server = http.createServer((req, res) => {
    req.on('error', () => res.destroy())
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    if (req.method !== 'POST') {
      req.resume()
      json(404, { ok: false })
      return
    }
    if (!sameSecret(req.headers['x-relay-secret'], secret)) {
      req.resume()
      json(401, { ok: false })
      return
    }
    if (!String(req.headers['content-type'] ?? '').toLowerCase().includes('application/json')) {
      req.resume()
      json(415, { ok: false })
      return
    }

    const chunks = []
    let bytes = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes <= 64 * 1024) chunks.push(chunk)
      else tooLarge = true
    })
    req.on('end', () => {
      if (tooLarge) {
        json(413, { ok: false })
        return
      }
      let body
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        json(400, { ok: false })
        return
      }
      const to = typeof body?.to === 'string' ? body.to.trim().toLowerCase() : ''
      const subject = typeof body?.subject === 'string' ? body.subject : ''
      const html = typeof body?.html === 'string' ? body.html : ''
      if (
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)
        || subject.length < 1
        || subject.length > 500
        || html.length < 1
        || html.length > 64 * 1024
      ) {
        json(422, { ok: false })
        return
      }

      const pin = extractPin(subject, html)
      if (pin) {
        const waiter = waiters.get(to)
        if (waiter) {
          waiters.delete(to)
          clearTimeout(waiter.timer)
          waiter.resolve(pin)
        } else {
          captures.set(to, pin)
        }
      }
      json(200, { ok: true, id: randomUUID() })
    })
  })
  server.requestTimeout = 10_000
  server.headersTimeout = 5_000
  server.keepAliveTimeout = 1_000
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address === 'object' && address.address === '127.0.0.1')

  return {
    url: `http://127.0.0.1:${address.port}`,
    secret,
    captureCount: () => captures.size,
    clearPins: () => captures.clear(),
    waitForPin(to, timeoutMs = 20_000) {
      const key = to.trim().toLowerCase()
      const captured = captures.get(key)
      if (captured) {
        captures.delete(key)
        return Promise.resolve(captured)
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(key)
          reject(new Error('PIN nådde inte den lokala relay:n i tid.'))
        }, timeoutMs)
        waiters.set(key, { resolve, reject, timer })
      })
    },
    async close() {
      for (const waiter of waiters.values()) {
        clearTimeout(waiter.timer)
        waiter.reject?.(new Error('Relay stängdes.'))
      }
      waiters.clear()
      captures.clear()
      if (server.listening) {
        const closed = once(server, 'close')
        server.close()
        server.closeIdleConnections?.()
        const forceClose = setTimeout(() => {
          server.closeAllConnections?.()
          for (const socket of sockets) socket.destroy()
        }, 1_000)
        await Promise.race([
          closed,
          new Promise((resolve) => setTimeout(resolve, 2_000)),
        ])
        clearTimeout(forceClose)
        for (const socket of sockets) socket.destroy()
      }
    },
  }
}

async function runSelfTest() {
  const source = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.equal(typeof cliMode, 'function')
  assert.equal(cliMode(['--self-test']), 'self-test')
  assert.throws(
    () => cliMode(['--self-test', '--unknown']),
    /måste användas ensamt/,
  )
  assert.throws(
    () => cliMode(['--self-test', '--lock', '--smoke']),
    /måste användas ensamt/,
  )
  assert.equal(typeof acceptanceMode, 'function')
  assert.equal(acceptanceMode([]), 'lock')
  assert.equal(acceptanceMode(['--lock']), 'lock')
  assert.equal(acceptanceMode(['--smoke']), 'smoke')
  assert.throws(() => acceptanceMode(['--unknown']), /Okänt argument/)
  assert.throws(
    () => acceptanceMode(['--lock', '--smoke']),
    /kan inte kombineras/,
  )

  assert.equal(typeof assertFixtureAvailability, 'function')
  const existingWebsite = { slug: WEBSITE_FIXTURE.slug }
  const existingBooking = { slug: BOOKING_FIXTURE.slug }
  assert.doesNotThrow(() => assertFixtureAvailability('lock', [null, null]))
  assert.throws(
    () => assertFixtureAvailability('lock', [existingWebsite, null]),
    /goal84-webb-acceptans/,
  )
  assert.throws(
    () => assertFixtureAvailability('lock', [null, existingBooking]),
    /goal84-acceptans/,
  )
  assert.throws(
    () => assertFixtureAvailability('lock', [existingWebsite, existingBooking]),
    /goal84-webb-acceptans.*goal84-acceptans/,
  )
  assert.doesNotThrow(
    () => assertFixtureAvailability('smoke', [existingWebsite, existingBooking]),
  )

  assert.equal(typeof acceptanceSuccess, 'function')
  assert.equal(acceptanceSuccess('lock'), 'goal84: preview-browseracceptans LOCK OK')
  assert.equal(
    acceptanceSuccess('smoke'),
    'goal84: SMOKE/reuse OK — inte ett slutligt lockbevis',
  )
  assert.notEqual(acceptanceSuccess('smoke'), acceptanceSuccess('lock'))

  assert(!source.includes('bootstrap' + 'Platform('), 'Goal 84 får inte skapa en tillfällig plattformsoperatör.')
  assert(!source.includes('ensureFixture' + 'Owner('), 'Ägaren måste komma från Studio-vägen.')
  assert(!source.includes('?? tenantRead.data?.find((row) => ' + "row.slug === 'demo')"), 'FreshCut får inte falla tillbaka till Demo.')
  assert.match(source, /GOAL84_SUPERADMIN_EMAIL/)
  assert.match(source, /GOAL84_SUPERADMIN_PASSWORD/)
  assert.match(source, /createServiceViaUi/)
  assert.match(source, /createStaffAndBookingSetupViaUi/)
  assert.doesNotMatch(source, /from\('(services|staff|staff_services|working_hours|users|roles)'\)[\s\S]{0,500}\.(?:insert|upsert|update|delete)\(/)
  assert.equal(shouldProveLiveBlockers('lock', 'provisioning', { ready: false }), true)
  assert.throws(() => shouldProveLiveBlockers('lock', 'provisioning', { ready: true }))
  assert.throws(() => shouldProveLiveBlockers('lock', 'active', { ready: false }))
  assert.equal(shouldProveLiveBlockers('smoke', 'provisioning', { ready: false }), true)
  assert.equal(shouldProveLiveBlockers('smoke', 'provisioning', { ready: true }), false)
  assert.equal(shouldProveLiveBlockers('smoke', 'active', { ready: false }), false)

  const sampleBookingId = '11111111-2222-3333-4444-555555555555'
  let capturedBookingId
  assert.equal(
    captureBookingId(
      `http://127.0.0.1:3000/boka/bekraftelse/${sampleBookingId}`,
      (value) => { capturedBookingId = value },
    ),
    sampleBookingId,
  )
  assert.equal(capturedBookingId, sampleBookingId)
  assert.throws(() => captureBookingId('http://127.0.0.1:3000/boka', () => {}), /boknings-id/)

  const cancelledIds = []
  assert.equal(await cancelOutstandingBooking(undefined, false, async (id) => cancelledIds.push(id)), false)
  assert.equal(await cancelOutstandingBooking(sampleBookingId, true, async (id) => cancelledIds.push(id)), true)
  assert.equal(await cancelOutstandingBooking(sampleBookingId, false, async (id) => cancelledIds.push(id)), true)
  assert.deepEqual(cancelledIds, [sampleBookingId])

  assert.doesNotThrow(() => assertTouchTargetSize({ width: 44, height: 44 }, 'testkontroll'))
  assert.throws(
    () => assertTouchTargetSize({ width: 44, height: 43 }, 'testkontroll'),
    /mindre än 44×44/,
  )
  const sectionSelector = 'section[aria-labelledby=' + '"location-hours-title"]'
  const interactiveSelector = 'button, input:not(' + '[type="hidden"]), select'
  assert(source.includes(sectionSelector))
  assert(source.includes(interactiveSelector))
  const cleanupStart = source.lastIndexOf('const cleanups ' + '= [')
  assert(cleanupStart >= 0, 'Cleanup-listan saknas.')
  const cleanupSource = source.slice(cleanupStart)
  const bookingCleanupIndex = cleanupSource.indexOf("['test" + "bokning'")
  const browserCleanupIndex = cleanupSource.indexOf("['brow" + "ser'")
  assert(
    bookingCleanupIndex >= 0 && bookingCleanupIndex < browserCleanupIndex,
    'Testbokningen måste städas via UI före browsern stängs.',
  )
  const failureThrowIndex = cleanupSource.indexOf('if (failed) throw failure')
  const successLogIndex = cleanupSource.indexOf('console.log(acceptanceSuccess(mode))')
  assert(
    failureThrowIndex >= 0 && successLogIndex > failureThrowIndex,
    'Slutlig framgång får loggas först efter städning och felkontroll.',
  )

  const valid = {
    GOAL84_PREVIEW_REF: PREVIEW_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${PREVIEW_REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-that-is-long-enough',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key-that-is-long-enough-for-test',
    BOOKING_PIN_PEPPER: 'pepper-that-is-at-least-thirty-two-chars',
    GOAL84_SUPERADMIN_EMAIL: 'seeded-superadmin@example.com',
    GOAL84_SUPERADMIN_PASSWORD: 'seeded-password-that-is-long-enough',
  }
  const canonicalSeed = readFileSync(
    path.resolve(WEB_DIR, '../../supabase/seed.sql'),
    'utf8',
  )
  const canonicalCredential = canonicalSeed.match(
    /'platform@corevo\.se',\s*crypt\('([^']+)'/,
  )
  assert(canonicalCredential, 'Canonical preview-superadmin saknas i seed.sql.')
  assert.doesNotThrow(
    () => readConfig({
      ...valid,
      GOAL84_SUPERADMIN_EMAIL: 'platform@corevo.se',
      GOAL84_SUPERADMIN_PASSWORD: canonicalCredential[1],
    }),
    'Den seedade preview-superadminens befintliga credential måste accepteras.',
  )
  assert.throws(
    () => readConfig({ ...valid, GOAL84_SUPERADMIN_PASSWORD: '' }),
    /GOAL84_SUPERADMIN_PASSWORD saknas/,
  )
  assert.throws(
    () => readConfig({ ...valid, NEXT_PUBLIC_SUPABASE_URL: `https://${PROD_REF}.supabase.co` }),
    /production/,
  )
  assert.throws(() => readConfig({ ...valid, GOAL84_PREVIEW_REF: 'annan-preview' }), /måste vara/)
  assert.equal(readConfig(valid).ref, PREVIEW_REF)
  assert.equal(existsSync(NEXT_BIN), true, 'Next.js-binären måste kunna lösas från workspacen.')
  const pinSubject = 'Din kod för bokningen hos Goal 84'
  const pinMarkup = '<p style="font-size:28px;font-weight:700;letter-spacing:6px">1234</p>'
  assert.equal(extractPin(pinSubject, pinMarkup), '1234')
  assert.equal(extractPin('Bokningsbekräftelse', pinMarkup), null)
  assert.equal(extractPin(pinSubject, '<p>1234</p>'), null)
  assert.equal(extractPin(pinSubject, pinMarkup.replace('1234', '123456')), null)

  const relay = await startRelay()
  try {
    const unauthorized = await fetch(relay.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    assert.equal(unauthorized.status, 401)
    assert.equal((await fetch(relay.url)).status, 404)

    const sixDigits = await fetch(relay.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-relay-secret': relay.secret,
      },
      body: JSON.stringify({
        to: 'goal84@example.com',
        subject: pinSubject,
        html: pinMarkup.replace('1234', '123456'),
      }),
    })
    assert.equal(sixDigits.status, 200)
    assert.equal(relay.captureCount(), 0)

    const response = await fetch(relay.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-relay-secret': relay.secret,
      },
      body: JSON.stringify({
        to: 'goal84@example.com',
        subject: pinSubject,
        html: pinMarkup,
      }),
    })
    assert.equal(response.status, 200)
    assert.equal((await response.text()).includes('1234'), false)
    assert.equal(await relay.waitForPin('goal84@example.com'), '1234')
    assert.equal(relay.captureCount(), 0)
    relay.clearPins()
    assert.equal(relay.captureCount(), 0)
  } finally {
    await relay.close()
  }

  const closingRelay = await startRelay()
  const pendingPin = closingRelay.waitForPin('closing@example.com', 50)
  await closingRelay.close()
  await assert.rejects(pendingPin, /Relay stängdes/)
  console.log('goal84: self-test OK')
}

async function freePort() {
  const server = http.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address === 'object')
  server.close()
  await once(server, 'close')
  return address.port
}

function localOrigins(port) {
  return {
    storefront: `http://127.0.0.1:${port}`,
    platform: `http://booking.localhost:${port}`,
  }
}

async function waitFor(check, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const result = await check()
      if (result) return result
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  const detail = lastError
    ? `: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    : ''
  throw new Error(`${label} nåddes inte i tid${detail}.`)
}

async function stopChildProcess(child) {
  if (child.exitCode !== null) return
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    await Promise.race([
      once(killer, 'exit').catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ])
  } else {
    child.kill('SIGTERM')
  }
  if (child.exitCode === null) {
    await Promise.race([
      once(child, 'exit').catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ])
  }
  if (child.exitCode === null) child.kill('SIGKILL')
}

async function startNext(config, relay) {
  const port = await freePort()
  const origins = localOrigins(port)
  const child = spawn(
    process.execPath,
    [NEXT_BIN, 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: WEB_DIR,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: config.anonKey,
        SUPABASE_SERVICE_ROLE_KEY: config.serviceKey,
        BOOKING_PIN_PEPPER: config.pinPepper,
        EMAIL_RELAY_URL: relay.url,
        EMAIL_RELAY_SECRET: relay.secret,
        ONBOARDING_STUDIO_ENABLED: 'true',
        NEXT_PUBLIC_ROOT_DOMAIN: `localhost:${port}`,
        GIADA_SMS_BASE_URL: '',
        GIADA_SMS_API_KEY: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  child.stdout.resume()
  child.stderr.resume()

  try {
    await waitFor(async () => {
      if (child.exitCode !== null) throw new Error('Next-processen avslutades.')
      const response = await fetch(`${origins.storefront}/login`, { redirect: 'manual' }).catch(() => null)
      return response && response.status < 500
    }, 'Goal 84-localhost', 120_000)
  } catch (error) {
    await stopChildProcess(child)
    throw error
  }

  return {
    ...origins,
    async stop() {
      await stopChildProcess(child)
    },
  }
}

function supabaseError(error, label) {
  if (error) throw new Error(`${label}: ${error.code ?? 'db_error'} ${error.message ?? ''}`.trim())
}

async function loginSeededPlatform(createClient, config) {
  const platform = createClient(config.supabaseUrl, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const signedIn = await platform.auth.signInWithPassword({
    email: config.platformEmail,
    password: config.platformPassword,
  })
  supabaseError(signedIn.error, 'Logga in seedad preview-superadmin')
  assert.equal(
    signedIn.data.user?.app_metadata?.platform_admin,
    true,
    'Preview-token saknar platform_admin.',
  )
  return { platform, email: config.platformEmail, password: config.platformPassword }
}

async function loginPlatform(page, base, identity) {
  await page.goto(`${base}/login`)
  await page.getByLabel('E-post').fill(identity.email)
  await page.locator('input[name="password"]').fill(identity.password)
  await Promise.all([
    page.waitForURL((url) => url.pathname !== '/login', { timeout: 30_000 }),
    page.getByRole('button', { name: 'Logga in' }).click(),
  ])
}

async function tenantBySlug(client, slug) {
  const result = await client
    .from('tenants')
    .select('id, slug, name, status')
    .eq('slug', slug)
    .maybeSingle()
  supabaseError(result.error, `Läs tenant ${slug}`)
  return result.data
}

async function bookingModuleState(client, tenantId) {
  const result = await client
    .from('tenant_modules')
    .select('state')
    .eq('tenant_id', tenantId)
    .eq('module_key', 'booking')
    .maybeSingle()
  supabaseError(result.error, 'Läs booking-modul')
  return result.data?.state ?? null
}

async function createFixtureViaStudio(page, platformBase, fixture) {
  await page.goto(`${platformBase}/kunder/ny`)
  await page.getByRole('heading', { name: 'Vilken bransch?', exact: true }).waitFor()
  const branches = page.getByRole('radio')
  assert((await branches.count()) > 0, 'Onboarding Studio saknar branschval.')
  await branches.first().click()
  await page.getByRole('button', { name: 'Nästa', exact: true }).click()
  await page.getByPlaceholder('t.ex. Klippoteket').fill(fixture.name)
  await page.getByPlaceholder('klippoteket', { exact: true }).fill(fixture.slug)
  await page.getByRole('button', { name: 'Nästa', exact: true }).click()
  await page.getByRole('button', { name: 'Nästa', exact: true }).click()

  const bookingRow = page
    .getByText('Kärnmodul', { exact: true })
    .locator("xpath=ancestor::div[.//button[@role='radio']][1]")
  await bookingRow
    .getByRole('radio', { name: fixture.bookingState === 'off' ? 'Av' : 'Live', exact: true })
    .click()
  await page.getByRole('button', { name: 'Nästa', exact: true }).click()
  await page.getByRole('heading', { name: 'Ägare & inbjudan', exact: true }).waitFor()
  await page.getByLabel('Ägarens namn', { exact: true }).fill(fixture.ownerName)
  await page.getByLabel('Ägarens e-post', { exact: true }).fill(fixture.ownerEmail)
  await page.getByRole('button', { name: 'Nästa', exact: true }).click()
  await page.getByRole('button', { name: `Skapa ${fixture.name}`, exact: true }).click()
  const created = page.getByText(`${fixture.name} är skapad`, { exact: true })
  const alert = page.getByRole('alert').filter({ hasText: /\S/ }).first()
  await Promise.race([
    created.waitFor({ timeout: 45_000 }),
    alert.waitFor({ timeout: 45_000 }).then(async () => {
      throw new Error(`Studio-error: ${await alert.textContent()}`)
    }),
  ])
  const href = await page
    .getByRole('link', { name: /Öppna & hantera kunden/ })
    .getAttribute('href')
  const id = href?.match(/^\/kunder\/([0-9a-f-]+)$/i)?.[1]
  assert(id, 'Studio-resultatet saknar tenant-id.')
  return id
}

async function ensureFixture(client, page, platformBase, fixture, mode) {
  let tenant = await tenantBySlug(client, fixture.slug)
  assertFixtureAvailability(mode, [tenant])
  if (!tenant) {
    const id = await createFixtureViaStudio(page, platformBase, fixture)
    tenant = await tenantBySlug(client, fixture.slug)
    assert.equal(tenant?.id, id)
  }
  assert(tenant, `Fixture ${fixture.slug} kunde inte skapas.`)
  assert.equal(await bookingModuleState(client, tenant.id), fixture.bookingState)
  const owner = await client
    .from('users')
    .select('id, status')
    .eq('tenant_id', tenant.id)
    .eq('email', fixture.ownerEmail)
    .maybeSingle()
  supabaseError(owner.error, `Läs Studio-ägare för ${fixture.slug}`)
  assert.equal(owner.data?.status, 'active', `${fixture.slug} saknar Studio-skapad ägare.`)
  return tenant
}

async function launchReadiness(client, tenantId) {
  const result = await client.rpc('tenant_launch_readiness', { p_tenant: tenantId })
  supabaseError(result.error, 'Läs publiceringskontroll')
  return result.data
}

async function openDrift(page, platformBase, tenantId) {
  await page.goto(`${platformBase}/kunder/${tenantId}`)
  await page.getByRole('tab', { name: 'Drift', exact: true }).click()
  await page.getByRole('heading', { name: 'Status & riskzon', exact: true }).waitFor()
}

async function publishViaUi(client, page, platformBase, tenant) {
  const current = await tenantBySlug(client, tenant.slug)
  assert(current, `${tenant.slug} saknas före publicering.`)
  if (current.status === 'active') return
  assert.equal(current.status, 'provisioning', `${tenant.slug} har oväntad status.`)
  await openDrift(page, platformBase, tenant.id)
  const button = page.getByRole('button', { name: 'Publicera kund', exact: true })
  assert.equal(await button.isDisabled(), false, `${tenant.slug} är inte redo att publiceras.`)
  await button.click()
  await page.getByText('Kunden är aktiv — publika sajten är öppen.', { exact: true }).waitFor()
  await waitFor(
    async () => (await tenantBySlug(client, tenant.slug)).status === 'active',
    `Publicering av ${tenant.slug}`,
  )
}

async function proveLiveBlockers(client, page, platformBase, tenant) {
  const readiness = await launchReadiness(client, tenant.id)
  assert.equal(readiness.ready, false)
  assert.equal(readiness.booking_required, true)
  assert(readiness.missing.includes('working_hours'))

  await openDrift(page, platformBase, tenant.id)
  const button = page.getByRole('button', { name: 'Publicera kund', exact: true })
  assert.equal(await button.isDisabled(), true, 'UI:t tillät publicering utan bokningsgrund.')

  const bypass = await client
    .from('tenants')
    .update({ status: 'active' })
    .eq('id', tenant.id)
    .select('id')
  assert(bypass.error, 'Direkt status=active gick runt DB-spärren.')
  assert.equal((await tenantBySlug(client, tenant.slug)).status, 'provisioning')
}

async function createServiceViaUi(page, platformBase, tenantId) {
  await page.goto(`${platformBase}/kunder/${tenantId}`)
  await page.getByRole('tab', { name: 'Tjänster', exact: true }).click()
  const service = page.getByText(SERVICE_NAME, { exact: true })
  if ((await service.count()) === 0) {
    const form = page.locator('form').filter({ has: page.locator('input[name="name"][placeholder="t.ex. Behandling"]') })
    await form.locator('input[name="name"]').fill(SERVICE_NAME)
    await form.locator('input[name="price"]').fill('1200')
    await form.locator('input[name="duration_min"]').fill('60')
    await form.getByRole('button', { name: 'Lägg till tjänst', exact: true }).click()
    await page.getByRole('status').filter({ hasText: `Tjänst "${SERVICE_NAME}" tillagd.` }).waitFor()
  }
  await service.first().waitFor()
  await service.first().click()
  const serviceRow = page.locator('details').filter({ hasText: SERVICE_NAME })
  await serviceRow.locator('input[name="price"]').fill('1200')
  await serviceRow.locator('input[name="duration_min"]').fill('60')
  await serviceRow.getByRole('checkbox', { name: 'Aktiv (syns i bokning + på sidan)', exact: true }).check()
  await serviceRow.getByRole('button', { name: 'Spara', exact: true }).click()
  await serviceRow.getByRole('status').filter({ hasText: `Tjänst "${SERVICE_NAME}" sparad.` }).waitFor()
}

async function createStaffAndBookingSetupViaUi(page, platformBase, tenantId) {
  await page.goto(`${platformBase}/kunder/${tenantId}`)
  await page.getByRole('tab', { name: 'Personal', exact: true }).click()
  const staffRow = page.locator('details').filter({ hasText: STAFF_TITLE })
  if ((await staffRow.count()) === 0) {
    const addForm = page.locator('form').filter({
      has: page.getByRole('button', { name: 'Lägg till (utan inlogg)', exact: true }),
    })
    await addForm.locator('input[name="title"]').fill(STAFF_TITLE)
    await addForm.getByRole('button', { name: 'Lägg till (utan inlogg)', exact: true }).click()
    await page.getByRole('status').filter({ hasText: `Medarbetare "${STAFF_TITLE}" tillagd hos kunden.` }).waitFor()
  }
  await staffRow.first().waitFor()
  await staffRow.first().click()
  await staffRow.getByRole('checkbox', { name: SERVICE_NAME, exact: true }).check()
  await staffRow.getByRole('button', { name: 'Spara tjänster', exact: true }).click()
  await staffRow.getByRole('status').filter({ hasText: 'tjänst(er) kopplade' }).waitFor()
  await staffRow.getByRole('checkbox', { name: 'Måndag', exact: true }).check()
  await staffRow.getByLabel('Måndag starttid', { exact: true }).fill('09:00')
  await staffRow.getByLabel('Måndag sluttid', { exact: true }).fill('17:00')
  await staffRow.getByRole('button', { name: 'Spara schema', exact: true }).click()
  await staffRow.getByRole('status').filter({ hasText: 'Schema sparat (1 dag).' }).waitFor()
  await staffRow.getByRole('checkbox', { name: 'Aktiv (syns i bokningen)', exact: true }).check()
  await staffRow.getByRole('button', { name: 'Spara', exact: true }).click()
  await staffRow.getByRole('status').filter({ hasText: `Medarbetare "${STAFF_TITLE}" sparad.` }).waitFor()
}

async function verifyFoundation(client, tenantId) {
  const location = await client
    .from('locations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_primary', true)
    .eq('active', true)
    .single()
  supabaseError(location.error, 'Efterbevis primärplats')
  const service = await client
    .from('services')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', SERVICE_NAME)
    .single()
  supabaseError(service.error, 'Efterbevis tjänst')
  const staff = await client
    .from('staff')
    .select('id, location_id, active')
    .eq('tenant_id', tenantId)
    .eq('title', STAFF_TITLE)
    .single()
  supabaseError(staff.error, 'Efterbevis personal')
  assert.equal(staff.data.location_id, location.data.id, 'Personalen ligger på fel plats.')
  assert.equal(staff.data.active, true, 'Personalen blev inte aktiverad via UI.')
  const [link, hours] = await Promise.all([
    client.from('staff_services').select('staff_id').eq('tenant_id', tenantId).eq('staff_id', staff.data.id).eq('service_id', service.data.id).maybeSingle(),
    client.from('working_hours').select('id').eq('tenant_id', tenantId).eq('staff_id', staff.data.id).eq('location_id', location.data.id).eq('weekday', 1).maybeSingle(),
  ])
  supabaseError(link.error, 'Efterbevis tjänstekoppling')
  supabaseError(hours.error, 'Efterbevis schema')
  assert(link.data, 'UI:t skapade inte tjänstekopplingen.')
  assert(hours.data, 'UI:t skapade inte måndagsschemat.')
  return { locationId: location.data.id, serviceId: service.data.id, staffId: staff.data.id }
}

async function confirmOpeningHours(client, page, platformBase, tenantId) {
  await page.goto(`${platformBase}/kunder/${tenantId}`)
  await page.getByRole('tab', { name: 'Personal', exact: true }).click()
  await page.getByRole('heading', { name: 'Platsens öppettider', exact: true }).waitFor()

  let opens = page.getByLabel('Måndag, pass 1, öppnar', { exact: true })
  if ((await opens.count()) === 0) {
    await page.getByRole('button', { name: 'Lägg till öppet pass på Måndag', exact: true }).click()
    opens = page.getByLabel('Måndag, pass 1, öppnar', { exact: true })
  }
  await opens.fill('09:00')
  await page.getByLabel('Måndag, pass 1, stänger', { exact: true }).fill('17:00')
  await page.getByLabel('Minsta framförhållning (minuter)', { exact: true }).fill('1500')
  await page.getByRole('button', { name: 'Spara och bekräfta', exact: true }).click()
  const status = page.locator('p[role="status"]').filter({ hasText: /\S/ }).first()
  await status.waitFor()
  assert.equal(
    (await status.textContent())?.trim(),
    'Öppettider och bokningsregler sparade.',
    'Öppettidskortet sparade inte',
  )

  const location = await client
    .from('locations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_primary', true)
    .eq('active', true)
    .single()
  supabaseError(location.error, 'Efterbevis primärplats')
  await waitFor(async () => {
    const result = await client
      .from('location_opening_hours')
      .select('id, source, confirmed_at')
      .eq('tenant_id', tenantId)
      .eq('location_id', location.data.id)
      .eq('weekday', 1)
      .eq('source', 'confirmed')
      .not('confirmed_at', 'is', null)
      .limit(1)
    supabaseError(result.error, 'Verifiera bekräftad öppettid')
    return result.data?.[0] ?? null
  }, 'Bekräftad platsöppettid')

  const rules = await client
    .from('locations')
    .select('min_notice_min')
    .eq('tenant_id', tenantId)
    .eq('id', location.data.id)
    .single()
  supabaseError(rules.error, 'Verifiera platsens framförhållning')
  assert.equal(rules.data.min_notice_min, 1500)
  return location.data.id
}

async function acceptCookies(page) {
  const button = page.getByRole('button', { name: 'Acceptera alla', exact: true })
  await button.click({ timeout: 2_000 }).catch(() => {})
}

async function wizardNext(page) {
  await page.locator('.wizard-cta').click()
}

async function pickFirstAvailableSlot(page) {
  for (let month = 0; month < 3; month += 1) {
    const days = page.locator('.fc-cal-cell:not([disabled])')
    await days.first().waitFor({ state: 'visible' })
    const count = await days.count()
    for (let index = 0; index < count; index += 1) {
      const day = days.nth(index)
      const label = (await day.getAttribute('aria-label'))?.toLocaleLowerCase('sv') ?? ''
      if (!label.startsWith('måndag')) continue

      const response = page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST'
          && new URL(candidate.url()).pathname === '/boka',
        { timeout: 15_000 },
      )
      await day.click()
      await response
      await page.waitForFunction(
        () =>
          !document.querySelector('.fc-skel-chip')
          && Boolean(document.querySelector('.wizard-time, .fc-noslots, .fc-alert')),
        undefined,
        { timeout: 10_000 },
      )
      const time = page.locator('.wizard-time').first()
      if (await time.isVisible().catch(() => false)) {
        await time.click()
        return
      }
      const alert = page.locator('.fc-alert').first()
      if (await alert.isVisible().catch(() => false)) {
        throw new Error(`Kunde inte läsa fixturetider: ${(await alert.textContent())?.trim() ?? 'okänt fel'}`)
      }
    }

    const next = page.getByRole('button', { name: 'Nästa månad', exact: true })
    if (await next.isDisabled()) break
    const title = page.locator('.fc-cal-title')
    const before = await title.textContent()
    await next.click()
    await waitFor(async () => (await title.textContent()) !== before, 'Kalenderns nästa månad', 3_000)
  }
  throw new Error('Ingen bokbar fixturetid hittades inom tre kalendermånader.')
}

async function outboxIds(client, tenantId) {
  const result = await client
    .from('notifications_outbox')
    .select('id')
    .eq('tenant_id', tenantId)
  supabaseError(result.error, 'Läs outbox-baslinje')
  return new Set((result.data ?? []).map((row) => row.id))
}

function captureBookingId(url, onBookingCreated) {
  const bookingId = url.match(/\/boka\/bekraftelse\/([0-9a-f-]+)/i)?.[1]
  assert(bookingId, 'Bekräftelserutten saknar boknings-id.')
  assert.equal(typeof onBookingCreated, 'function', 'Boknings-id måste fångas för säker städning.')
  onBookingCreated(bookingId)
  return bookingId
}

async function createVerifiedBooking(
  client,
  relay,
  page,
  storefrontBase,
  tenant,
  foundation,
  onBookingCreated,
) {
  const beforeOutbox = await outboxIds(client, tenant.id)
  await page.goto(`${storefrontBase}/boka?tenant=${encodeURIComponent(tenant.slug)}`)
  await acceptCookies(page)
  await page.getByRole('button', { name: new RegExp(SERVICE_NAME) }).first().click()
  await wizardNext(page)
  await page.locator('.wizard-stepbody').getByRole('button', { name: /^Alla\b/ }).click()
  await wizardNext(page)
  await pickFirstAvailableSlot(page)
  await wizardNext(page)
  await page.getByLabel('Namn', { exact: true }).fill('Goal 84 bokare')
  await page.getByLabel('E-post', { exact: true }).waitFor()
  await page.getByLabel('E-post', { exact: true }).fill(GUEST_EMAIL)
  await wizardNext(page)
  const pinInput = page.getByLabel('Verifieringskod', { exact: true })
  await pinInput.waitFor()
  let pin = await relay.waitForPin(GUEST_EMAIL)
  try {
    await pinInput.fill(pin)
  } finally {
    pin = ''
    relay.clearPins()
  }
  await page.getByRole('button', { name: 'Verifiera & boka', exact: true }).click()
  await page.waitForURL(/\/boka\/bekraftelse\/[0-9a-f-]+/i, { timeout: 30_000 })
  const bookingId = captureBookingId(page.url(), onBookingCreated)

  const booking = await client
    .from('bookings')
    .select('id, tenant_id, location_id, service_id, staff_id, status')
    .eq('id', bookingId)
    .single()
  supabaseError(booking.error, 'Verifiera skapad bokning')
  assert.deepEqual(
    {
      tenant_id: booking.data.tenant_id,
      location_id: booking.data.location_id,
      service_id: booking.data.service_id,
      staff_id: booking.data.staff_id,
    },
    {
      tenant_id: tenant.id,
      location_id: foundation.locationId,
      service_id: foundation.serviceId,
      staff_id: foundation.staffId,
    },
  )

  const newRows = await waitFor(async () => {
    const outbox = await client
      .from('notifications_outbox')
      .select('id, booking_id, event_type, chosen_channel, status')
      .eq('tenant_id', tenant.id)
      .in('event_type', ['booking_verification_pin', 'booking_confirmation'])
    supabaseError(outbox.error, 'Verifiera bokningsoutbox')
    const rows = (outbox.data ?? []).filter((row) => !beforeOutbox.has(row.id))
    return rows.some((row) => row.event_type === 'booking_verification_pin')
      && rows.some((row) => row.event_type === 'booking_confirmation' && row.booking_id === bookingId)
      ? rows
      : null
  }, 'PIN- och bekräftelseoutbox')
  const pinRow = newRows.find((row) => row.event_type === 'booking_verification_pin')
  const confirmationRow = newRows.find((row) => row.event_type === 'booking_confirmation')
  assert.equal(pinRow.chosen_channel, 'email')
  assert.equal(confirmationRow.chosen_channel, 'email')
  assert(!['failed', 'skipped'].includes(pinRow.status))
  assert(!['failed', 'skipped'].includes(confirmationRow.status))
  return bookingId
}

async function cancelOutstandingBooking(bookingId, bookingCancelled, cancel) {
  if (!bookingId || bookingCancelled) return bookingCancelled
  await cancel(bookingId)
  return true
}

async function cancelBookingViaUi(client, page, bookingId) {
  await page
    .getByRole('link', { name: 'Behöver du ändra? Avboka eller boka om', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Avboka din tid', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Avboka tid', exact: true }).click()
  await page.getByText('Din tid är avbokad. Varmt välkommen åter när det passar dig!', {
    exact: true,
  }).waitFor()
  await waitFor(async () => {
    const result = await client.from('bookings').select('status').eq('id', bookingId).single()
    supabaseError(result.error, 'Verifiera avbokning')
    return result.data.status === 'cancelled'
  }, 'Produktavbokning')
}

function assertTouchTargetSize(box, label) {
  assert(
    box && box.width >= 44 && box.height >= 44,
    `${label} är mindre än 44×44 px.`,
  )
}

async function mobileOverflowSmoke(browser, desktopContext, platformBase, storefrontBase, tenant) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    locale: 'sv-SE',
    timezoneId: 'Europe/Stockholm',
    storageState: await desktopContext.storageState(),
  })
  try {
    const page = await context.newPage()
    await page.goto(`${platformBase}/kunder/${tenant.id}`)
    await page.getByRole('tab', { name: 'Personal', exact: true }).click()
    await page.getByRole('heading', { name: 'Platsens öppettider', exact: true }).waitFor()
    const openingHours = page.locator('section[aria-labelledby="location-hours-title"]')
    await openingHours.waitFor()
    const interactive = openingHours.locator('button, input:not([type="hidden"]), select')
    let measuredTargets = 0
    for (let index = 0; index < await interactive.count(); index += 1) {
      const action = interactive.nth(index)
      if (!(await action.isVisible()) || !(await action.isEnabled())) continue
      const label = await action.getAttribute('aria-label')
        ?? await action.getAttribute('name')
        ?? `Öppettidskontroll ${index + 1}`
      assertTouchTargetSize(await action.boundingBox(), label)
      measuredTargets += 1
    }
    assert(measuredTargets > 0, 'Inga synliga aktiva öppettidskontroller hittades.')
    const platformOverflow = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.body.clientWidth,
    ))
    assert.equal(platformOverflow, 0, `Mobilkundkortet har ${platformOverflow}px horisontell overflow.`)
    await page.goto(`${storefrontBase}/boka?tenant=${encodeURIComponent(tenant.slug)}`)
    await page.getByRole('heading', { name: new RegExp(BOOKING_FIXTURE.name) }).waitFor()
    await acceptCookies(page)
    const overflow = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.body.clientWidth,
    ))
    assert.equal(overflow, 0, `Mobilvyn har ${overflow}px horisontell overflow.`)
  } finally {
    await context.close()
  }
}

async function freshCutSnapshot(client) {
  const tenantRead = await client
    .from('tenants')
    .select('id, slug, name, status, vertical_id')
    .eq('slug', 'freshcut')
  supabaseError(tenantRead.error, 'Läs FreshCut')
  const tenant = tenantRead.data?.find((row) => row.slug === 'freshcut')
  assert(tenant, 'Preview saknar FreshCut-baslinjen.')

  const modules = await client
    .from('tenant_modules')
    .select('module_key, state')
    .eq('tenant_id', tenant.id)
    .order('module_key')
  supabaseError(modules.error, 'Läs FreshCut-moduler')

  const tables = [
    'tenant_settings',
    'roles',
    'users',
    'locations',
    'location_opening_hours',
    'services',
    'staff',
    'staff_services',
    'working_hours',
    'bookings',
    'customers',
    'notifications_outbox',
  ]
  const counts = {}
  for (const table of tables) {
    const result = await client
      .from(table)
      .select('tenant_id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
    supabaseError(result.error, `Räkna FreshCut ${table}`)
    counts[table] = result.count
  }
  return { tenant, modules: modules.data ?? [], counts }
}

async function runAcceptance(mode) {
  const config = readConfig(process.env)
  const { createClient } = await import('@supabase/supabase-js')
  const { chromium } = await import('@playwright/test')
  let relay
  let app
  let identity
  let browser
  let page
  let bookingId
  let bookingCancelled = false
  let failed = false
  let failure
  try {
    relay = await startRelay()
    app = await startNext(config, relay)
    identity = await loginSeededPlatform(createClient, config)
    assertFixtureAvailability(mode, await Promise.all([
      tenantBySlug(identity.platform, WEBSITE_FIXTURE.slug),
      tenantBySlug(identity.platform, BOOKING_FIXTURE.slug),
    ]))
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      locale: 'sv-SE',
      timezoneId: 'Europe/Stockholm',
    })
    page = await context.newPage()
    await loginPlatform(page, app.platform, identity)
    const baseline = await freshCutSnapshot(identity.platform)

    console.log('goal84: Studio + website-only')
    const website = await ensureFixture(
      identity.platform,
      page,
      app.platform,
      WEBSITE_FIXTURE,
      mode,
    )
    const websiteReadiness = await launchReadiness(identity.platform, website.id)
    assert.equal(websiteReadiness.booking_required, false)
    assert.equal(websiteReadiness.ready, true)
    await publishViaUi(identity.platform, page, app.platform, website)

    console.log('goal84: Studio + komplett bokningsgrund')
    const bookingTenant = await ensureFixture(
      identity.platform,
      page,
      app.platform,
      BOOKING_FIXTURE,
      mode,
    )
    const initialReadiness = await launchReadiness(identity.platform, bookingTenant.id)
    if (shouldProveLiveBlockers(mode, bookingTenant.status, initialReadiness)) {
      await proveLiveBlockers(identity.platform, page, app.platform, bookingTenant)
    }
    await confirmOpeningHours(
      identity.platform,
      page,
      app.platform,
      bookingTenant.id,
    )
    await createServiceViaUi(page, app.platform, bookingTenant.id)
    await createStaffAndBookingSetupViaUi(page, app.platform, bookingTenant.id)
    const foundation = await verifyFoundation(identity.platform, bookingTenant.id)
    const ready = await launchReadiness(identity.platform, bookingTenant.id)
    assert.equal(ready.booking_required, true)
    assert.equal(ready.ready, true)
    assert.deepEqual(ready.missing, [])
    await publishViaUi(identity.platform, page, app.platform, bookingTenant)

    console.log('goal84: riktig fyrsiffrig PIN-bokning + avbokning')
    bookingId = await createVerifiedBooking(
      identity.platform,
      relay,
      page,
      app.storefront,
      bookingTenant,
      foundation,
      (createdBookingId) => { bookingId = createdBookingId },
    )
    await cancelBookingViaUi(identity.platform, page, bookingId)
    bookingCancelled = true
    await mobileOverflowSmoke(browser, context, app.platform, app.storefront, bookingTenant)
    assert.deepEqual(await freshCutSnapshot(identity.platform), baseline)
    await context.close()
  } catch (error) {
    failed = true
    failure = error
  } finally {
    const cleanupErrors = []
    const cleanups = [
      ['testbokning', async () => {
        bookingCancelled = await cancelOutstandingBooking(
          bookingId,
          bookingCancelled,
          async (outstandingBookingId) => {
            assert(identity?.platform && page && !page.isClosed(), 'Browsern saknas för produktavbokning.')
            await cancelBookingViaUi(identity.platform, page, outstandingBookingId)
          },
        )
      }],
      ['browser', () => browser?.close()],
      ['seedad superadminsession', () => identity?.platform.auth.signOut()],
      ['Next.js', () => app?.stop()],
      ['relay', () => relay?.close()],
    ]
    for (const [label, cleanup] of cleanups) {
      try {
        await cleanup()
      } catch (error) {
        cleanupErrors.push(new Error(`Kunde inte stänga ${label}.`, { cause: error }))
      }
    }
    if (failed && cleanupErrors.length > 0) {
      const primary = failure instanceof Error ? failure.message : String(failure)
      failure = new AggregateError(
        [failure, ...cleanupErrors],
        `${primary} Städning misslyckades också: ${cleanupErrors.map((error) => error.message).join(' ')}`,
      )
    } else if (cleanupErrors.length > 0) {
      failed = true
      failure = new AggregateError(cleanupErrors, 'Goal 84 kördes men städningen misslyckades.')
    }
  }
  if (failed) throw failure
  console.log(acceptanceSuccess(mode))
}

try {
  const mode = cliMode(process.argv.slice(2))
  if (mode === 'self-test') await runSelfTest()
  else await runAcceptance(mode)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  // PIN-koden får aldrig hamna i terminalen, inte ens om ett verktygsfel råkar bära den.
  console.error(`goal84: FAIL — ${message.replace(/(?<!\d)\d{4}(?!\d)/g, '[4 siffror]')}`)
  process.exitCode = 1
}
