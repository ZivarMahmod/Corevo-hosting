import { test, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FLORIST_THEME_CSS } from './florist/registry'
import { EKONOMI_THEME_CSS } from './ekonomi/registry'
import { SALONG_THEME_CSS } from './salong/registry'

// Steg 1 (prestanda-auditen): app/layout.tsx importerade tema-registryt bara för att
// få ut tre palett-CSS-strängar, och drog därmed hela storefront-modulgrafen in i
// VARJE isolat (login/admin/404/api). Fixen: layouten importerar en ren datafil,
// theme-css.generated.ts — noll imports, noll modulgraf. Den filen genereras HÄR ur
// registryn (den enda sanningen om paletterna) och den här vakten faller om den
// committade filen inte längre matchar registryn (någon ändrade en palett men glömde
//   npm run gen:theme-css   ). Kör om det, granska diffen, committa.

const GEN_PATH = fileURLToPath(new URL('./theme-css.generated.ts', import.meta.url))

function render(): string {
  const q = (s: string) => JSON.stringify(s)
  return `// AUTO-GENERAT — redigera INTE for hand.
//
// Kalla: components/storefront/layouts/{florist,ekonomi,salong}/registry.ts
// (FLORIST/EKONOMI/SALONG_THEME_CSS via floristThemeBlock). Regenereras med
//   npm run gen:theme-css
// En vakt (theme-css.sync.test.ts) faller om paletterna andrats utan regenerering.
//
// VARFOR: app/layout.tsx kor pa VARJE request (login, admin, 404, api). Importerade
// den registryt drogs hela storefront-modulgrafen (nav/footer/kassa/wizard, 150+ filer,
// ~1,4 MB, 400 kB mall-CSS) in i varje isolat — prestanda-auditens huvudfynd (steg 1).
// Den har filen ar ren data: noll imports => noll modulgraf.

export const FLORIST_THEME_CSS: string = ${q(FLORIST_THEME_CSS)}

export const EKONOMI_THEME_CSS: string = ${q(EKONOMI_THEME_CSS)}

export const SALONG_THEME_CSS: string = ${q(SALONG_THEME_CSS)}
`
}

test('theme-css.generated.ts är i synk med registryn', () => {
  const expected = render()
  if (process.env.GEN) {
    writeFileSync(GEN_PATH, expected)
    return
  }
  const actual = readFileSync(GEN_PATH, 'utf8')
  expect(actual).toBe(expected)
})

// Auditens grep-test, gjord till en riktig invariant: den genererade filen som
// rot-layouten importerar får ALDRIG ha en import/require. Får den det är hela poängen
// med steg 1 (ingen storefront-graf i login/admin/404) borta.
test('theme-css.generated.ts har noll imports', () => {
  const src = readFileSync(GEN_PATH, 'utf8')
  expect(src).not.toMatch(/^\s*import\s/m)
  expect(src).not.toMatch(/\brequire\s*\(/)
})
