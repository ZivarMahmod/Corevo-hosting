// goal-62 D2 — EGNA FOTON PER MALL.
//
// Mätt i D1: mallarna DELAR sina foton. Ett och samma Unsplash-foto låg i ÅTTA mallar,
// 16 foto-id var delade, och hela sviten drog ur en pool på 26 bilder. Det är en stor
// del av Zivars "allt ser ut som en mall man återanvänt" — samma bild, ny färg.
//
// Skriptet hämtar ÄKTA foto-id ur Unsplashs publika sök-API (napi), ett eget sökord per
// mall så bildvärlden matchar mallens ton, och garanterar att INGEN bild förekommer i två
// mallar (global claim-lista). Id:n hittas aldrig på — de kommer ur svaret och verifieras
// med en HEAD mot bild-URL:en innan de skrivs.
//
//   node scripts/foton-per-mall.mjs           → skriver foton-per-mall.json
//   node scripts/foton-per-mall.mjs --verify  → kontrollerar bara att befintlig JSON lever

import fs from 'node:fs'

// Sökordet ÄR mallens bildvärld — inte en synonym för "blommor".
const QUERY = {
  calytrix: 'plum flowers dark moody bouquet',
  aurora: 'coral flowers bright airy studio',
  sage: 'green foliage minimal botanical',
  oliviathyme: 'flower shop storefront vintage',
  paisley: 'red flowers newspaper editorial still life',
  onyx: 'dark moody flowers black background',
  viora: 'violet purple flowers soft light',
  isalara: 'blue evening flowers elegant',
  seraphina: 'wedding bouquet champagne gold',
  wildthistle: 'wild thistle dried flowers rustic',
  mina: 'minimal single flower white studio',
  lunaria: 'dried lunaria honesty plant pale',
  eloria: 'blush pink roses luxury',
  flora: 'moss green organic bouquet',
  salvia: 'sage green calm salon interior',
  leander: 'lavender purple calm spa',
  zigge: 'barbershop dark amber interior',
  linnea: 'terracotta clay warm interior',
  edit: 'editorial monochrome charcoal salon',
  freshcut: 'barbershop gold white haircut',
}
const PER_THEME = 14

const api = async (q, page) => {
  const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(q)}&per_page=30&page=${page}`
  const r = await fetch(url, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`${q}: HTTP ${r.status}`)
  const body = await r.text()
  return [...body.matchAll(/images\.unsplash\.com\/photo-([0-9a-f-]{20,})/g)].map((m) => m[1])
}

const alive = async (id) => {
  const r = await fetch(`https://images.unsplash.com/photo-${id}?w=80&q=1`, { method: 'HEAD' })
  return r.ok
}

if (process.argv.includes('--verify')) {
  const cur = JSON.parse(fs.readFileSync('scripts/foton-per-mall.json', 'utf8'))
  const all = Object.values(cur).flat()
  const dupes = all.filter((id, i) => all.indexOf(id) !== i)
  let dead = 0
  for (const id of new Set(all)) if (!(await alive(id))) { dead++; console.log('DÖD:', id) }
  console.log(`${Object.keys(cur).length} mallar · ${all.length} foton · ${new Set(all).size} unika`)
  console.log(dupes.length ? `FAIL: ${dupes.length} delade foton` : 'OK: ingen mall delar foto med en annan')
  console.log(dead ? `FAIL: ${dead} döda bild-URL:er` : 'OK: alla bild-URL:er lever')
  process.exit(dupes.length || dead ? 1 : 0)
}

const claimed = new Set()
const out = {}
for (const [theme, q] of Object.entries(QUERY)) {
  const picks = []
  // Ett smalt sökord ("dried lunaria honesty plant pale") ger ibland bara 2 träffar. Då
  // breddas det ETT steg — aldrig till "flowers", som hade gett alla mallar samma bilder.
  const w = q.split(' ')
  const queries = [q, w.slice(0, 2).join(' '), w[0], w.slice(-2).join(' ')]
  for (const qq of queries) {
   for (let page = 1; page <= 6 && picks.length < PER_THEME; page++) {
    for (const id of await api(qq, page)) {
      if (picks.length >= PER_THEME) break
      if (claimed.has(id)) continue // ingen mall lånar en annans bild
      if (!(await alive(id))) continue
      claimed.add(id)
      picks.push(id)
    }
   }
   if (picks.length >= PER_THEME) break
  }
  if (picks.length < PER_THEME) throw new Error(`${theme}: fick bara ${picks.length}/${PER_THEME}`)
  out[theme] = picks
  console.log(`${theme.padEnd(12)} ${picks.length} egna foton`)
}
fs.writeFileSync('scripts/foton-per-mall.json', JSON.stringify(out, null, 1))
console.log(`\n${claimed.size} unika foton, noll delade. → scripts/foton-per-mall.json`)
