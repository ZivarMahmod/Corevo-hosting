// goal-62 B1 — KONTRAST-ROBOTEN.
//
// Zivar: "många gånger syns inte vissa texter pga olika färger som är i vägen."
// Ögonmått hittar inte det. Roboten öppnar VARJE mall på VARJE storefront-sida och mäter
// varje synlig textnod mot den bakgrund den FAKTISKT ligger på (klättrar uppåt tills en
// ogenomskinlig bakgrund hittas — en token säger inget om vad som råkar ligga bakom).
//
// WCAG: 4.5:1 för brödtext, 3:1 för stor text (>=24px, eller >=18.66px fet).
//
// Kör:  node scripts/kontrast.mjs            (alla mallar, alla sidor)
//       node scripts/kontrast.mjs onyx sage  (bara vissa mallar)
// Kräver dev-servern på :3111 (cookien corevo-dev-theme renderar vilken mall som helst).

import { chromium } from 'playwright'
import fs from 'node:fs'

const ALL_THEMES = [
  'calytrix', 'aurora', 'sage', 'oliviathyme', 'paisley', 'onyx', 'viora',
  'isalara', 'seraphina', 'wildthistle', 'mina', 'lunaria', 'eloria',
  'flora', 'salvia', 'leander', 'zigge', 'linnea', 'edit', 'freshcut',
]
const PAGES = ['/', '/shop', '/om', '/kontakt', '/tjanster']
const HOST = 'florist.localhost:3111'

const themes = process.argv.slice(2).length ? process.argv.slice(2) : ALL_THEMES

// Mätfunktionen körs i sidan. Ingen import — allt inline.
const MEASURE = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map((x) => parseFloat(x))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  })
  const lum = (c) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }
  // Bakgrunden är den som FAKTISKT ligger under texten — inte den som tokens påstår.
  // elementsFromPoint ger den riktiga staplingen i pixeln (fångar absolut positionerade
  // foton och överlägg som inte är förälder till texten). Ett <img> eller en
  // background-image under texten = "över foto" → mäts inte som färg (flaggas separat).
  // Bakgrunden = elementets EGEN bakgrund först, sedan förfädernas tills en opak färg
  // hittas (en genomskinlig knapp ärver sektionens färg — det är den texten ligger på).
  // Foto-fällan: ett absolut positionerat <img>/bakgrundsfoto under texten kan inte mätas
  // som en färg — den upptäcks via elementsFromPoint och flaggas i stället för att ljuga.
  const overPhoto = (el) => {
    let r = el.getBoundingClientRect()
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ block: 'center' })
      r = el.getBoundingClientRect()
    }
    const cx = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1)
    const cy = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1)
    const stack = document.elementsFromPoint(cx, cy)
    const start = stack.indexOf(el)
    const below = start >= 0 ? stack.slice(start + 1) : []
    for (const n of below) {
      if (el.contains(n)) continue
      const cs = getComputedStyle(n)
      if (n.tagName === 'IMG' || n.tagName === 'VIDEO' || n.tagName === 'CANVAS') return true
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return true
      const c = parse(cs.backgroundColor)
      if (c && c.a >= 0.99) return false // opak färg först → inget foto i vägen
    }
    return false
  }

  const bgOf = (el) => {
    // Foto-kollen FÖRST: ett absolut positionerat foto målas ovanpå förälderns färg,
    // så färg-klättringen skulle annars hitta en färg som ingen ser (mätt: floras
    // closing-band — vit text på foto, färg-klättringen sa "vit på gräddvit").
    if (overPhoto(el)) return { color: { r: 128, g: 128, b: 128, a: 1 }, overImage: true }
    let n = el
    let acc = null
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n)
      const c = parse(cs.backgroundColor)
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c
        if (acc.a >= 0.99) return { color: acc, overImage: false }
      }
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        return { color: acc ?? { r: 128, g: 128, b: 128, a: 1 }, overImage: true }
      }
      n = n.parentElement
    }
    const bg = acc ?? { r: 255, g: 255, b: 255, a: 1 }
    return { color: bg, overImage: overPhoto(el) }
  }

  const fails = []
  const seen = new Set()
  const nodes = document.querySelectorAll('body *')
  for (const el of nodes) {
    // bara element med EGEN direkt text
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (!own.length) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.15) continue
    const fg = parse(cs.color)
    if (!fg) continue
    const { color: bg, overImage } = bgOf(el)
    // Text ovanpå ett foto kan inte mätas mot en färg — flaggas separat, inte som FAIL.
    const px = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight, 10) >= 700
    const large = px >= 24 || (bold && px >= 18.66)
    const need = large ? 3 : 4.5
    const eff = fg.a < 1 ? over(fg, bg) : fg
    const cr = ratio(eff, bg)
    if (cr >= need) continue
    const text = own.map((n) => n.textContent.trim()).join(' ').slice(0, 42)
    const key = `${el.tagName}|${text}|${Math.round(cr * 10)}`
    if (seen.has(key)) continue
    seen.add(key)
    fails.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').split(' ')[0].slice(0, 28),
      text,
      px: Math.round(px),
      ratio: Math.round(cr * 100) / 100,
      need,
      fg: `rgb(${Math.round(eff.r)},${Math.round(eff.g)},${Math.round(eff.b)})`,
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      overImage,
    })
  }
  return fails
}

const b = await chromium.launch()
const report = {}
let total = 0

for (const theme of themes) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } })
  await ctx.addCookies([{ name: 'corevo-dev-theme', value: theme, domain: 'florist.localhost', path: '/' }])
  const p = await ctx.newPage()
  report[theme] = {}
  for (const path of PAGES) {
    try {
      await p.goto(`http://${HOST}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await p.waitForTimeout(1200)
      const fails = await p.evaluate(MEASURE)
      const real = fails.filter((f) => !f.overImage)
      if (real.length) {
        report[theme][path] = real
        total += real.length
      }
    } catch (e) {
      report[theme][path] = [{ error: String(e).slice(0, 70) }]
    }
  }
  await ctx.close()
  const n = Object.values(report[theme]).flat().length
  console.log(`${theme.padEnd(12)} ${n === 0 ? 'OK' : n + ' FAIL'}`)
}
await b.close()

fs.writeFileSync('kontrast-rapport.json', JSON.stringify(report, null, 1))
console.log(`\nTOTALT ${total} kontrastbrott. Detaljer: kontrast-rapport.json`)
process.exit(total > 0 ? 1 : 0)
