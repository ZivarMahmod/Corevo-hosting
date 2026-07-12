// goal-62 B3 — KONTRAST-VAKTEN (CI).
//
// `npm run kontrast` öppnar 20 mallar × 5 sidor i en riktig webbläsare. Det är sanningen,
// men det kräver en dev-server och tar minuter — fel verktyg för varje push.
//
// Den här vakten räknar i stället PÅ TOKENS, utan bygge och utan browser: varje mall måste
// ha en textfärg som klarar WCAG mot sina egna ytor, och en knapptext som klarar sin egen
// knappfyllning. Det är exakt de tre systemfel som goal-62 B2a/B2b grävde fram — en ny mall
// (eller en ändrad palett) kan inte längre födas med osynlig text utan att bygget failar.
//
//   npm run vakt:kontrast
//
// Faller vakten: ändra mallens palett, eller sätt --color-primary-ink/--color-accent-fg
// explicit i dess block. Vill du se exakt VILKEN text som brister → kör npm run kontrast.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TOKENS = path.join(HERE, '../../../packages/ui/tokens.css')
const FLORIST = path.join(HERE, '../components/storefront/layouts/florist')

const MIN_TEXT = 4.5 // WCAG AA, brödtext


const rgb = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim())
  if (!m) return null
  const s = m[1]
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16))
}
const lum = (c) => {
  const f = (v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
const ratio = (a, b) => {
  const ca = rgb(a)
  const cb = rgb(b)
  if (!ca || !cb) return null
  const la = lum(ca)
  const lb = lum(cb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Ett tema → dess färgtokens (bara hex; var(...)-hänvisningar hoppas över). */
function themesFromTokens() {
  const css = fs.readFileSync(TOKENS, 'utf8')
  const out = {}
  const re = /\[data-world="storefront"\]\[data-theme="([a-z]+)"\]\s*\{([\s\S]*?)\n\}/g
  let m
  while ((m = re.exec(css))) {
    const body = m[2]
    // Följ en nivå av var()-referens: flera mallar skriver t.ex.
    // `--color-accent-fg: var(--color-bg)`. Läses den som "saknas" härleder vakten ett
    // värde mallen inte använder och failar på ett fel som inte finns (zigge, mätt).
    const raw = (name) => {
      const r = new RegExp(`--${name}:\\s*([^;]+);`).exec(body)
      return r ? r[1].trim() : null
    }
    const pick = (name, depth = 0) => {
      const v = raw(name)
      if (!v) return null
      if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
      const ref = /^var\(\s*--([a-z-]+)/.exec(v)
      if (ref && depth < 3) return pick(ref[1], depth + 1)
      return null
    }
    out[m[1]] = {
      primary: pick('color-primary'),
      bg: pick('color-bg'),
      surface: pick('color-surface'),
      accentSoft: pick('color-accent-soft'),
      ink: pick('color-primary-ink'),
      accentFg: pick('color-accent-fg'),
    }
  }
  return out
}

/** Florist-mallarna deklarerar sin palett i <key>.theme.ts — läs den ur källan.
 *  (Tokens genereras vid render av floristThemeBlock, så CSS:en finns inte på disk.) */
function themesFromFlorist() {
  const out = {}
  for (const f of fs.readdirSync(FLORIST).filter((n) => n.endsWith('.theme.ts'))) {
    const src = fs.readFileSync(path.join(FLORIST, f), 'utf8')
    const grab = (k) => {
      const r = new RegExp(`${k}:\\s*'(#[0-9a-fA-F]{6})'`).exec(src)
      return r ? r[1] : null
    }
    const key = f.replace('.theme.ts', '')
    const p = grab('primary')
    if (!p) continue
    out[key] = {
      primary: p,
      bg: grab('bg'),
      surface: grab('surface'),
      accentSoft: grab('accentSoft'),
      ink: null, // räknas av floristThemeBlock (accentInk) — kontrolleras nedan
      accentFg: null, // räknas av floristThemeBlock (accentForeground)
      derived: true,
    }
  }
  return out
}

// Speglar accentForeground/accentInk i packages/ui/tokens.ts. Skulle de glida isär failar
// vakten hellre för hårt än för mjukt — men båda härleds ur samma WCAG-räkning.
const bestFg = (bgColor) => (ratio('#15281f', bgColor) >= ratio('#ffffff', bgColor) ? '#15281f' : '#ffffff')
const deriveInk = (primary, worstLight) => {
  if (!worstLight) return primary
  if (ratio(primary, worstLight) >= MIN_TEXT) return primary
  const p = rgb(primary)
  for (let k = 0.98; k >= 0.2; k -= 0.02) {
    const hex = '#' + p.map((v) => Math.round(v * k).toString(16).padStart(2, '0')).join('')
    if (ratio(hex, worstLight) >= MIN_TEXT) return hex
  }
  return '#15281f'
}

const themes = { ...themesFromTokens(), ...themesFromFlorist() }
const fails = []

for (const [key, t] of Object.entries(themes)) {
  if (!t.primary) continue

  // Mallens ljusa ytor. Mörk text är svårast på den MÖRKASTE av dem (nästan alltid
  // accent-soft) — mäts den bara mot den vita blir tonen för ljus och texten faller
  // igenom på tonade sektioner. Mörka mallar har inga ljusa ytor → hoppas över.
  const lights = [t.bg, t.surface, t.accentSoft].filter((c) => c && bestFg(c) === '#15281f')
  const worstLight = lights.sort((a, b) => lum(rgb(a)) - lum(rgb(b)))[0] ?? null

  const ink = t.ink ?? deriveInk(t.primary, worstLight)
  const accentFg = t.accentFg ?? bestFg(t.primary)

  // 1. TEXT: primary-ink måste vara läsbar på varje ljus yta mallen har.
  for (const surface of lights) {
    const r = ratio(ink, surface)
    if (r != null && r < MIN_TEXT) {
      fails.push(`${key}: text ${ink} på ${surface} = ${r.toFixed(2)}:1 (kräver ${MIN_TEXT})`)
    }
  }

  // 2. KNAPP: accent-fg måste vara läsbar på knappens fyllning (= primary).
  const rBtn = ratio(accentFg, t.primary)
  if (rBtn != null && rBtn < MIN_TEXT) {
    fails.push(
      `${key}: knapptext ${accentFg} på fyllningen ${t.primary} = ${rBtn.toFixed(2)}:1 ` +
        `(kräver ${MIN_TEXT}) — ingen textfärg räddar den fyllningen, justera paletten`,
    )
  }
  // (Ingen regel om primären som RAM mot bakgrunden: en ljus guldlinje på vitt är ett
  // designval, inte en oläslig text. En sådan regel failade freshcut på ett "fel" som
  // webbläsarsveppet inte ser — vakten ska bevaka TEXT, inte ha åsikter om dekor.)
}

const n = Object.keys(themes).length
if (fails.length) {
  console.error(`\nKONTRAST-VAKTEN FALLER — ${fails.length} brott i ${n} mallar:\n`)
  for (const f of fails) console.error('  ✗ ' + f)
  console.error('\nFixa paletten eller sätt --color-primary-ink/--color-accent-fg i mallens block.')
  console.error('Se exakt vilken TEXT som brister: npm run kontrast\n')
  process.exit(1)
}
console.log(`Kontrast-vakten: ${n} mallar, 0 brott.`)
