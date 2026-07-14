import { describe, it, expect } from 'vitest'
import { telHref } from './BookingDrawer'

// En trasig tel:-länk failar TYST: telefonappen öppnas med fel nummer, eller inte
// alls, och ingen märker det förrän en kund inte blir uppringd. Därför låst i test.
describe('telHref', () => {
  it('behåller landsprefixet', () => {
    expect(telHref('+46 70 123 45 67')).toBe('tel:+46701234567')
  })

  it('rensar mellanslag, bindestreck och parenteser — de bryter tel: i vissa appar', () => {
    expect(telHref('070-123 45 67')).toBe('tel:0701234567')
    expect(telHref('(070) 123-4567')).toBe('tel:0701234567')
  })

  it('släpper ett plus som inte står först (det är ett skrivfel, inte ett prefix)', () => {
    expect(telHref('070+123')).toBe('tel:070123')
  })

  it('ger null när det inte finns något att ringa', () => {
    expect(telHref(null)).toBeNull()
    expect(telHref('')).toBeNull()
    expect(telHref('   ')).toBeNull()
    // Bara skräptecken → inga siffror → ingen länk, hellre än tel: rakt av.
    expect(telHref('---')).toBeNull()
  })
})
