#!/usr/bin/env node
// Prestanda-audit STEG 6 — mät om: hämtar Workers-invokationer per status ur Cloudflares
// GraphQL-analytics och skriver ut exceededResources-takten för några fönster. Kör detta
// ~2-3 dygn EFTER en prestanda-deploy och jämför takten mot baslinjen.
//
// Baslinje (2026-07-15, före steg 1-4): 6 dygn = 69 exceededResources / 15490 (0,445%),
// men senaste 24h = 47 / 2552 (1,842%) — krascherna accelererade precis före deployen.
// Sjunker 24h-takten tydligt under 1,8% med jämförbar trafik → minneshypotesen höll och
// steg 1-3 bet. Gör den inte det → mät minnet direkt (auditens plan B).
//
//   CLOUDFLARE_API_TOKEN=... node scripts/cf-exceeded.mjs   (läser även apps/web/.env.local)
//
// Token behöver "Account Analytics: Read". Ingen skrivning, ingen PII — bara aggregat.

import { readFileSync } from 'node:fs'

const ACCOUNT = '0be2655be66efbfa5d9b36721ddae008'
const SCRIPT = 'bokningsplatformen'

function token() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    const m = env.match(/^CLOUDFLARE_API_TOKEN=(.*)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch {}
  throw new Error('CLOUDFLARE_API_TOKEN saknas (env eller apps/web/.env.local).')
}

const Q = `query($tag:String!,$s:Time!,$u:Time!){viewer{accounts(filter:{accountTag:$tag}){
  workersInvocationsAdaptive(limit:10000,filter:{scriptName:"${SCRIPT}",datetime_geq:$s,datetime_leq:$u}){
    sum{requests} dimensions{status}
  }}}}`

async function window(label, since, now, tok) {
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: Q, variables: { tag: ACCOUNT, s: since.toISOString(), u: now.toISOString() } }),
  })
  const j = await r.json()
  if (j.errors) return console.log(`${label}: FEL ${JSON.stringify(j.errors).slice(0, 200)}`)
  const rows = j.data.viewer.accounts[0].workersInvocationsAdaptive
  const by = {}
  let tot = 0
  for (const x of rows) {
    by[x.dimensions.status] = (by[x.dimensions.status] || 0) + x.sum.requests
    tot += x.sum.requests
  }
  const exc = by.exceededResources || 0
  console.log(`\n=== ${label} (${since.toISOString().slice(0, 16)} → nu) tot=${tot} ===`)
  for (const [s, n] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(`  ${s}: ${n}`)
  console.log(`  exceededResources: ${tot ? ((exc / tot) * 100).toFixed(3) : 0}%  (baslinje 24h = 1,842%)`)
}

const tok = token()
const now = new Date()
await window('6 dygn', new Date(now - 6 * 864e5), now, tok)
await window('24h', new Date(now - 864e5), now, tok)
await window('48h', new Date(now - 2 * 864e5), now, tok)
console.log('\nnow=' + now.toISOString())
