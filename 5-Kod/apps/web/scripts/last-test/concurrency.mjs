// goal-67 — BELASTNINGSTEST av bokningsmotorn (bevis, inte bygge).
//
// Kör N samtidiga anrop mot create_public_booking + samtidiga avboknings-,
// ombuknings- och återställningsrace. Allt sker mot en ISOLERAD fejktenant
// (lasttest-zzz-fejk) med bokningar år 2030. Städas i finally.
//
// Kör:  node apps/web/scripts/last-test/concurrency.mjs   (från 5-Kod)
//
// Skrivvägarna för admin (moveBooking/setBookingStatus) är server actions bakom
// auth — de kan inte anropas härifrån. Vi reproducerar därför EXAKT samma
// SQL-skrivning som de gör (samma filter, samma fält, ingen extra vakt) med
// service-rollen, och testar den DB-sanning de vilar på.
import { anonClient, svcClient, seed, cleanupAll, cleanupBookings, rowsAt, T } from './_env.mjs'

const anon = anonClient()
const svc = svcClient()
const results = []
const log = (name, verdict, detail) => {
  results.push({ name, verdict, detail })
  console.log(`${verdict === 'HELD' ? '✅ HÅLLER' : verdict === 'BROKE' ? '❌ BRAST' : '⚠️ NOTIS'}  ${name}\n     ${detail}`)
}

const slot = (mins) => new Date(new Date(T.base).getTime() + mins * 60_000).toISOString()
const uuid = () => crypto.randomUUID()

function create(startIso, tag, opts = {}) {
  return anon
    .rpc('create_public_booking', {
      p_tenant_slug: T.tenantSlug,
      p_service: T.serviceId,
      p_staff: opts.staff ?? T.staffId,
      p_start: startIso,
      p_note: `LASTTEST ${tag}`,
      p_guest_name: 'Fejk Testkund',
      p_request_id: opts.requestId ?? null,
    })
    .then(({ data, error }) => ({ data, error }))
}

/** Samma UPDATE som lib/admin/calendar-actions.ts moveBooking gör (rad ~113-137). */
async function moveLikeApp(bookingId, startIso, staffId = T.staffId, delayMs = 0) {
  const { data: current } = await svc
    .from('bookings').select('start_ts, end_ts, status')
    .eq('id', bookingId).eq('tenant_id', T.tenantId).maybeSingle()
  if (!current) return { error: { message: 'gone' } }
  if (current.status === 'cancelled' || current.status === 'no_show') {
    return { error: { message: 'app_guard_blocked' } }
  }
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
  const dur = new Date(current.end_ts).getTime() - new Date(current.start_ts).getTime()
  const start = new Date(startIso)
  const { error } = await svc
    .from('bookings')
    .update({
      start_ts: start.toISOString(),
      end_ts: new Date(start.getTime() + dur).toISOString(),
      staff_id: staffId,
    })
    .eq('id', bookingId).eq('tenant_id', T.tenantId)
  return { error }
}

/** Samma UPDATE som setBookingStatus gör. */
async function setStatus(bookingId, status) {
  const { error } = await svc
    .from('bookings')
    .update({ status, cancelled_at: status === 'cancelled' ? new Date().toISOString() : null })
    .eq('id', bookingId).eq('tenant_id', T.tenantId)
  return { error }
}

// ───────────────────────────────────────────────────────────── SCENARIER

/** A1 — N samtidiga bokningar på EXAKT samma tid + resurs. */
async function s1_sameSlot(n) {
  cleanupBookings()
  const start = slot(0)
  const r = await Promise.all(Array.from({ length: n }, (_, i) => create(start, `N${n}-${i}`)))
  const ok = r.filter((x) => !x.error && x.data)
  const conflict = r.filter((x) => x.error?.code === '23P01')
  const other = r.filter((x) => x.error && x.error.code !== '23P01')
  const rows = await rowsAt(svc, start)
  const active = rows.filter((x) => ['pending', 'confirmed', 'completed'].includes(x.status))
  const detail = `försök=${n} lyckade=${ok.length} 23P01=${conflict.length} annat=${other.length ? other.map((o) => o.error.code).join(',') : 0} rader_i_DB=${rows.length} (aktiva=${active.length})`
  const held = ok.length === 1 && rows.length === 1 && other.length === 0 && conflict.length === n - 1
  log(`A1 samtidig bokning, N=${n}`, held ? 'HELD' : 'BROKE', detail)
}

/** A2 — samma request_id N gånger samtidigt (idempotens, 0048). */
async function s2_idempotens(n) {
  cleanupBookings()
  const start = slot(60)
  const rid = uuid()
  const r = await Promise.all(Array.from({ length: n }, (_, i) => create(start, `RID-${i}`, { requestId: rid })))
  const ids = new Set(r.filter((x) => x.data).map((x) => x.data))
  const errs = r.filter((x) => x.error)
  const rows = await rowsAt(svc, start)
  const held = rows.length === 1 && ids.size === 1 && errs.length === 0
  log(`A2 idempotens: samma request_id ×${n}`, held ? 'HELD' : 'BROKE',
    `lyckade=${r.length - errs.length} unika_id=${ids.size} fel=${errs.map((e) => e.error.code).join(',') || 0} rader_i_DB=${rows.length}`)
}

