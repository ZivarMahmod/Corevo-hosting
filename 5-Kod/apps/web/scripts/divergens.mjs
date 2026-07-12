// goal-62 C1 — DIVERGENS-MÄTNINGEN.
//
// Zivar: "allt ser ut som en mall man återanvänt … samma runda figurer, inga övergångar,
// samma sak om och om igen utan layoutförändringar."
//
// Ögonmått kan inte avgöra det, och "de har olika färger" är inte ett svar. Den här mätaren
// öppnar varje mall och läser dess FORMVOKABULÄR ur de renderade pixlarna:
//
//   radie       — vilka border-radius mallen faktiskt använder (dominant + spridning)
//   knappform   — pill / mjuk / kvadrat, samt knappens höjd och versalisering
//   kortstil    — skugga / ram / flat
//   sektioner   — antal sektioner + hur många som har ÖVERGÅNG (våg, diagonal, överlapp,
//                 foto-bleed) i stället för en rak kant
//   typografi   — display- + body-familj
//   rytm        — sektionshöjder (samma rytm i alla mallar = samma skelett)
//
// Två mallar med samma profil = FAIL: de är samma mall i olika färg.
//
//   node scripts/divergens.mjs            (alla mallar)
//   node scripts/divergens.mjs onyx flora (bara vissa)

import { chromium } from 'playwright'
import fs from 'node:fs'

const ALL = [
  'calytrix', 'aurora', 'sage', 'oliviathyme', 'paisley', 'onyx', 'viora',
  'isalara', 'seraphina', 'wildthistle', 'mina', 'lunaria', 'eloria',
  'flora', 'salvia', 'leander', 'zigge', 'linnea', 'edit', 'freshcut',
]
const themes = process.argv.slice(2).length ? process.argv.slice(2) : ALL
const HOST = 'florist.localhost:3111'

