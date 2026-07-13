import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import type { ThemePageProps } from '../layouts/florist/types'

// ALLA 12 MALLAR HAR SITT KONTAKTFORMULÄR TILLBAKA (goal-64).
//
// Agenterna amputerade formuläret ur var och en av de 12 .dc.html-mallarna med samma
// motivering: "motorn har ingen kontakt-mejlräls, och en submit som inte skickar något
// är värre än inget formulär". Rälsen finns nu — och det här testet är spärren som gör
// att ingen mall tyst tappar sitt formulär igen.
//
// Testet är MEKANISKT, inte ögonmått: det kräver ett riktigt <form>, ett textarea, och
// mallens EXAKTA knapptext ur .dc.html (Aurora "Skicka" · Calytrix "SKICKA" · Lunaria
// "Sänd" · Blomstertorget "Skicka insändaren" · Ateljé Vinter gemena "skicka" …).

import { AuroraKontakt } from '../layouts/florist/aurora.pages'
import { CalytrixKontakt } from '../layouts/florist/calytrix.pages'
import { SolSaltKontakt } from '../layouts/florist/solsalt.pages'
import { BlomstertorgetKontakt } from '../layouts/florist/blomstertorget.pages'
import { EloriaKontakt } from '../layouts/florist/eloria.pages'
import { AteljeVinterKontakt } from '../layouts/florist/ateljevinter.pages'
import { LunariaKontakt } from '../layouts/florist/lunaria.pages'
import { OnyxKontakt } from '../layouts/florist/onyx.pages'
import { SivSavKontakt } from '../layouts/florist/sivsav.pages'
import { KallaKontakt } from '../layouts/salong/kalla.pages'
import { SiluettKontakt } from '../layouts/salong/siluett.pages'
import { SnittKontakt } from '../layouts/salong/snitt.pages'

const props = {
  tenant: { id: 't1', name: 'Aurora', slug: 'aurora' },
  content: {
    heroImages: [],
    aboutCopy: 'Om oss.',
    closingLede: 'Hör av dig.',
    italic: 'Kursivt.',
  },
  services: [],
  location: { address: 'Blomstergatan 4', hours: [{ day: 'Mån', time: '10–18' }] },
  contact: { email: 'hej@aurora.se', phone: '08-123 456 78' },
} as unknown as ThemePageProps

/** Mallens namn → dess EXAKTA knapptext ur .dc.html (filen är lag). */
const MALLAR: [string, (p: ThemePageProps) => React.ReactNode, string][] = [
  ['aurora', AuroraKontakt, 'Skicka'],
  ['calytrix', CalytrixKontakt, 'SKICKA'],
  ['solsalt', SolSaltKontakt, 'Skicka'],
  ['blomstertorget', BlomstertorgetKontakt, 'Skicka insändaren'],
  ['eloria', EloriaKontakt, 'Skicka förfrågan'],
  ['ateljevinter', AteljeVinterKontakt, 'skicka'],
  ['lunaria', LunariaKontakt, 'Sänd'],
  ['onyx', OnyxKontakt, 'SKICKA'],
  ['sivsav', SivSavKontakt, 'Skicka'],
  ['kalla', KallaKontakt, 'Skicka'],
  ['siluett', SiluettKontakt, 'Skicka'],
  ['snitt', SnittKontakt, 'Skicka'],
]

describe('kontaktformuläret finns i ALLA 12 mallar', () => {
  it.each(MALLAR)('%s: riktigt formulär med mallens egen knapptext', (_namn, Kontakt, cta) => {
    const html = renderToStaticMarkup(createElement(Kontakt as never, props))

    expect(html).toContain('<form')
    expect(html).toContain('<textarea')
    expect(html).toContain('name="name"')
    expect(html).toContain('name="message"')
    // Knapptexten är mallens, inte plattformens generiska.
    expect(html).toContain(cta)
  })

  it.each(MALLAR)('%s: honeypot-fältet finns (och är dolt för människor)', (_n, Kontakt) => {
    const html = renderToStaticMarkup(createElement(Kontakt as never, props))
    expect(html).toContain('company_website')
    expect(html).toContain('aria-hidden="true"')
  })

  it('aurora ber om TELEFON (inte e-post) — filens fältuppsättning, inte vår', () => {
    const html = renderToStaticMarkup(createElement(AuroraKontakt as never, props))
    expect(html).toContain('name="phone"')
    expect(html).not.toContain('name="email"')
  })

  it('eloria har det fjärde fältet "Tillfälle & datum" → subject', () => {
    const html = renderToStaticMarkup(createElement(EloriaKontakt as never, props))
    expect(html).toContain('name="subject"')
    expect(html).toContain('t.ex. bröllop, 14 juni')
  })
})