/** A3 — avbokning och ombokning av SAMMA bokning samtidigt (lost update?). */
async function s3_cancelVsMove() {
  cleanupBookings()
  const start = slot(120)
  const { data: id } = await create(start, 'CANCEL-VS-MOVE')
  const target = slot(180)
  // Ombokningen läser FÖRST (ser 'confirmed'/'pending'), avbokningen slår till under tiden.
  const [mv, cx] = await Promise.all([moveLikeApp(id, target, T.staffId, 250), (async () => { await new Promise((r) => setTimeout(r, 60)); return setStatus(id, 'cancelled') })()])
  const { data: row } = await svc.from('bookings').select('status, start_ts').eq('id', id).single()
  const moved = row.start_ts.startsWith(target.slice(0, 16))
  const lostUpdate = row.status === 'cancelled' && moved
  log('A4 avboka + omboka samma bokning samtidigt',
    lostUpdate ? 'BROKE' : 'HELD',
    `move=${mv.error ? 'ERR ' + mv.error.message : 'OK'} cancel=${cx.error ? 'ERR' : 'OK'} slutstatus=${row.status} flyttad=${moved} → ${lostUpdate ? 'AVBOKAD BOKNING FLYTTADES (TOCTOU: app-vakten läste före avbokningen)' : 'ingen tappad uppdatering'} — inga dubbletter oavsett`)
}

/** A4 — två samtidiga flyttar av OLIKA bokningar till samma måltid. */
async function s4_twoMovesSameTarget() {
  cleanupBookings()
  const { data: a } = await create(slot(240), 'MOVE-A')
  const { data: b } = await create(slot(300), 'MOVE-B')
  const target = slot(360)
  const [ra, rb] = await Promise.all([moveLikeApp(a, target), moveLikeApp(b, target)])
  const rows = await rowsAt(svc, target)
  const ok = [ra, rb].filter((x) => !x.error).length
  const held = rows.length === 1 && ok === 1
  log('A5 två bokningar flyttas till samma tid samtidigt', held ? 'HELD' : 'BROKE',
    `lyckade_flyttar=${ok} rader_på_måltiden=${rows.length} fel=${[ra, rb].filter((x) => x.error).map((x) => x.error.code ?? x.error.message).join(',')}`)
}

/** A5 — samma bokning flyttas till samma måltid av två samtidigt. */
async function s5_sameBookingSameTarget() {
  cleanupBookings()
  const { data: a } = await create(slot(420), 'DBLMOVE')
  const target = slot(480)
  const [x, y] = await Promise.all([moveLikeApp(a, target), moveLikeApp(a, target)])
  const rows = await rowsAt(svc, target)
  const held = rows.length === 1 && !x.error && !y.error
  log('A6 samma bokning flyttas två gånger samtidigt till samma tid', held ? 'HELD' : 'BROKE',
    `fel=${[x, y].filter((r) => r.error).map((r) => r.error.code).join(',') || 0} rader_på_måltiden=${rows.length}`)
}

/** A6 — boka in i luckan som PRECIS avbokades: N samtidiga försök. */
async function s6_raceIntoFreedSlot(n) {
  cleanupBookings()
  const start = slot(540)
  const { data: id } = await create(start, 'TO-BE-CANCELLED')
  await setStatus(id, 'cancelled')
  const r = await Promise.all(Array.from({ length: n }, (_, i) => create(start, `FREED-${i}`)))
  const ok = r.filter((x) => !x.error).length
  const rows = await rowsAt(svc, start)
  const active = rows.filter((x) => ['pending', 'confirmed', 'completed'].includes(x.status))
  const held = ok === 1 && active.length === 1
  log(`A7 ${n} samtidiga bokningar i nyss avbokad lucka`, held ? 'HELD' : 'BROKE',
    `lyckade=${ok} aktiva_rader=${active.length} totalt_rader=${rows.length} (1 avbokad kvar = korrekt, EXCLUDE ignorerar cancelled)`)
}

/** A7 — återställ avbokning medan någon annan bokar luckan (samtidigt). */
async function s7_restoreVsRebook() {
  cleanupBookings()
  const start = slot(600)
  const { data: id } = await create(start, 'RESTORE-BASE')
  await setStatus(id, 'cancelled')
  const [rest, made] = await Promise.all([
    setStatus(id, 'confirmed'),
    (async () => { await new Promise((r) => setTimeout(r, 5)); return create(start, 'REBOOK-RACE') })(),
  ])
  const rows = await rowsAt(svc, start)
  const active = rows.filter((x) => ['pending', 'confirmed', 'completed'].includes(x.status))
  const held = active.length === 1
  log('A8 återställ avbokning + ny bokning i samma lucka samtidigt', held ? 'HELD' : 'BROKE',
    `restore=${rest.error ? 'AVVISAD ' + (rest.error.code ?? '') : 'OK'} nybokning=${made.error ? 'AVVISAD ' + made.error.code : 'OK'} aktiva_rader=${active.length}`)
}

