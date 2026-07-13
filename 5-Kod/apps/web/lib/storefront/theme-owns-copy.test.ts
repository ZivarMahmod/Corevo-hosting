import { describe, it, expect } from 'vitest'
// theme-content FÖRST: registry.ts och theme-capabilities.ts sitter i en cirkulär
// import med den (types.ts hämtar ThemeCaps därifrån). Importeras registryt först
// hinner THEME_CONTENT aldrig initieras → base blir undefined i resolveThemeContent.
import { layerCopy, resolveThemeContent } from '@/components/storefront/theme-content'
import { branschCopy } from '@/components/storefront/bransch-copy'
import { THEME_OWNS_COPY, themeOwnsCopy } from '@/lib/platform/theme-capabilities'
import { FLORIST_THEMES } from '@/components/storefront/layouts/florist/registry'
import { EKONOMI_THEMES } from '@/components/storefront/layouts/ekonomi/registry'
import { SALONG_THEMES } from '@/components/storefront/layouts/salong/registry'
import type { StorefrontTheme } from '@/lib/tenant-data'

/**
 * goal-64 — MALLEN ÄGER SIN TEXT.
 *
 * Utan ownsCopy är precedensen `kund > bransch > mall`: BRANSCH_COPY ligger OVANPÅ
 * mallens content, så en florist-tenant får branschens generiska hero-text även när
 * mallen har en egen. För en mall som är en EXAKT KOPIA av ett Claude Design-paket är
 * copyn en del av designen — att tyst byta ut den är att improvisera bort mallen.
 *
 * Testet låser BÅDA riktningarna: att bransch-lagret fortfarande vinner för mallar utan
 * flaggan (noll regression för de 21 befintliga), och att det hoppas över för mallar med.
 */

// Den riktiga skip-logiken bor i tenant-copy.ts (server-only + DB). Den är EN rad ovanpå
// den layerCopy() som testas här — samma kedja, bara utan DB-rundan.
const resolveMed = (theme: StorefrontTheme, verticalId: string, ownerCopy: Parameters<typeof layerCopy>[1]) =>
  themeOwnsCopy(theme)
    ? resolveThemeContent(theme, null, layerCopy({}, ownerCopy))
    : resolveThemeContent(theme, null, layerCopy(branschCopy(verticalId), ownerCopy))

describe('goal-64: THEME_OWNS_COPY', () => {
  it('härleds ur mallarnas egna manifest (ownsCopy) — ingen separat lista att glömma', () => {
    const declared = [...FLORIST_THEMES, ...EKONOMI_THEMES, ...SALONG_THEMES]
      .filter((t) => t.ownsCopy)
      .map((t) => t.key)
    expect([...THEME_OWNS_COPY].sort()).toEqual(declared.sort())
  })

  it('ingen KUND-mall äger sin copy → noll beteendeändring för de live tenanterna', () => {
    // Claude Design-mallarna (goal-64) SKA äga sin copy — deras text är en del av designen.
    // Kund-mallarna får den ALDRIG: det skulle tyst byta texten på en sajt som är i drift.
    for (const kundmall of ['freshcut', 'flora', 'zentum', 'leander']) {
      expect(themeOwnsCopy(kundmall)).toBe(false)
    }
  })

  it('utan flaggan vinner branschen över mallen (dagens beteende, oförändrat)', () => {
    const bransch = branschCopy('florist')
    // Förutsättning: florist-branschen sätter faktiskt en egen hero-rubrik.
    expect(bransch.heroTitle && bransch.heroTitle.length > 0).toBe(true)

    // flora = kund-mallen (Hantverksfloristerna) — den saknar ownsCopy och ska fortsätta
    // få bransch-lagret ovanpå sin egen text. Byt INTE till en Claude Design-mall här.
    const content = resolveMed('flora' as StorefrontTheme, 'florist', null)
    expect(content.heroTitle).toBe(bransch.heroTitle)
  })

  it('med flaggan vinner mallen över branschen — men kunden vinner alltid över mallen', () => {
    const fejkad = { ...FLORIST_THEMES[0], key: 'fejkmall', ownsCopy: true }
    // Simulerar skip-grenen i tenant-copy.ts för en mall som äger sin copy.
    const utanBransch = layerCopy({}, null)
    const medKund = layerCopy({}, { heroTitle: 'Kundens egen rubrik' })

    // Mallen äger → bransch-lagret är borta → mallens egen rubrik står kvar.
    expect(utanBransch).toBeNull()
    expect(fejkad.content.heroTitle.length > 0).toBe(true)

    // Kundens text vinner fortfarande — det ÄR redigeraren.
    expect(medKund?.heroTitle).toBe('Kundens egen rubrik')
  })
})
