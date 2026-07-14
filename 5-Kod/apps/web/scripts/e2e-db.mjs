#!/usr/bin/env node
/**
 * E2E-databasen — seed / teardown / verify.
 *
 *   node apps/web/scripts/e2e-db.mjs seed      # lägg upp fixturen
 *   node apps/web/scripts/e2e-db.mjs teardown  # riv fixturen + allt sviten skapade
 *   node apps/web/scripts/e2e-db.mjs verify    # bevisa att inget e2e-skräp finns kvar
 *
 * Sviten kör mot PRODUKTIONSDATABASEN (Zivars beslut 2026-07-14 — inga slutkunder
 * ännu, och Free-planen har ingen branching). Det gör städningen till ett villkor,
 * inte en artighet. Därför:
 *
 *   · `seed` skriver ALDRIG ett lösenord till disk. E2E_PASSWORD läses ur miljön;
 *     saknas den genereras ett slumpat engångslösenord som bara lever i den här
 *     processen och skickas vidare till Playwright. Fixturen innehåller en
 *     super_admin — ett känt lösenord på den i produktionen vore oförsvarligt.
 *   · `verify` är det som avgör om körningen var ren. Kör den ALLTID efter teardown.
 *
 * Kör mot den länkade Supabase-instansen via CLI:n (`supabase db query --linked`) —
 * samma väg som allt annat ad-hoc i repot.
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..') // → 5-Kod
const SEEDS = path.join(ROOT, 'supabase', 'seeds')

/** Kör SQL mot den länkade DB:n. Returnerar rå stdout.
 *
 *  Vägen hit är inte godtycklig — två andra dog först:
 *    · execFileSync('npx', …, {shell:true}) → cmd.exe styckar flerradig SQL på
 *      radbrytningarna och inserten dör mitt i.
 *    · execFileSync('npx.cmd', …, {shell:false}) → går inte att spawna alls (status null).
 *  Kvar: SQL:en till en temp-fil och CLI:n via bash, som finns på maskinen och klarar
 *  "$(cat …)". Filen ligger i os.tmpdir() och raderas alltid (finally) — den bär ett
 *  engångslösenord i klartext och får inte överleva processen. */
function sql(query) {
  const tmp = path.join(tmpdir(), `corevo-e2e-${randomBytes(6).toString('hex')}.sql`)
  writeFileSync(tmp, query, 'utf8')
  try {
    return execFileSync('bash', ['-lc', `npx supabase db query --linked "$(cat '${tmp}')"`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    })
  } finally {
    rmSync(tmp, { force: true })
  }
}

/** Läs en rad-array ur CLI:ns JSON-svar (den skriver skräp före JSON-blocket). */
function rows(out) {
  const i = out.indexOf('{')
  if (i < 0) return []
  try {
    return JSON.parse(out.slice(i)).rows ?? []
  } catch {
    return []
  }
}

function seed() {
  // Ett lösenord som aldrig når disk. Räcker för en fixtur som lever i minuter.
  const password = process.env.E2E_PASSWORD || `E2e!${randomBytes(12).toString('base64url')}`
  const file = readFileSync(path.join(SEEDS, 'e2e-seed.sql'), 'utf8')
  if (!file.includes('__E2E_PASSWORD__')) throw new Error('e2e-seed.sql saknar __E2E_PASSWORD__')
  sql(file.replaceAll('__E2E_PASSWORD__', password))
  console.log('e2e-db: fixturen är seedad (tenant frisor1).')
  // Playwright läser lösenordet härifrån. Skrivs till stdout BARA som en
  // export-rad; ingen fil, inget i git.
  console.log(`E2E_PASSWORD=${password}`)
  return password
}

function teardown() {
  sql(readFileSync(path.join(SEEDS, 'e2e-teardown.sql'), 'utf8'))
  console.log('e2e-db: fixturen är riven.')
}

/** Beviset. Hittar den NÅGOT kvar → exit 1, och körningen underkänns. */
function verify() {
  const checks = [
    ['tenants', "select slug from public.tenants where slug = 'frisor1' or slug like 'e2e%'"],
    ['auth.users', "select email from auth.users where id::text like 'e2e00000%'"],
    ['roles', "select id::text as id from public.roles where id::text like 'e2e00000%'"],
    // Bokningar utan tenant vore föräldralösa rader — ska aldrig kunna finnas.
    [
      'föräldralösa bokningar',
      'select b.id::text as id from public.bookings b left join public.tenants t on t.id = b.tenant_id where t.id is null',
    ],
  ]
  let dirty = 0
  for (const [label, q] of checks) {
    const found = rows(sql(q))
    if (found.length) {
      dirty += found.length
      console.error(`✗ ${label}: ${found.length} rad(er) kvar → ${JSON.stringify(found)}`)
    } else {
      console.log(`✓ ${label}: rent`)
    }
  }
  if (dirty) {
    console.error(`\ne2e-db: ${dirty} rad(er) e2e-skräp kvar i databasen.`)
    process.exit(1)
  }
  console.log('\ne2e-db: databasen är ren — inget e2e-skräp kvar.')
}

const cmd = process.argv[2]
if (cmd === 'seed') seed()
else if (cmd === 'teardown') teardown()
else if (cmd === 'verify') verify()
else {
  console.error('användning: e2e-db.mjs seed | teardown | verify')
  process.exit(2)
}