/** A8 — kant-mot-kant (10:00-10:30 + 10:30-11:00) ska VARA tillåtet. */
async function s8_edgeToEdge() {
  cleanupBookings()
  const a = await create(slot(660), 'EDGE-A')
  const b = await create(slot(690), 'EDGE-B') // exakt när A slutar (30 min tjänst)
  const { data: rows } = await svc.from('bookings').select('id').eq('tenant_id', T.tenantId)
    .in('start_ts', [slot(660), slot(690)])
  const held = !a.error && !b.error && rows.length === 2
  log('A9 kant-mot-kant (10:00-10:30 + 10:30-11:00)', held ? 'HELD' : 'BROKE',
    `a=${a.error?.code ?? 'OK'} b=${b.error?.code ?? 'OK'} rader=${rows?.length} (tstzrange är [) → rör ej varandra)`)
}

/** A9 — blandad last: 60 samtidiga anrop över 6 slottar × 2 resurser. */
async function s9_mixedLoad() {
  cleanupBookings()
  const slots = [720, 750, 780, 810, 840, 870].map(slot)
  const staffs = [T.staffId, T.staff2Id]
  const calls = []
  for (let i = 0; i < 60; i++) {
    // slot varvar per anrop, resurs varvar per block om 6 → 12 UNIKA (resurs, tid).
    calls.push(create(slots[i % 6], `MIX-${i}`, { staff: staffs[Math.floor(i / 6) % 2] }))
  }
  const r = await Promise.all(calls)
  const ok = r.filter((x) => !x.error).length
  const conflict = r.filter((x) => x.error?.code === '23P01').length
  const other = r.filter((x) => x.error && x.error.code !== '23P01')
  const { data: rows } = await svc.from('bookings').select('id, staff_id, start_ts')
    .eq('tenant_id', T.tenantId).in('status', ['pending', 'confirmed', 'completed'])
  const keys = new Set(rows.map((x) => `${x.staff_id}|${x.start_ts}`))
  // 6 slottar × 2 resurser = 12 unika kombinationer.
  const held = ok === 12 && rows.length === 12 && keys.size === 12 && other.length === 0
  log('A10 blandad last: 60 samtidiga anrop, 12 unika slottar', held ? 'HELD' : 'BROKE',
    `försök=60 lyckade=${ok} 23P01=${conflict} annat=${other.map((o) => o.error.code).join(',') || 0} rader_i_DB=${rows.length} unika_(resurs,tid)=${keys.size}`)
}

/** A10 — bufferten: tjänst med buffer_min 15 → krock 10:30 ska stoppas? */
async function s10_buffer() {
  cleanupBookings()
  await svc.from('services').update({ buffer_min: 15 }).eq('id', T.serviceId)
  const a = await create(slot(900), 'BUF-A') // 15:00-15:30 + 15 min buffert
  const b = await create(slot(930), 'BUF-B') // 15:30 — inne i bufferten
  const { data: rows } = await svc.from('bookings').select('id').eq('tenant_id', T.tenantId)
  await svc.from('services').update({ buffer_min: 0 }).eq('id', T.serviceId)
  const dbBlocked = !!b.error
  log('A11 buffert-krock (buffer_min=15, nästa bokning direkt efter)',
    dbBlocked ? 'HELD' : 'NOTE',
    `a=${a.error?.code ?? 'OK'} b=${b.error?.code ?? 'OK'} rader=${rows?.length} → DB:n känner INTE till buffer_min (EXCLUDE ser bara start_ts/end_ts). Bufferten är en PRESENTATIONSregel i slot-listan, inte ett krockskydd.`)
}

// ───────────────────────────────────────────────────────────── KÖR
try {
  await cleanupAll()
  await seed(svc)
  console.log(`Seedad isolerad testtenant: ${T.tenantSlug} (${T.tenantId}) — allt ligger 2030-06-05.\n`)

  await s1_sameSlot(2)
  await s1_sameSlot(10)
  await s1_sameSlot(50)
  await s2_idempotens(10)
  await s3_cancelVsMove()
  await s4_twoMovesSameTarget()
  await s5_sameBookingSameTarget()
  await s6_raceIntoFreedSlot(10)
  await s7_restoreVsRebook()
  await s8_edgeToEdge()
  await s9_mixedLoad()
  await s10_buffer()

  const broke = results.filter((r) => r.verdict === 'BROKE')
  console.log(`\n=== ${results.length} scenarier: ${results.filter((r) => r.verdict === 'HELD').length} HÖLL, ${broke.length} BRAST, ${results.filter((r) => r.verdict === 'NOTE').length} notis ===`)
  process.exitCode = broke.length ? 1 : 0
} finally {
  await cleanupAll()
  const { count } = await svc.from('bookings').select('*', { count: 'exact', head: true }).eq('tenant_id', T.tenantId)
  console.log(`Städat. Kvarvarande testrader: ${count ?? 0}`)
}