const PROBE = () => {
  const px = (v) => Math.round(parseFloat(v) || 0)
  const mode = (arr) => {
    const c = {}
    for (const v of arr) c[v] = (c[v] ?? 0) + 1
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '0'
  }

  // ── radie: alla synliga block med en radie
  const radii = []
  for (const el of document.querySelectorAll('main *, header *, footer *')) {
    const r = el.getBoundingClientRect()
    if (r.width < 24 || r.height < 24) continue
    const br = px(getComputedStyle(el).borderTopLeftRadius)
    if (br > 0) radii.push(br > 100 ? 999 : br)
  }

  // ── knappform
  const btn = document.querySelector('main a[class*=btn], main button[class*=buy], .btn-accent')
  const bs = btn ? getComputedStyle(btn) : null
  const btnRadius = bs ? px(bs.borderTopLeftRadius) : null
  const button = bs
    ? {
        radius: btnRadius > 100 ? 'pill' : btnRadius >= 6 ? `mjuk(${btnRadius})` : btnRadius > 0 ? `skarp(${btnRadius})` : 'kvadrat',
        height: px(bs.height),
        upper: bs.textTransform === 'uppercase',
        weight: bs.fontWeight,
        tracking: bs.letterSpacing,
      }
    : null

  // ── kortstil
  const card = document.querySelector('[class*=card], [class*=Card]')
  const cs = card ? getComputedStyle(card) : null
  const cardStyle = cs
    ? cs.boxShadow !== 'none'
      ? 'skugga'
      : parseFloat(cs.borderTopWidth) > 0
        ? 'ram'
        : 'flat'
    : null

  // ── sektioner + övergångar
  // goal-62 C4: tröskeln var 180px och urvalet bara DIREKTA barn — då räknades inte
  // presentkortsbanden och citatremsorna, som är just de ytor mallarna formar sin
  // sektionssöm i. En 120px hög färgplatta med en riven kant ÄR en sektionsövergång;
  // mätaren såg den inte och rapporterade "bara raka kanter" om en sida som hade sex.
  const sections = [...document.querySelectorAll('main section, main > *')].filter(
    (el) => el.getBoundingClientRect().height > 120,
  )
  let shaped = 0
  for (const el of sections) {
    const s = getComputedStyle(el)
    const before = getComputedStyle(el, '::before')
    const after = getComputedStyle(el, '::after')
    const hasClip = [s, before, after].some((x) => x.clipPath && x.clipPath !== 'none')
    const hasMask = [s, before, after].some((x) => x.maskImage && x.maskImage !== 'none')
    const hasSvgWave = !!el.querySelector('svg[class*=wave], svg[class*=curve], [class*=Wave], [class*=Curve]')
    const negPull = px(s.marginTop) < -20 || px(s.marginBottom) < -20 // överlapp
    const bleed = [...el.querySelectorAll('img')].some((i) => i.getBoundingClientRect().width >= window.innerWidth - 4)
    if (hasClip || hasMask || hasSvgWave || negPull || bleed) shaped++
  }

  const h1 = document.querySelector('h1')
  // Body-typsnittet MÅSTE läsas inne i mallens rot: <body> ligger utanför
  // [data-world="storefront"] och bär plattformens default (Inter) — mäts det där ser
  // alla 20 mallar ut att ha samma brödtext, vilket är fel.
  const bodyEl =
    document.querySelector('main p, main li, [data-world="storefront"] p') ?? document.body
  const body = bodyEl
  return {
    radiusMode: mode(radii),
    radiusSpread: [...new Set(radii)].sort((a, b) => a - b).slice(0, 6).join('/'),
    button,
    cardStyle,
    sections: sections.length,
    shaped,
    heights: sections.slice(0, 6).map((el) => Math.round(el.getBoundingClientRect().height / 50) * 50).join(','),
    display: h1 ? getComputedStyle(h1).fontFamily.split(',')[0].replace(/["']/g, '') : null,
    bodyFont: getComputedStyle(body).fontFamily.split(',')[0].replace(/["']/g, ''),
    navHeight: px(getComputedStyle(document.querySelector('header') ?? document.body).height),
  }
}

const b = await chromium.launch()
const rows = {}
for (const theme of themes) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } })
  await ctx.addCookies([{ name: 'corevo-dev-theme', value: theme, domain: 'florist.localhost', path: '/' }])
  const p = await ctx.newPage()
  try {
    await p.goto(`http://${HOST}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await p.waitForTimeout(1600)
    rows[theme] = await p.evaluate(PROBE)
  } catch (e) {
    rows[theme] = { error: String(e).slice(0, 60) }
  }
  await ctx.close()
}
await b.close()

// ── rapport
const line = (k, r) =>
  r.error
    ? `${k.padEnd(12)} FEL: ${r.error}`
    : `${k.padEnd(12)} radie ${String(r.radiusMode).padEnd(4)} (${(r.radiusSpread || '-').padEnd(16)}) | knapp ${String(r.button?.radius ?? '-').padEnd(10)} h${String(r.button?.height ?? '-').padEnd(3)} ${r.button?.upper ? 'VERSAL' : 'gemen '} | kort ${String(r.cardStyle ?? '-').padEnd(7)} | sekt ${String(r.sections).padStart(2)} varav formade ${String(r.shaped).padStart(2)} | ${String(r.display).slice(0, 14).padEnd(14)} / ${String(r.bodyFont).slice(0, 12)}`

console.log('\nFORMVOKABULÄR PER MALL\n' + '─'.repeat(150))
for (const [k, r] of Object.entries(rows)) console.log(line(k, r))

// Två mallar med samma profil = samma mall i olika färg.
const sig = (r) =>
  r.error ? null : [r.radiusMode, r.button?.radius, r.button?.upper, r.cardStyle, r.display, r.bodyFont].join('|')
const groups = {}
for (const [k, r] of Object.entries(rows)) {
  const s = sig(r)
  if (!s) continue
  ;(groups[s] = groups[s] ?? []).push(k)
}
const dupes = Object.entries(groups).filter(([, ks]) => ks.length > 1)

console.log('\n' + '─'.repeat(150))
const flat = Object.values(rows).filter((r) => !r.error && r.shaped === 0).length
console.log(`MALLAR UTAN EN ENDA SEKTIONSÖVERGÅNG (bara raka kanter): ${flat}/${Object.keys(rows).length}`)
if (dupes.length) {
  console.log(`\nIDENTISK FORMPROFIL — samma mall i olika färg:`)
  for (const [s, ks] of dupes) console.log(`  ${ks.join(' = ')}\n    ${s}`)
} else {
  console.log('\nIngen mall delar formprofil med en annan.')
}
fs.writeFileSync('divergens-rapport.json', JSON.stringify(rows, null, 1))
console.log('\nDetaljer: divergens-rapport.json')
