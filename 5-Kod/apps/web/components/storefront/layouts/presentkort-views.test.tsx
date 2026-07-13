import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CartProvider } from '../shop/CartProvider'
import { themeModuleViews } from './florist/layouts'
import type { PresentkortConfig } from '@/lib/storefront/presentkort/types'
import { SELECTABLE_THEMES } from '@/lib/platform/theme-palettes'

const COREVO_12 = [
  'ateljevinter',
  'aurora',
  'blomstertorget',
  'calytrix',
  'eloria',
  'lunaria',
  'onyx',
  'sivsav',
  'solsalt',
  'kalla',
  'siluett',
  'snitt',
] as const

const SIGNATURES: Record<(typeof COREVO_12)[number], string> = {
  ateljevinter: 'ge bort ett verk',
  aurora: 'Ge bort blomsterglädje',
  blomstertorget: 'Ett värdebevis, gott som kontanter',
  calytrix: 'Mottagarens mejl',
  eloria: 'En gåva med värdighet',
  lunaria: 'LUNARIA',
  onyx: 'Svart kort, guldtryck',
  sivsav: 'Ge bort blomster',
  solsalt: 'Sol &amp; Salt',
  kalla: 'Källritualen',
  siluett: 'väldigt lycklig människa',
  snitt: 'svart kuvert',
}

const config: PresentkortConfig = {
  fulfilment: 'digital',
  amountPresets: [300, 500, 750, 1000],
  currency: 'SEK',
  headline: 'Presentkort',
  codePrefix: '1962-',
  deliveryModes: ['digital', 'in_store'],
  paymentEnabled: true,
}

describe('handoffens 12 presentkortsvyer', () => {
  it('är exakt de 12 mallarna som kan väljas vid kundskapande och mallbyte', () => {
    expect(SELECTABLE_THEMES.map((theme) => theme.key)).toEqual([...COREVO_12])
  })

  it('förbjuder delad fallback: varje mall har en egen komponent', () => {
    const views = COREVO_12.map((key) => themeModuleViews(key).presentkort)
    expect(views.every(Boolean)).toBe(true)
    expect(new Set(views).size).toBe(COREVO_12.length)
  })

  it.each(COREVO_12)('%s renderar sin egen handoff-signatur', (key) => {
    const View = themeModuleViews(key).presentkort!
    const html = renderToStaticMarkup(
      <CartProvider>
        <View
          config={config}
          paused={false}
          tenantName={
            key === 'lunaria'
              ? 'Lunaria'
              : key === 'solsalt'
                ? 'Sol & Salt'
                : 'Testkund'
          }
        />
      </CartProvider>,
    )
    expect(html).toContain(SIGNATURES[key])
    expect(html).not.toContain('Köp ett presentkort')
  })
})
