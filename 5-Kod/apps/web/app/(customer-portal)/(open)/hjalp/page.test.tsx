import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import HelpPage, { metadata } from './page'

describe('public customer portal help page', () => {
  it('renders the exact public help copy without actions or personal data', () => {
    const html = renderToStaticMarkup(<HelpPage />)

    expect(html).toContain('<h1>Hjälp</h1>')
    expect(html).toContain('Mina bokningar är en säker sida där du ser och hanterar dina bokningar hos företag som använder Corevo.')
    expect(html).toContain('Din personliga länk finns i bokningsbekräftelsen du fick via SMS eller e-post. Länken fungerar bara en gång.')
    expect(html).toContain('Kommer du inte in? Begär en ny kod via länken i din bekräftelse, eller kontakta företaget du bokade hos.')
    expect(html).toContain('Frågor om en bokning, ett pris eller en avbokning besvaras av företaget du bokade hos.')
    expect(html).toContain('data-screen="hjalp"')
    expect(html).not.toMatch(/<button\b|href="\/(?!\/)|tenantId|customerId|telefonnummer|e-postadress/i)
  })

  it('is a noindex public Corevo page', () => {
    expect(metadata).toMatchObject({
      title: 'Hjälp · Corevo',
      robots: { index: false, follow: false, nocache: true },
      referrer: 'no-referrer',
    })
  })
})
