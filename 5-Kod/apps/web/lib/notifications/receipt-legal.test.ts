import { describe, expect, it } from 'vitest'
import { receiptEmail } from './templates'

// Plan 003: kvittots juridikrader (org-nr + momsspecifikation). Moms ingår i
// totalen → moms = total × sats/(100+sats), öresavrundat. Fält som saknas →
// raderna UTELÄMNAS (aldrig "varav moms (null %)").

const base = {
  tenantName: 'FreshCut',
  serviceName: 'Klippning',
  startISO: '2026-07-01T10:00:00Z',
  timeZone: 'Europe/Stockholm',
  amountCents: 50000, // 500,00 kr
  currency: 'sek',
}

describe('receiptEmail juridikrader (plan 003)', () => {
  it('renderar org-nr och korrekt momsbelopp när fälten är satta', () => {
    const { html } = receiptEmail({ ...base, orgNr: '556677-8899', vatRate: 25 })
    expect(html).toContain('Org.nr 556677-8899')
    // 50000 × 25/125 = 10000 öre = 100,00 kr
    expect(html).toContain('varav moms (25')
    expect(html).toContain('100,00')
  })

  it('öresavrundar momsen korrekt', () => {
    // 33300 × 25/125 = 6660 öre = 66,60 kr
    const { html } = receiptEmail({ ...base, amountCents: 33300, vatRate: 25 })
    expect(html).toContain('66,60')
  })

  it('utelämnar raderna helt när fälten saknas', () => {
    const { html } = receiptEmail(base)
    expect(html).not.toContain('Org.nr')
    expect(html).not.toContain('varav moms')
  })

  it('vatRate 0 ger ingen momsrad (momsfri verksamhet)', () => {
    const { html } = receiptEmail({ ...base, vatRate: 0 })
    expect(html).not.toContain('varav moms')
  })
})
